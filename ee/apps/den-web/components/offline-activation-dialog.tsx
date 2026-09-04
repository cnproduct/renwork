"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Organization = { id: string; name: string };

type OfflineOffer = {
  catalogVersion: string;
  planId: string;
  planName: string;
  audience: "personal" | "enterprise";
  seatLimit: number;
  offerId: string;
  billingInterval: "monthly" | "annual";
  currency: "CNY";
  priceMinor: number;
  includedRenCredits: number;
};

type OfflineOrder = {
  id: string;
  offer_id: string;
  status: "active" | "reversed";
  effective_status: "active" | "expired" | "reversed";
  amount_minor: number;
  currency: string;
  granted_microcredits: number;
  payment_method: string;
  payment_reference: string;
  current_period_end: string;
  created_at: string;
  reversal_reason: string | null;
};

type Wallet = {
  available_microcredits: number;
  reserved_microcredits: number;
} | null;

type LedgerEntry = {
  id: string;
  entryType: string;
  amountMicroCredits: number;
  availableDeltaMicroCredits: number;
  availableBalanceAfter: number;
  reservedBalanceAfter: number;
  reasonCode: string;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`/api/den${path}`, {
    credentials: "include",
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init?.headers },
  });
  const text = await response.text();
  let payload: unknown = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

function money(minor: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" }).format(minor / 100);
}

function credits(microcredits: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 3 }).format(microcredits / 1_000_000);
}

function newIdempotencyKey() {
  return `offline-${crypto.randomUUID()}`;
}

