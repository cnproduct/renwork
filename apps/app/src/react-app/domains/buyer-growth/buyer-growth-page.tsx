/** @jsxImportSource react */
import * as React from "react";
import type {
  RenworkBuyerCompanyPreview,
  RenworkBuyerUnlockQuoteResponse,
  RenworkBuyerUnlockResponse,
  RenworkMaskedContact,
  RenworkVerifiedContact,
} from "@openwork/types/renwork-buyer-growth";
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Coins,
  Globe2,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { createDenClient, readDenSettings } from "@/app/lib/den";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SelectedContact = {
  company: RenworkBuyerCompanyPreview;
  contact: RenworkMaskedContact;
};

type ReleaseNotice = Extract<RenworkBuyerUnlockResponse, { status: "released" }>;

function requestKey(prefix: string): string {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function evidenceTone(grade: "E1" | "E2" | "E3") {
  if (grade === "E3") return "border-emerald-7/30 bg-emerald-3/45 text-emerald-11";
  if (grade === "E2") return "border-blue-7/30 bg-blue-3/45 text-blue-11";
  return "border-amber-7/30 bg-amber-3/45 text-amber-11";
}

function releaseReasonLabel(reason: ReleaseNotice["reason"]): string {
  if (reason === "user_canceled") return "用户取消";
  if (reason === "no_result") return "没有有效结果";
  if (reason === "upstream_failure") return "数据服务失败";
  if (reason === "timeout") return "请求超时";
  return "隐私或合规停止";
}

function VerifiedContactPanel(props: { contact: RenworkVerifiedContact; repeated?: boolean }) {
  return (
    <div className="rounded-xl border border-emerald-7/30 bg-emerald-2/35 p-4" data-testid="buyer-unlocked-contact">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BadgeCheck className="size-4 text-emerald-10" />
          <span className="text-sm font-semibold text-dls-text">{props.contact.name}</span>
          <span className="text-xs text-dls-secondary">{props.contact.role}</span>
        </div>
        <Badge variant="secondary">
          {props.repeated ? "已解锁 · 本次 0 RenCredit" : "已验证联系方式"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-dls-secondary">
          <Mail className="size-4" />
          <span>{props.contact.email ?? "未交付有效邮箱"}</span>
        </div>
        <div className="flex items-center gap-2 text-dls-secondary">
          <Phone className="size-4" />
          <span>{props.contact.phone ?? "未交付有效电话"}</span>
        </div>
      </div>
      <div className="mt-3 text-xs leading-5 text-dls-secondary">
        验证时间：{new Date(props.contact.verifiedAt).toLocaleString()} · {props.contact.sourceSummary}
      </div>
    </div>
  );
}

function CompanyCard(props: {
  company: RenworkBuyerCompanyPreview;
  unlocked: Record<string, RenworkVerifiedContact>;
  onQuote: (selection: SelectedContact) => void;
}) {
  return (
    <Card data-testid={`buyer-company-${props.company.companyId}`}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              {props.company.companyName}
              <Badge variant="outline">匹配度 {props.company.matchScore}%</Badge>
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-2">
              <Globe2 className="size-3.5" />
              {props.company.country}
              {props.company.website ? ` · ${new URL(props.company.website).hostname}` : ""}
            </CardDescription>
          </div>
          <Badge className="bg-emerald-3 text-emerald-11">企业预览免费</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-dls-secondary">匹配理由</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {props.company.matchReasons.map((reason) => (
              <div key={reason} className="flex items-start gap-2 text-sm text-dls-secondary">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-10" />
                <span>{reason}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-dls-secondary">证据等级</div>
          <div className="mt-2 space-y-2">
            {props.company.evidence.map((evidence) => (
              <div key={evidence.id} className="rounded-xl border border-dls-border bg-dls-sidebar p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", evidenceTone(evidence.grade))}>
                    {evidence.grade}
                  </span>
                  <span className="text-sm text-dls-text">{evidence.summary}</span>
                </div>
                <div className="mt-1 text-xs text-dls-secondary">
                  {evidence.sourceSummary} · 观察于 {new Date(evidence.observedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {props.company.riskFlags.length > 0 ? (
          <div className="rounded-xl border border-amber-7/30 bg-amber-2/40 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-11">
              <AlertTriangle className="size-4" /> 风险提示
            </div>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-amber-11">
              {props.company.riskFlags.map((flag) => <li key={flag}>• {flag}</li>)}
            </ul>
          </div>
        ) : null}

        <div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-dls-secondary">脱敏决策人</div>
            <span className="text-xs text-dls-secondary">查看企业与脱敏信息不扣 RenCredit</span>
          </div>
          <div className="mt-2 space-y-3">
            {props.company.contacts.map((contact) => {
              const revealed = props.unlocked[contact.contactId];
              if (revealed) return <VerifiedContactPanel key={contact.contactId} contact={revealed} repeated />;
              return (
                <div key={contact.contactId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dls-border p-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-dls-text">
                      <Users className="size-4 text-dls-secondary" />
                      {contact.maskedName}
                    </div>
                    <div className="mt-1 text-xs text-dls-secondary">{contact.role}</div>
                    <div className="mt-2 flex gap-2 text-[11px] text-dls-secondary">
                      {contact.availability.verifiedEmail ? <span>可解锁已验证邮箱</span> : null}
                      {contact.availability.verifiedPhone ? <span>可解锁已验证电话</span> : null}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => props.onQuote({ company: props.company, contact })}>
                    <LockKeyhole className="size-4" /> 查看 RenCredit 报价
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function BuyerGrowthPage(props: { workspaceId: string }) {
  const settings = readDenSettings();
  const client = React.useMemo(
    () => createDenClient({ baseUrl: settings.baseUrl, token: settings.authToken }),
    [settings.authToken, settings.baseUrl],
  );
  const organizationId = settings.activeOrgId?.trim() ?? "";
  const [product, setProduct] = React.useState("");
  const [market, setMarket] = React.useState("");
  const [customerType, setCustomerType] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [companies, setCompanies] = React.useState<RenworkBuyerCompanyPreview[]>([]);
  const [evidenceNotice, setEvidenceNotice] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<SelectedContact | null>(null);
  const [quote, setQuote] = React.useState<Extract<RenworkBuyerUnlockQuoteResponse, { status: "quoted" }> | null>(null);
  const [quoteBusy, setQuoteBusy] = React.useState(false);
  const [unlockBusy, setUnlockBusy] = React.useState(false);
  const [approved, setApproved] = React.useState(false);
  const [transactionError, setTransactionError] = React.useState<string | null>(null);
  const [releaseNotice, setReleaseNotice] = React.useState<ReleaseNotice | null>(null);
  const [unlocked, setUnlocked] = React.useState<Record<string, RenworkVerifiedContact>>({});

  const searchBuyers = async () => {
    if (!organizationId || !props.workspaceId || !product.trim() || !market.trim() || !customerType.trim()) return;
    setSearching(true);
    setSearchError(null);
    setReleaseNotice(null);
    try {
      const response = await client.searchRenworkBuyers(organizationId, {
        product: product.trim(),
        market: market.trim(),
        customerType: customerType.trim(),
        workspaceId: props.workspaceId,
      });
      setCompanies(response.companies);
      setEvidenceNotice(response.evidenceNotice);
    } catch (error) {
      setCompanies([]);
      setEvidenceNotice(null);
      setSearchError(error instanceof Error ? error.message : "买家数据网关暂时不可用，请稍后重试。");
    } finally {
      setSearching(false);
    }
  };

  const requestQuote = async (nextSelection: SelectedContact) => {
    setSelection(nextSelection);
    setQuote(null);
    setQuoteBusy(true);
    setApproved(false);
    setTransactionError(null);
    setReleaseNotice(null);
    const fields: Array<"email" | "phone"> = [];
    if (nextSelection.contact.availability.verifiedEmail) fields.push("email");
    if (nextSelection.contact.availability.verifiedPhone) fields.push("phone");
    try {
      const response = await client.quoteRenworkBuyerUnlock(organizationId, {
        workspaceId: props.workspaceId,
        companyId: nextSelection.company.companyId,
        contactId: nextSelection.contact.contactId,
        fields,
        idempotencyKey: requestKey("quote"),
      });
      if (response.status === "already_unlocked") {
        setUnlocked((current) => ({ ...current, [response.contact.contactId]: response.contact }));
        setSelection(null);
        return;
      }
      setQuote(response);
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "暂时无法取得权威 RenCredit 报价。");
    } finally {
      setQuoteBusy(false);
    }
  };

  const confirmUnlock = async () => {
    if (!quote || !selection || !approved) return;
    setUnlockBusy(true);
    setTransactionError(null);
    try {
      const response = await client.unlockRenworkBuyerContact(organizationId, {
        workspaceId: props.workspaceId,
        quoteId: quote.quote.quoteId,
        approval: true,
        idempotencyKey: `unlock-${quote.quote.quoteId}`,
      });
      if (response.status === "delivered") {
        setUnlocked((current) => ({ ...current, [response.contact.contactId]: response.contact }));
        setSelection(null);
        setQuote(null);
      } else {
        setReleaseNotice(response);
        setSelection(null);
        setQuote(null);
      }
    } catch (error) {
      setTransactionError(error instanceof Error ? error.message : "解锁未完成，RenCredit 不会结算。请稍后重试。");
    } finally {
      setUnlockBusy(false);
    }
  };

  const closeQuote = () => {
    if (unlockBusy) return;
    setSelection(null);
    setQuote(null);
    setApproved(false);
    setTransactionError(null);
  };

  return (
    <main className="h-full overflow-y-auto bg-dls-surface" data-testid="buyer-growth-page">
      <div className="mx-auto w-full max-w-6xl space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-11">
              <Sparkles className="size-4" /> RenWork 买家增长引擎
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-dls-text">AI 找客户</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-dls-secondary">
              输入产品、目标市场与理想客户类型。RenWork 先免费返回企业、证据和脱敏决策人，只有解锁有效联系方式才会进入 RenCredit 确认。
            </p>
          </div>
          <Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5" /> 结果成功交付后才扣费</Badge>
        </header>

        <Card>
          <CardContent className="grid gap-4 p-5 md:grid-cols-[1fr_1fr_1.2fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="buyer-product">产品</Label>
              <Input id="buyer-product" value={product} onChange={(event) => setProduct(event.currentTarget.value)} placeholder="例如：婴儿纸尿裤" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-market">目标市场</Label>
              <Input id="buyer-market" value={market} onChange={(event) => setMarket(event.currentTarget.value)} placeholder="例如：德国、法国" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyer-type">理想客户类型</Label>
              <Input id="buyer-type" value={customerType} onChange={(event) => setCustomerType(event.currentTarget.value)} placeholder="例如：母婴用品进口商与区域经销商" />
            </div>
            <Button
              className="min-w-32"
              disabled={searching || !organizationId || !props.workspaceId || !product.trim() || !market.trim() || !customerType.trim()}
              onClick={() => void searchBuyers()}
            >
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {searching ? "正在验证" : "免费找企业"}
            </Button>
          </CardContent>
        </Card>

        {searchError ? (
          <div className="rounded-xl border border-amber-7/30 bg-amber-2/40 p-4" data-testid="buyer-gateway-unavailable">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-10" />
              <div>
                <div className="text-sm font-semibold text-dls-text">买家数据服务尚未启用</div>
                <div className="mt-1 text-sm leading-6 text-dls-secondary">{searchError}</div>
                <div className="mt-2 text-xs text-dls-secondary">没有返回演示联系人，也没有产生 RenCredit 扣费。</div>
              </div>
            </div>
          </div>
        ) : null}

        {releaseNotice ? (
          <div className="rounded-xl border border-blue-7/30 bg-blue-2/40 p-4" data-testid="buyer-unlock-released">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-blue-10" />
              <div>
                <div className="text-sm font-semibold text-dls-text">未交付有效结果，本次不扣费</div>
                <div className="mt-1 text-sm text-dls-secondary">预留额度已释放，余额没有变化。原因：{releaseReasonLabel(releaseNotice.reason)}</div>
                <div className="mt-2 text-xs text-dls-secondary">回执：{releaseNotice.receipt.receiptId}</div>
              </div>
            </div>
          </div>
        ) : null}

        {evidenceNotice ? (
          <div className="rounded-xl border border-dls-border bg-dls-sidebar p-3 text-xs leading-5 text-dls-secondary">
            {evidenceNotice}
          </div>
        ) : null}

        <section className="space-y-4">
          {companies.map((company) => (
            <CompanyCard key={company.companyId} company={company} unlocked={unlocked} onQuote={(next) => void requestQuote(next)} />
          ))}
        </section>

        {!searching && !searchError && companies.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-dls-border p-10 text-center" data-testid="buyer-growth-empty">
            <Search className="mx-auto size-8 text-dls-secondary" />
            <div className="mt-3 text-sm font-medium text-dls-text">先从免费企业预览开始</div>
            <div className="mt-1 text-xs text-dls-secondary">企业线索、证据等级和脱敏联系人不会消耗 RenCredit。</div>
          </div>
        ) : null}
      </div>

      {selection ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" data-testid="buyer-unlock-confirmation">
          <div className="w-full max-w-lg rounded-2xl border border-dls-border bg-dls-surface p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-dls-text"><Coins className="size-4 text-amber-10" /> RenCredit 解锁确认</div>
                <div className="mt-1 text-xs text-dls-secondary">{selection.company.companyName} · {selection.contact.maskedName} · {selection.contact.role}</div>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={closeQuote} disabled={unlockBusy}><X className="size-4" /></Button>
            </div>

            {quoteBusy ? (
              <div className="my-8 flex items-center justify-center gap-2 text-sm text-dls-secondary"><Loader2 className="size-4 animate-spin" /> 正在获取权威报价…</div>
            ) : null}

            {transactionError ? (
              <div className="mt-4 rounded-xl border border-amber-7/30 bg-amber-2/40 p-3 text-sm leading-6 text-amber-11">{transactionError}</div>
            ) : null}

            {quote ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-dls-border bg-dls-sidebar p-4">
                  <div className="text-xs text-dls-secondary">本次成功交付报价</div>
                  <div className="mt-1 text-2xl font-semibold text-dls-text">{quote.quote.amount} RenCredit</div>
                  <div className="mt-1 text-xs text-dls-secondary">报价有效至 {new Date(quote.quote.expiresAt).toLocaleTimeString()}</div>
                </div>
                <div className="space-y-2 text-sm text-dls-secondary">
                  <div className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-emerald-10" /> 无有效邮箱/电话、超时或隐私停止，不扣费</div>
                  <div className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-emerald-10" /> Workspace 已解锁联系人再次查看、导出或团队复看不重复收费</div>
                  <div className="flex items-start gap-2"><Check className="mt-0.5 size-4 text-emerald-10" /> 只有有效结果成功交付后才结算一次</div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-dls-border p-3">
                  <Checkbox checked={approved} onCheckedChange={setApproved} />
                  <span className="text-sm leading-5 text-dls-text">我确认解锁，并同意在有效联系方式成功交付后按本报价扣除 RenCredit。</span>
                </label>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeQuote} disabled={unlockBusy}>取消</Button>
                  <Button onClick={() => void confirmUnlock()} disabled={!approved || unlockBusy}>
                    {unlockBusy ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                    {unlockBusy ? "正在安全解锁" : "确认解锁"}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
