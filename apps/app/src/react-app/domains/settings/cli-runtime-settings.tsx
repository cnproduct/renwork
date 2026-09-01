/** @jsxImportSource react */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Laptop2, RefreshCw, ShieldCheck } from "lucide-react";

import type {
  OpenworkServerClient,
  RenWorkCliRuntimeStatus,
} from "@/app/lib/openwork-server";
import { Button } from "@/components/ui/button";
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

  useEffect(() => { void refresh(); }, [refresh]);
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

        <SettingsNotice>
          直接运行原始 <code>codex</code> 或 <code>agy</code> 会绕过 RenWork，因此不会生成 RenCredit 收据。Antigravity 在获得可核验的结构化用量事件前保持禁用正式计费。
        </SettingsNotice>
        {error ? <SettingsNotice tone="error">{error}</SettingsNotice> : null}
      </LayoutSectionItem>
    </LayoutSection>
  );
}
