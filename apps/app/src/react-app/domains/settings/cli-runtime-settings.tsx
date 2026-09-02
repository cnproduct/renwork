/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Laptop2, Play, RefreshCw, ShieldCheck, Square } from "lucide-react";

import type {
  OpenworkServerClient,
  RenWorkCliRun,
  RenWorkCliRuntimeStatus,
} from "@/app/lib/openwork-server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SettingsNotice, SettingsStatusBadge } from "./settings-section";
import {
  LayoutSection,
  LayoutSectionDescription,
  LayoutSectionHeader,
  LayoutSectionItem,
  LayoutSectionItemHeader,
  LayoutSectionItemTitle,
  LayoutSectionTitle,
} from "./settings-layout";

export function CliRuntimeSettings(props: {
  client: OpenworkServerClient | null;
  workspaceId: string | null;
}) {
  const [runtimes, setRuntimes] = useState<RenWorkCliRuntimeStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelSku, setModelSku] = useState("renwork-codex");
  const [prompt, setPrompt] = useState("");
  const [run, setRun] = useState<RenWorkCliRun | null>(null);
  const [runBusy, setRunBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!props.client || !props.workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setRuntimes((await props.client.listCliRuntimes()).runtimes);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法读取本机 CLI 状态。");
    } finally {
      setLoading(false);
    }
  }, [props.client, props.workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!props.client || !props.workspaceId || !run || !["running", "settling"].includes(run.state)) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const next = await props.client!.getCliRuntimeRun(props.workspaceId!, run.runId);
        if (!cancelled) setRun(next);
      } catch (nextError) {
        if (!cancelled) setError(nextError instanceof Error ? nextError.message : "无法读取 RenCredit 结算进度。");
      }
    };
    const timer = window.setInterval(() => void poll(), 750);
    void poll();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [props.client, props.workspaceId, run?.runId, run?.state]);

  const start = useCallback(async () => {
    if (!props.client || !props.workspaceId || !modelSku.trim() || !prompt.trim()) return;
    setRunBusy(true);
    setError(null);
    try {
      setRun(await props.client.startCliRuntimeRun(props.workspaceId, "codex", {
        modelSku: modelSku.trim(),
        prompt: prompt.trim(),
      }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Codex 计费任务启动失败。");
    } finally {
      setRunBusy(false);
    }
  }, [modelSku, prompt, props.client, props.workspaceId]);

  const cancel = useCallback(async () => {
    if (!props.client || !props.workspaceId || !run) return;
    setRunBusy(true);
    try {
      setRun(await props.client.cancelCliRuntimeRun(props.workspaceId, run.runId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "无法取消任务并释放冻结额度。");
    } finally {
      setRunBusy(false);
    }
  }, [props.client, props.workspaceId, run]);
  if (!props.client || !props.workspaceId) return null;

  return (
    <LayoutSection>
      <LayoutSectionHeader>
        <LayoutSectionTitle>RenWork CLI 统一计费入口</LayoutSectionTitle>
        <LayoutSectionDescription>
          只有从 RenWork 入口启动的 CLI 任务才会先冻结 RenCredit，并按官方结构化 Token 用量结算。
        </LayoutSectionDescription>
      </LayoutSectionHeader>

      <LayoutSectionItem className="gap-4 rounded-2xl border border-dls-border px-4 py-4">
        <LayoutSectionItemHeader>
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-blue-6 bg-blue-2 text-blue-11">
              <Laptop2 className="size-4" />
            </div>
            <div className="min-w-0">
              <LayoutSectionItemTitle>本机执行适配器</LayoutSectionItemTitle>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                OAuth 凭据继续由 Codex 或 Antigravity 自己保存在本机；RenWork 只接收模型 SKU、签名用量收据与结算结果。
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
            <RefreshCw className={`mr-1.5 size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        </LayoutSectionItemHeader>

        <div className="grid gap-2 sm:grid-cols-2">
          {runtimes.map((runtime) => (
            <div key={runtime.runtime} className="rounded-xl border border-dls-border bg-dls-surface px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-dls-text">
                  {runtime.runtime === "codex" ? "OpenAI Codex CLI" : "Google Antigravity CLI"}
                </span>
                <SettingsStatusBadge
                  tone={runtime.meteredExecutionReady ? "ready" : runtime.installed ? "warning" : "neutral"}
                  label={runtime.meteredExecutionReady ? "可计费运行" : runtime.installed ? "待适配" : "未安装"}
                />
              </div>
              <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                {runtime.meteredExecutionReady
                  ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-10" />
                  : <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-10" />}
                <span>{runtime.message}</span>
              </div>
              {runtime.version ? <div className="mt-2 truncate font-mono text-[10px] text-muted-foreground">{runtime.version}</div> : null}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-dls-border bg-dls-sidebar/30 px-3 py-3">
          <div className="flex items-center gap-2 text-xs font-medium text-dls-text">
            <ShieldCheck className="size-3.5 text-blue-10" />
            推荐命令
          </div>
          <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg bg-dls-surface px-3 py-2 text-xs text-dls-text">
            renwork codex --model &lt;RenWork模型SKU&gt; "描述你的任务"
          </code>
        </div>

        <div className="space-y-3 rounded-xl border border-dls-border bg-dls-surface px-3 py-3">
          <div>
            <div className="text-sm font-medium text-dls-text">Codex OAuth 计费测试</div>
            <div className="mt-1 text-xs leading-5 text-muted-foreground">
              启动后先显示冻结额；任务完成后按结构化 Token 用量显示捕获、释放和不可变收据编号。
            </div>
          </div>
          <Input
            value={modelSku}
            onChange={(event) => setModelSku(event.target.value)}
            placeholder="RenWork 模型 SKU"
            disabled={runBusy || run?.state === "running" || run?.state === "settling"}
          />
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="输入一个短测试任务…"
            rows={3}
            disabled={runBusy || run?.state === "running" || run?.state === "settling"}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void start()} disabled={runBusy || !prompt.trim() || !modelSku.trim() || run?.state === "running" || run?.state === "settling"}>
              <Play className="mr-1.5 size-3.5" />运行并计费
            </Button>
            {run && ["running", "settling"].includes(run.state) ? (
              <Button variant="outline" size="sm" onClick={() => void cancel()} disabled={runBusy}>
                <Square className="mr-1.5 size-3.5" />取消并释放
              </Button>
            ) : null}
          </div>

          {run ? (
            <div className="space-y-3 rounded-xl border border-dls-border bg-dls-sidebar/20 px-3 py-3" data-testid="rencredit-cli-live-panel">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SettingsStatusBadge
                  tone={run.state === "succeeded" ? "ready" : run.state === "failed" || run.state === "cancelled" ? "warning" : "neutral"}
                  label={{ running: "执行中", settling: "结算中", succeeded: "已扣费", failed: "失败已释放", cancelled: "已取消" }[run.state]}
                />
                <span className="font-mono text-[10px] text-muted-foreground">
                  不可变预留/收据：{run.reservationId}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div className="rounded-lg border border-dls-border px-2 py-2"><div className="text-muted-foreground">冻结</div><div className="mt-1 font-mono text-dls-text">{run.reservedMicroCredits} μRC</div></div>
                <div className="rounded-lg border border-dls-border px-2 py-2"><div className="text-muted-foreground">实际扣除</div><div className="mt-1 font-mono text-dls-text">{run.settlement?.capturedMicroCredits ?? "—"} μRC</div></div>
                <div className="rounded-lg border border-dls-border px-2 py-2"><div className="text-muted-foreground">释放</div><div className="mt-1 font-mono text-dls-text">{run.settlement?.releasedMicroCredits ?? "—"} μRC</div></div>
                <div className="rounded-lg border border-dls-border px-2 py-2"><div className="text-muted-foreground">状态</div><div className="mt-1 font-mono text-dls-text">{run.settlement?.status ?? run.state}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
                {[
                  ["输入", run.usage?.inputTokens],
                  ["输出", run.usage?.outputTokens],
                  ["推理", run.usage?.reasoningTokens],
                  ["缓存读取", run.usage?.cacheReadTokens],
                  ["缓存写入", run.usage?.cacheWriteTokens],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg bg-dls-surface px-2 py-2">
                    <div className="text-muted-foreground">{label}</div>
                    <div className="mt-1 font-mono text-dls-text">{value ?? "—"} Token</div>
                  </div>
                ))}
              </div>
              {run.errorCode ? <SettingsNotice tone="error">{run.errorCode}</SettingsNotice> : null}
              {run.output ? <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-dls-surface px-3 py-2 text-xs text-dls-text">{run.output}</pre> : null}
            </div>
          ) : null}
        </div>

        <SettingsNotice>
          直接运行原始 <code>codex</code> 或 <code>agy</code> 会绕过 RenWork，因此不会生成 RenCredit 收据。Antigravity 在获得可核验的结构化用量事件前保持禁用正式计费。
        </SettingsNotice>
        {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}
