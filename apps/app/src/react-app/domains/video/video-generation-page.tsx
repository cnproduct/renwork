/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, Film, ImagePlus, RefreshCw, ShieldCheck } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { formatRenCredit } from "@openwork/rencredit-metering";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  createDenClient,
  readDenSettings,
  type DenVideoGenerationCapability,
  type DenVideoGenerationInput,
  type DenVideoJob,
  type DenVideoQuote,
} from "@/app/lib/den";

const statusCopy: Record<DenVideoJob["status"], string> = {
  submitted: "已提交",
  running: "生成中",
  succeeded: "已交付",
  failed: "未交付",
};

const PENDING_QUOTE_STORAGE_KEY = "renwork.video.pending-quote";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function idempotencyKey() {
  return `video-${crypto.randomUUID()}`;
}

function JobReceiptCard(props: {
  activeJob: DenVideoJob | null;
  jobs: DenVideoJob[];
  onRefresh: () => void;
  onOpen: (job: DenVideoJob) => void;
  onSelect: (job: DenVideoJob) => void;
}) {
  return (
    <Card variant="outline">
      <CardHeader><CardTitle>任务与交付凭证</CardTitle><CardDescription>刷新或重新打开后，会恢复同一个任务。</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {props.activeJob ? (
          <div data-testid="video-job-receipt" className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-sm font-medium">{props.activeJob.status === "succeeded" ? <CheckCircle2 className="size-4 text-emerald-500" /> : <Clock3 className="size-4" />}{statusCopy[props.activeJob.status]}</span><Button size="icon-xs" variant="ghost" onClick={props.onRefresh}><RefreshCw className="size-3.5" /></Button></div>
            <dl className="grid gap-2 text-xs text-muted-foreground"><div><dt>任务哈希</dt><dd className="truncate font-mono text-foreground">{props.activeJob.taskHash}</dd></div>{props.activeJob.resultHash ? <div><dt>结果哈希</dt><dd className="truncate font-mono text-foreground">{props.activeJob.resultHash}</dd></div> : null}<div><dt>结算</dt><dd className="text-foreground">冻结 {formatRenCredit(props.activeJob.reservedMicroCredits)} · 已结算 {formatRenCredit(props.activeJob.capturedMicroCredits)}</dd></div></dl>
            {props.activeJob.status === "succeeded" ? <p className="text-xs text-muted-foreground">AI 生成内容，发布前核验并保留法定及供应商要求的标识。</p> : null}
            {props.activeJob.assetUrl ? <Button variant="link" className="h-auto justify-start px-0" onClick={() => { if (props.activeJob) props.onOpen(props.activeJob); }}>下载租户成片资产</Button> : null}
          </div>
        ) : <p className="py-8 text-center text-sm text-muted-foreground">暂无任务。</p>}
        {props.jobs.length > 1 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {props.jobs.map((job) => (
              <Button key={job.id} size="sm" variant={job.id === props.activeJob?.id ? "secondary" : "outline"} onClick={() => props.onSelect(job)}>
                {statusCopy[job.status]} · {new Date(job.createdAt).toLocaleDateString()}
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function VideoGenerationPage() {
  const navigate = useNavigate();
  const { workspaceId } = useParams();
  const settings = readDenSettings();
  const organizationId = settings.activeOrgId;
  const client = useMemo(() => createDenClient({ baseUrl: settings.baseUrl, token: settings.authToken }), [settings.authToken, settings.baseUrl]);
  const [capability, setCapability] = useState<DenVideoGenerationCapability | null>(null);
  const [mode, setMode] = useState<DenVideoGenerationInput["mode"]>("text_to_video");
  const [durationSeconds, setDurationSeconds] = useState(6);
  const [aspectRatio, setAspectRatio] = useState<DenVideoGenerationInput["aspectRatio"]>("16:9");
  const [prompt, setPrompt] = useState("");
  const [firstFrameAssetId, setFirstFrameAssetId] = useState<string | null>(null);
  const [quote, setQuote] = useState<DenVideoQuote | null>(null);
  const [quoteIdempotencyKey, setQuoteIdempotencyKey] = useState<string | null>(null);
  const [jobs, setJobs] = useState<DenVideoJob[]>([]);
  const [activeJob, setActiveJob] = useState<DenVideoJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    const [nextCapability, nextJobs] = await Promise.all([
      client.getVideoGenerationCapability(organizationId),
      client.listVideoGenerationJobs(organizationId).catch(() => []),
    ]);
    setCapability(nextCapability);
    setJobs(nextJobs);
    setActiveJob((current) => current ? nextJobs.find((job) => job.id === current.id) ?? current : nextJobs[0] ?? null);
  }, [client, organizationId]);

  useEffect(() => {
    void refresh().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "暂时无法读取生视频能力。"));
  }, [refresh]);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.sessionStorage.getItem(PENDING_QUOTE_STORAGE_KEY) ?? "null");
      if (!isRecord(stored) || stored.organizationId !== organizationId || !isRecord(stored.quote) || typeof stored.idempotencyKey !== "string") return;
      const candidate = stored.quote;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.amountMicroCredits !== "number"
        || typeof candidate.priceVersion !== "string"
        || typeof candidate.expiresAt !== "string"
        || !isRecord(candidate.direction)
        || typeof candidate.direction.directedPrompt !== "string"
        || !Array.isArray(candidate.direction.assetRoles)
        || !Array.isArray(candidate.direction.acceptanceCriteria)
        || Date.parse(candidate.expiresAt) <= Date.now()
      ) {
        window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
        return;
      }
      const assetRoles = candidate.direction.assetRoles.flatMap((role) => isRecord(role) && role.role === "first_frame" && typeof role.assetId === "string"
        ? [{ role: "first_frame" as const, assetId: role.assetId }]
        : []);
      const acceptanceCriteria = candidate.direction.acceptanceCriteria.filter((criterion): criterion is string => typeof criterion === "string");
      setQuote({
        id: candidate.id,
        amountMicroCredits: candidate.amountMicroCredits,
        priceVersion: candidate.priceVersion,
        expiresAt: candidate.expiresAt,
        direction: { directedPrompt: candidate.direction.directedPrompt, assetRoles, acceptanceCriteria },
      });
      setQuoteIdempotencyKey(stored.idempotencyKey);
    } catch {
      window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !capability?.enabled || !activeJob || (activeJob.status !== "submitted" && activeJob.status !== "running")) return;
    const poll = () => {
      void client.getVideoGenerationJob(organizationId, activeJob.id).then((job) => {
        setActiveJob(job);
        setJobs((current) => [job, ...current.filter((entry) => entry.id !== job.id)]);
      }).catch(() => undefined);
    };
    const timer = window.setInterval(poll, 5_000);
    return () => window.clearInterval(timer);
  }, [activeJob, capability?.enabled, client, organizationId]);

  const activeTaskExists = jobs.some((job) => job.status === "submitted" || job.status === "running");
  const canQuote = prompt.trim().length > 0 && (mode === "text_to_video" || firstFrameAssetId !== null) && !activeTaskExists;

  function discardQuote() {
    setQuote(null);
    setQuoteIdempotencyKey(null);
    window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
  }

  async function uploadFirstFrame(file: File | null) {
    if (!organizationId || !file) return;
    setBusy(true);
    setError(null);
    discardQuote();
    try {
      const asset = await client.uploadVideoFirstFrame(organizationId, file);
      setFirstFrameAssetId(asset.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "首帧上传失败。请使用清晰的 PNG、JPEG 或 WebP 图片。仅当前租户可使用此素材。 ");
    } finally {
      setBusy(false);
    }
  }

  async function requestQuote() {
    if (!organizationId || !canQuote) return;
    setBusy(true);
    setError(null);
    try {
      const next = await client.createVideoGenerationQuote(organizationId, {
        mode,
        resolution: "768P",
        durationSeconds,
        aspectRatio,
        prompt: prompt.trim(),
        ...(mode === "first_frame_to_video" && firstFrameAssetId ? { firstFrameAssetId } : {}),
      });
      const key = idempotencyKey();
      setQuote(next);
      setQuoteIdempotencyKey(key);
      window.sessionStorage.setItem(PENDING_QUOTE_STORAGE_KEY, JSON.stringify({ organizationId, quote: next, idempotencyKey: key }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "生成方案校验失败。额度尚未冻结。 ");
    } finally {
      setBusy(false);
    }
  }

  async function confirmGeneration() {
    if (!organizationId || !quote || !quoteIdempotencyKey) return;
    setBusy(true);
    setError(null);
    try {
      const result = await client.createVideoGenerationJob(organizationId, quote.id, quoteIdempotencyKey);
      setActiveJob(result.job);
      setJobs((current) => [result.job, ...current.filter((job) => job.id !== result.job.id)]);
      setQuote(null);
      setQuoteIdempotencyKey(null);
      window.sessionStorage.removeItem(PENDING_QUOTE_STORAGE_KEY);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "任务提交失败。未形成有效交付时，冻结额度会自动释放。 ");
    } finally {
      setBusy(false);
    }
  }

  async function openDeliveredAsset(job: DenVideoJob) {
    if (!organizationId || !job.assetUrl) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await client.downloadVideoGenerationAsset(organizationId, job.assetUrl);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `renwork-h3-${job.id}.${blob.type === "video/webm" ? "webm" : "mp4"}`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "成片资产暂时无法打开。");
    } finally {
      setBusy(false);
    }
  }

  if (!organizationId) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">请先登录并选择工作区。</div>;
  }

  return (
    <main data-testid="video-generation-page" className="min-h-screen bg-background px-5 py-6 text-foreground md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="返回任务" onClick={() => navigate(workspaceId ? `/workspace/${encodeURIComponent(workspaceId)}/session` : "/session")}>
              <ArrowLeft className="size-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2"><Film className="size-5" /><h1 className="font-heading text-2xl font-semibold">AI 生视频</h1></div>
              <p className="mt-1 text-sm text-muted-foreground">H3 Director · 单路由灰度 · 先报价、后冻结、交付后结算</p>
            </div>
          </div>
          <Badge variant="outline"><ShieldCheck /> 租户隔离</Badge>
        </header>

        {capability && !capability.enabled ? (
          <div className="space-y-6">
            <Card variant="outline"><CardHeader><CardTitle>新生成已暂停</CardTitle><CardDescription>当前工作区不能创建或推进任务；历史任务与已交付成片仍可查看和下载。</CardDescription></CardHeader></Card>
            <JobReceiptCard activeJob={activeJob} jobs={jobs} onRefresh={() => void refresh()} onOpen={(job) => void openDeliveredAsset(job)} onSelect={setActiveJob} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>1. 定义镜头</CardTitle>
                <CardDescription>第一阶段固定 768P、4–8 秒，每位成员同时只运行一个任务。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={mode === "text_to_video" ? "default" : "outline"} onClick={() => { setMode("text_to_video"); discardQuote(); }}>文生视频</Button>
                  <Button variant={mode === "first_frame_to_video" ? "default" : "outline"} onClick={() => { setMode("first_frame_to_video"); discardQuote(); }}>首帧生视频</Button>
                </div>
                {mode === "first_frame_to_video" ? (
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-dashed border-border px-4 py-4 text-sm">
                    <span className="flex items-center gap-2"><ImagePlus className="size-4" />{firstFrameAssetId ? "首帧已进入当前租户素材库" : "上传首帧图片"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadFirstFrame(event.target.files?.[0] ?? null)} />
                    <Badge variant={firstFrameAssetId ? "secondary" : "outline"}>{firstFrameAssetId ? "已校验" : "必需"}</Badge>
                  </label>
                ) : null}
                <div>
                  <label className="mb-2 block text-sm font-medium" htmlFor="video-prompt">画面意图</label>
                  <Textarea id="video-prompt" value={prompt} onChange={(event) => { setPrompt(event.target.value); discardQuote(); }} placeholder="例如：精密仪器置于深色展台，镜头缓慢环绕，金属细节被轮廓光依次点亮……" className="min-h-32" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium">时长
                    <select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={durationSeconds} onChange={(event) => { setDurationSeconds(Number(event.target.value)); discardQuote(); }}>
                      {[4, 5, 6, 7, 8].map((seconds) => <option key={seconds} value={seconds}>{seconds} 秒</option>)}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium">画幅
                    <select className="h-10 w-full rounded-lg border border-border bg-background px-3" value={aspectRatio} onChange={(event) => { const value = event.target.value; if (value === "16:9" || value === "9:16" || value === "1:1") setAspectRatio(value); discardQuote(); }}>
                      <option value="16:9">16:9 横屏</option><option value="9:16">9:16 竖屏</option><option value="1:1">1:1 方形</option>
                    </select>
                  </label>
                </div>
                {activeTaskExists ? <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">已有任务运行中。完成或释放后才能提交下一条。</p> : null}
                {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
              </CardContent>
              <CardFooter className="justify-end"><Button disabled={!canQuote || busy || capability === null} onClick={() => void requestQuote()}>{busy ? "校验中…" : "生成方案与报价"}</Button></CardFooter>
            </Card>

            <div className="space-y-6">
              <Card variant="outline">
                <CardHeader><CardTitle>2. 确认方案与报价</CardTitle><CardDescription>确认之前不会冻结 RenCredit。</CardDescription></CardHeader>
                <CardContent>
                  {quote ? (
                    <div className="space-y-4">
                      <div data-testid="video-rencredit-quote" className="rounded-2xl bg-muted p-4"><p className="text-xs text-muted-foreground">本次最多冻结</p><p className="mt-1 text-2xl font-semibold tabular-nums">{formatRenCredit(quote.amountMicroCredits)} RenCredit</p></div>
                      <div><p className="text-xs font-medium text-muted-foreground">Director 镜头提示</p><p className="mt-1 text-sm leading-6">{quote.direction.directedPrompt}</p></div>
                      <ul className="space-y-1 text-xs text-muted-foreground">{quote.direction.acceptanceCriteria.map((criterion) => <li key={criterion}>• {criterion}</li>)}</ul>
                      <Button data-testid="video-generate-confirm" className="w-full" disabled={busy} onClick={() => void confirmGeneration()}>{busy ? "正在确认…" : "确认并冻结额度"}</Button>
                    </div>
                  ) : <p className="py-10 text-center text-sm text-muted-foreground">完成左侧设置并生成报价。</p>}
                </CardContent>
              </Card>

              <JobReceiptCard activeJob={activeJob} jobs={jobs} onRefresh={() => void refresh()} onOpen={(job) => void openDeliveredAsset(job)} onSelect={setActiveJob} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