export function OfflineActivationDialog(props: {
  organization: Organization | null;
  onClose: () => void;
  onConfigurePolicy: (organization: Organization) => void;
}) {
  const [offers, setOffers] = useState<OfflineOffer[]>([]);
  const [offerId, setOfferId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [orders, setOrders] = useState<OfflineOrder[]>([]);
  const [wallet, setWallet] = useState<Wallet>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const selectedOffer = useMemo(() => offers.find((offer) => offer.offerId === offerId) ?? null, [offerId, offers]);

  const load = useCallback(async (organization: Organization) => {
    setLoading(true);
    setError(null);
    try {
      const [optionsPayload, summaryPayload] = await Promise.all([
        request("/v1/admin/renwork/offline-orders/options"),
        request(`/v1/admin/renwork/offline-orders/${organization.id}/summary`),
      ]);
      const nextOffers = isRecord(optionsPayload) && Array.isArray(optionsPayload.offers) ? optionsPayload.offers as OfflineOffer[] : [];
      const nextOrders = isRecord(summaryPayload) && Array.isArray(summaryPayload.orders) ? summaryPayload.orders as OfflineOrder[] : [];
      const nextWallet = isRecord(summaryPayload) && (summaryPayload.wallet === null || isRecord(summaryPayload.wallet)) ? summaryPayload.wallet as Wallet : null;
      const nextLedger = isRecord(summaryPayload) && Array.isArray(summaryPayload.ledger) ? summaryPayload.ledger as LedgerEntry[] : [];
      setOffers(nextOffers);
      setOfferId((current) => current || nextOffers[0]?.offerId || "");
      setOrders(nextOrders);
      setWallet(nextWallet);
      setLedger(nextLedger);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法加载线下开通数据");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!props.organization) return;
    setPaymentReference("");
    setNote("");
    setConfirmed(false);
    setMessage(null);
    setIdempotencyKey(newIdempotencyKey());
    void load(props.organization);
  }, [load, props.organization]);

  if (!props.organization) return null;
  const organization = props.organization;

  const activate = async () => {
    if (!selectedOffer || !paymentReference.trim() || !confirmed) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = await request("/v1/admin/renwork/offline-orders", {
        method: "POST",
        body: JSON.stringify({
          organizationId: organization.id,
          offerId: selectedOffer.offerId,
          amountMinor: selectedOffer.priceMinor,
          paymentMethod,
          paymentReference: paymentReference.trim(),
          idempotencyKey,
          note: note.trim() || null,
        }),
      });
      const warning = isRecord(payload) && typeof payload.provisioningWarning === "string" ? payload.provisioningWarning : null;
      setMessage(warning ? `款项与权益已入账；模型同步需重试：${warning}` : "线下订单、套餐权益和 RenCredit 已原子入账。");
      setConfirmed(false);
      setPaymentReference("");
      setIdempotencyKey(newIdempotencyKey());
      await load(organization);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "开通失败");
    } finally {
      setSaving(false);
    }
  };

  const reverse = async (order: OfflineOrder) => {
    const reason = window.prompt("请输入退款/冲正原因。冲正会写入不可变流水，并可能形成负余额。")?.trim();
    if (!reason) return;
    setSaving(true);
    setError(null);
    try {
      await request(`/v1/admin/renwork/offline-orders/${order.id}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setMessage("订单已冲正，权益已恢复到开通前状态，RenCredit 已写入退款流水。");
      await load(organization);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "冲正失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="offline-activation-title" onClick={props.onClose}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-orange-600">Platform super admin</p>
        <h2 id="offline-activation-title" className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">线下收款与人工开通</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{organization.name} · 全部固定价格的个人版和企业版套餐均可线下收款开通；价格和 RenCredit 只读自权威目录，不允许手工兑换。</p>

        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3">
          <div><p className="text-xs text-slate-500">可用余额</p><p className="mt-1 font-semibold">{wallet ? credits(wallet.available_microcredits) : "0"} RC</p></div>
          <div><p className="text-xs text-slate-500">冻结余额</p><p className="mt-1 font-semibold">{wallet ? credits(wallet.reserved_microcredits) : "0"} RC</p></div>
          <button type="button" onClick={() => props.onConfigurePolicy(organization)} className="rounded-full border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700">配置模型与预算</button>
        </div>

        {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2"><span className="text-xs font-semibold text-slate-600">权威套餐</span><select value={offerId} onChange={(event) => setOfferId(event.target.value)} disabled={loading} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">{offers.map((offer) => <option key={offer.offerId} value={offer.offerId}>{offer.planName} · {offer.billingInterval === "monthly" ? "月付" : "年付"} · {money(offer.priceMinor)}</option>)}</select></label>
          <label className="grid gap-2"><span className="text-xs font-semibold text-slate-600">收款方式</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><option value="bank_transfer">银行转账</option><option value="wechat_offline">微信线下</option><option value="alipay_offline">支付宝线下</option><option value="cash">现金</option><option value="other">其他</option></select></label>
          <label className="grid gap-2"><span className="text-xs font-semibold text-slate-600">到账金额（目录锁定）</span><input readOnly value={selectedOffer ? money(selectedOffer.priceMinor) : "-"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
          <label className="grid gap-2"><span className="text-xs font-semibold text-slate-600">本次入账</span><input readOnly value={selectedOffer ? `${selectedOffer.includedRenCredits.toLocaleString()} RenCredit` : "-"} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm" /></label>
          <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-semibold text-slate-600">支付流水号 / 收据号</span><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="必填且不可重复" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" /></label>
          <label className="grid gap-2 sm:col-span-2"><span className="text-xs font-semibold text-slate-600">备注</span><textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20 rounded-2xl border border-slate-200 px-4 py-3 text-sm" /></label>
        </div>

        <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-1" /><span>我已核对实际到账、组织、套餐和模型策略。提交后将同时创建订单、开通权益并写入不可变 RenCredit 流水。</span></label>
        <p className="mt-3 text-xs leading-5 text-slate-500">企业定制版同样支持线下付款，但须先签订合同，并把约定金额、席位和 RenCredit 发布为版本化权威报价后才能入账。当前目录没有 ¥100 加油包，不能临时换算 RenCredit。</p>

        <div className="mt-5 flex justify-end gap-3"><button type="button" onClick={props.onClose} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold">关闭</button><button type="button" disabled={saving || !selectedOffer || !paymentReference.trim() || !confirmed} onClick={() => void activate()} className="rounded-full bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "处理中…" : "确认收款并开通"}</button></div>

        <div className="mt-7 border-t border-slate-200 pt-5"><h3 className="font-semibold text-slate-950">线下订单与冲正</h3>{orders.length === 0 ? <p className="mt-3 text-sm text-slate-500">暂无订单。</p> : <div className="mt-3 grid gap-2">{orders.map((order) => <div key={order.id} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-semibold">{order.offer_id} · {money(order.amount_minor)}</p><p className="mt-1 text-xs text-slate-500">{order.payment_reference} · 到期 {new Date(order.current_period_end).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className={order.effective_status === "active" ? "text-emerald-700" : "text-slate-500"}>{order.effective_status === "active" ? "已生效" : order.effective_status === "expired" ? "已到期" : "已冲正"}</span>{order.status === "active" ? <button type="button" disabled={saving} onClick={() => void reverse(order)} className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-700">退款/冲正</button> : null}</div></div></div>)}</div>}</div>
        <div className="mt-7 border-t border-slate-200 pt-5"><h3 className="font-semibold text-slate-950">最近 RenCredit 不可变流水</h3>{ledger.length === 0 ? <p className="mt-3 text-sm text-slate-500">暂无流水。</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-slate-500"><tr><th className="pb-2">时间</th><th className="pb-2">类型</th><th className="pb-2">原因</th><th className="pb-2">变动</th><th className="pb-2">可用 / 冻结</th></tr></thead><tbody>{ledger.map((entry) => <tr key={entry.id} className="border-t border-slate-100"><td className="py-2">{new Date(entry.createdAt).toLocaleString()}</td><td className="py-2">{entry.entryType}</td><td className="py-2">{entry.reasonCode}</td><td className="py-2">{credits(entry.availableDeltaMicroCredits)} RC</td><td className="py-2">{credits(entry.availableBalanceAfter)} / {credits(entry.reservedBalanceAfter)}</td></tr>)}</tbody></table></div>}</div>
      </div>
    </div>
  );
}
