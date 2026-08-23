/** @jsxImportSource react */
import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Copy,
  Cpu,
  Globe,
  KeyRound,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import type { OpenworkServerClient, CustomProviderRecord, CustomModelDefinition } from "@/app/lib/openwork-server";

export type CustomProvidersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: OpenworkServerClient | null;
  onProvidersChanged?: () => void;
};

type ProviderType = "ollama" | "openrouter" | "openai-compatible";

const OPENROUTER_PRESETS = [
  { id: "stealth/ox-alpha", name: "Ox Alpha (OpenRouter)", context: 128000 },
  { id: "anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet (OpenRouter)", context: 200000 },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1 (OpenRouter)", context: 128000 },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3 (OpenRouter)", context: 128000 },
  { id: "openai/gpt-4o", name: "GPT-4o (OpenRouter)", context: 128000 },
];

export function CustomProvidersDialog({
  open,
  onOpenChange,
  client,
  onProvidersChanged,
}: CustomProvidersDialogProps) {
  const queryClient = useQueryClient();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedType, setSelectedType] = useState<ProviderType>("openrouter");
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Form State
  const [providerId, setProviderId] = useState("");
  const [providerName, setProviderName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<CustomModelDefinition[]>([]);

  // Testing & Scanning state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latency?: number } | null>(null);
  const [isScanningOllama, setIsScanningOllama] = useState(false);
  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);

  // Query custom providers list
  const { data: providersData, isLoading: isLoadingProviders, refetch: refetchProviders } = useQuery({
    queryKey: ["custom-providers"],
    queryFn: async () => {
      if (!client) return { providers: [] };
      return client.listCustomProviders();
    },
    enabled: open && Boolean(client),
  });

  const providers = providersData?.providers ?? [];

  // Reset form when type changes or opening add mode
  const initFormForType = (type: ProviderType) => {
    setSelectedType(type);
    setTestResult(null);
    if (type === "ollama") {
      setProviderId("ollama");
      setProviderName("Ollama (本地模型)");
      setBaseURL("http://127.0.0.1:11434/v1");
      setApiKey("");
      setModels([]);
      void handleScanOllama("http://127.0.0.1:11434");
    } else if (type === "openrouter") {
      setProviderId("openrouter_custom");
      setProviderName("OpenRouter");
      setBaseURL("https://openrouter.ai/api/v1");
      setApiKey("");
      setModels([
        {
          id: "stealth/ox-alpha",
          name: "Ox Alpha (OpenRouter)",
          contextLimit: 128000,
          outputLimit: 8192,
          modalities: ["text"],
        },
      ]);
    } else {
      setProviderId("custom_openai");
      setProviderName("OpenAI 兼容供应商");
      setBaseURL("https://api.siliconflow.cn/v1");
      setApiKey("");
      setModels([
        {
          id: "deepseek-ai/DeepSeek-V3",
          name: "DeepSeek V3",
          contextLimit: 64000,
          outputLimit: 8192,
          modalities: ["text"],
        },
      ]);
    }
  };

  const startAddProvider = (type: ProviderType = "openrouter") => {
    setIsAddingNew(true);
    initFormForType(type);
  };

  const startEditProvider = (prov: CustomProviderRecord) => {
    setIsAddingNew(true);
    setSelectedType(prov.type);
    setProviderId(prov.id);
    setProviderName(prov.name);
    setBaseURL(prov.baseURL);
    setApiKey(prov.apiKey ?? "");
    setModels(prov.models);
    setTestResult(null);
  };

  const handleScanOllama = async (host?: string) => {
    if (!client) return;
    setIsScanningOllama(true);
    try {
      const res = await client.scanOllamaModels(host || baseURL);
      setOllamaRunning(res.running);
      if (res.running && res.models.length > 0) {
        setModels(
          res.models.map((m) => ({
            id: m.id,
            name: `${m.name} (本地)`,
            contextLimit: m.contextLimit ?? 262144,
            outputLimit: m.outputLimit ?? 32768,
            modalities: m.modalities ?? ["text", "image"],
          })),
        );
        toast.success(`扫描到 ${res.models.length} 个本地 Ollama 模型！`);
      } else if (!res.running) {
        toast.error("未检测到运行中的 Ollama 服务，请确认 Ollama 已启动 (http://127.0.0.1:11434)");
      }
    } catch (e) {
      setOllamaRunning(false);
      toast.error(e instanceof Error ? e.message : "扫描 Ollama 失败");
    } finally {
      setIsScanningOllama(false);
    }
  };

  const handleTestConnection = async () => {
    if (!client) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const firstModelId = models[0]?.id;
      const res = await client.testCustomProvider({
        type: selectedType,
        baseURL,
        apiKey: apiKey.trim(),
        modelId: firstModelId,
      });
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `连接成功！延迟 ${res.latencyMs}ms${res.modelsCount ? `，检测到 ${res.modelsCount} 个可用模型` : ""}`,
          latency: res.latencyMs,
        });
        toast.success(`测试通过 (${res.latencyMs}ms)`);
      } else {
        setTestResult({
          ok: false,
          message: res.error || "连接测试失败",
          latency: res.latencyMs,
        });
        toast.error(`测试失败: ${res.error?.slice(0, 100)}`);
      }
    } catch (e) {
      setTestResult({
        ok: false,
        message: e instanceof Error ? e.message : "连接请求异常",
      });
      toast.error("测试异常");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!client) return;
    if (!providerId.trim()) {
      toast.error("请输入供应商标识 ID");
      return;
    }
    if (models.length === 0) {
      toast.error("请至少添加一个模型");
      return;
    }

    try {
      await client.saveCustomProvider({
        id: providerId.trim(),
        name: providerName.trim() || providerId.trim(),
        type: selectedType,
        baseURL: baseURL.trim(),
        apiKey: apiKey.trim(),
        models,
      });

      toast.success(`已保存供应商「${providerName || providerId}」及 ${models.length} 个模型`);
      setIsAddingNew(false);
      await refetchProviders();
      onProvidersChanged?.();
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存供应商配置失败");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!client) return;
    try {
      await client.deleteCustomProvider(id);
      toast.success(`已删除供应商「${name || id}」`);
      await refetchProviders();
      onProvidersChanged?.();
      queryClient.invalidateQueries({ queryKey: ["providers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    }
  };

  const handleAddModelRow = () => {
    setModels([
      ...models,
      {
        id: `model-${Date.now()}`,
        name: `新模型`,
        contextLimit: 128000,
        outputLimit: 8192,
        modalities: ["text"],
      },
    ]);
  };

  const handleUpdateModelRow = (index: number, patch: Partial<CustomModelDefinition>) => {
    setModels(models.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const handleRemoveModelRow = (index: number) => {
    setModels(models.filter((_, i) => i !== index));
  };

  const handleSelectOpenRouterPreset = (preset: (typeof OPENROUTER_PRESETS)[0]) => {
    if (models.some((m) => m.id === preset.id)) {
      toast.info(`模型 ${preset.name} 已在列表中`);
      return;
    }
    setModels([
      ...models,
      {
        id: preset.id,
        name: preset.name,
        contextLimit: preset.context,
        outputLimit: 8192,
        modalities: ["text"],
      },
    ]);
    toast.success(`已添加预设模型：${preset.name}`);
  };

  const copyErrorToClipboard = () => {
    if (testResult?.message) {
      void navigator.clipboard.writeText(testResult.message);
      toast.success("已复制错误信息到剪贴板");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col p-0 gap-0 overflow-hidden transition-all duration-200 bg-background",
          isFullscreen
            ? "fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none z-50 border-0"
            : "w-[94vw] max-w-5xl h-[88vh] rounded-2xl border border-border shadow-2xl",
        )}
      >
        {/* =================== Fixed Header =================== */}
        <DialogHeader className="shrink-0 px-6 py-4 border-b border-border bg-card/80 backdrop-blur flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">自定义大模型与供应商管理</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                对接 Ollama 本地私有大模型、OpenRouter 聚合平台及任意 OpenAI-Compatible API
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "还原窗口大小" : "全屏最大化"}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* =================== Scrollable Body =================== */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6 bg-background">
          {!isAddingNew ? (
            /* =================== List View =================== */
            <div className="space-y-5 max-w-4xl mx-auto">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">已接入的自定义供应商与模型</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    已配置的模型会自动显示在输入框模型选择器中，可随时切换使用
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => startAddProvider("ollama")} className="h-8 gap-1.5 text-xs">
                    <Bot className="size-3.5 text-amber-500" />
                    + Ollama 本地模型
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => startAddProvider("openrouter")} className="h-8 gap-1.5 text-xs">
                    <Zap className="size-3.5 text-blue-500" />
                    + OpenRouter (Ox Alpha)
                  </Button>
                  <Button size="sm" onClick={() => startAddProvider("openai-compatible")} className="h-8 gap-1.5 text-xs">
                    <Plus className="size-3.5" />
                    + 自定义通用 API
                  </Button>
                </div>
              </div>

              {isLoadingProviders ? (
                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-4 animate-spin" /> 加载供应商配置中...
                </div>
              ) : providers.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 px-4 text-center bg-card/40">
                  <Server className="size-12 text-muted-foreground/40 mb-3" />
                  <h4 className="text-sm font-semibold text-foreground">暂无自定义模型</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    点击右上角按钮即可极速添加本地 Ollama、OpenRouter (Ox Alpha) 或硅基流动 / DeepSeek 等 OpenAI 兼容服务
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {providers.map((prov) => (
                    <div
                      key={prov.id}
                      className="flex flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                              {prov.type === "ollama" ? (
                                <Bot className="size-5 text-amber-500" />
                              ) : prov.type === "openrouter" ? (
                                <Zap className="size-5 text-blue-500" />
                              ) : (
                                <Globe className="size-5 text-emerald-500" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground truncate">{prov.name}</span>
                                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                                  {prov.type === "ollama" ? "本地 Ollama" : prov.type === "openrouter" ? "OpenRouter" : "OpenAI 兼容"}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                                {prov.baseURL}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => startEditProvider(prov)}
                            >
                              编辑
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              onClick={() => void handleDelete(prov.id, prov.name)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {prov.models.map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/80 px-2.5 py-1 text-xs text-secondary-foreground"
                            >
                              <Cpu className="size-3 text-muted-foreground" />
                              <span className="font-medium">{m.name || m.id}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* =================== Form Add/Edit View =================== */
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Type selector tabs */}
              <div className="flex items-center gap-2 p-1.5 bg-muted/60 rounded-xl">
                <button
                  type="button"
                  onClick={() => initFormForType("openrouter")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-medium transition-all",
                    selectedType === "openrouter"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Zap className="size-4 text-blue-500" />
                  OpenRouter 聚合平台 (Ox Alpha)
                </button>
                <button
                  type="button"
                  onClick={() => initFormForType("ollama")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-medium transition-all",
                    selectedType === "ollama"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Bot className="size-4 text-amber-500" />
                  Ollama 本地私有模型
                </button>
                <button
                  type="button"
                  onClick={() => initFormForType("openai-compatible")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-medium transition-all",
                    selectedType === "openai-compatible"
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Globe className="size-4 text-emerald-500" />
                  OpenAI 兼容协议 (硅基流动/DeepSeek等)
                </button>
              </div>

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: Provider Settings (5 cols) */}
                <div className="lg:col-span-5 space-y-4 rounded-2xl border border-border bg-card p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    1. 供应商连接参数
                  </h4>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">供应商显示名称</Label>
                    <Input
                      value={providerName}
                      onChange={(e) => setProviderName(e.target.value)}
                      placeholder="例如: OpenRouter, 本地 Ollama, 硅基流动"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">供应商标识 (Provider ID)</Label>
                    <Input
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      placeholder="例如: openrouter_custom, ollama"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">API Base URL</Label>
                      {selectedType === "ollama" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleScanOllama()}
                          disabled={isScanningOllama}
                          className="h-6 text-[11px] gap-1 text-primary hover:bg-primary/10"
                        >
                          <RefreshCw className={cn("size-3", isScanningOllama && "animate-spin")} />
                          扫描本地模型
                        </Button>
                      ) : null}
                    </div>
                    <Input
                      value={baseURL}
                      onChange={(e) => setBaseURL(e.target.value)}
                      placeholder={
                        selectedType === "ollama"
                          ? "http://127.0.0.1:11434/v1"
                          : selectedType === "openrouter"
                            ? "https://openrouter.ai/api/v1"
                            : "https://api.siliconflow.cn/v1"
                      }
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  {selectedType !== "ollama" ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">API Key / 密钥</Label>
                        <span className="text-[11px] text-muted-foreground">客户端安全加密</span>
                      </div>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={selectedType === "openrouter" ? "sk-or-v1-..." : "sk-..."}
                        className="h-9 text-xs font-mono"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3 text-xs">
                      <div className="flex items-center gap-2">
                        <Bot className="size-4 text-amber-500" />
                        <span>服务状态:</span>
                        {ollamaRunning === true ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 className="size-3.5" /> 运行正常
                          </span>
                        ) : ollamaRunning === false ? (
                          <span className="inline-flex items-center gap-1 text-destructive font-medium">
                            <XCircle className="size-3.5" /> 未连接
                          </span>
                        ) : (
                          <span className="text-muted-foreground">检测中...</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Test Connection Action Card */}
                  <div className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTesting || !baseURL}
                      className="w-full h-9 text-xs gap-1.5 font-medium border-primary/30 text-primary hover:bg-primary/10"
                    >
                      {isTesting ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                      一键测试连接与鉴权 (Test Connection)
                    </Button>
                  </div>

                  {/* Test Result Display Banner (Wrapped & Scrollable) */}
                  {testResult ? (
                    <div
                      className={cn(
                        "rounded-xl p-3 text-xs space-y-2",
                        testResult.ok
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold">
                          {testResult.ok ? (
                            <CheckCircle2 className="size-4 shrink-0" />
                          ) : (
                            <XCircle className="size-4 shrink-0" />
                          )}
                          <span>{testResult.ok ? "测试连接通过" : "连接或鉴权失败"}</span>
                        </div>
                        {!testResult.ok ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={copyErrorToClipboard}
                            className="h-6 text-[11px] px-2 gap-1 text-destructive hover:bg-destructive/20"
                          >
                            <Copy className="size-3" /> 复制报错
                          </Button>
                        ) : null}
                      </div>

                      <div className="max-h-28 overflow-y-auto break-all font-mono text-[11px] leading-relaxed p-2 rounded bg-background/60 border border-border/40">
                        {testResult.message}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Right Column: Model Configuration (7 cols) */}
                <div className="lg:col-span-7 space-y-4 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      2. 配置模型列表 ({models.length} 个)
                    </h4>
                    <Button variant="ghost" size="sm" onClick={handleAddModelRow} className="h-7 text-xs gap-1 text-primary">
                      <Plus className="size-3.5" /> 添加模型行
                    </Button>
                  </div>

                  {/* OpenRouter Presets Quick Bar */}
                  {selectedType === "openrouter" ? (
                    <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                      <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        ⚡ OpenRouter 推荐热门模型（点击一键加入）:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {OPENROUTER_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => handleSelectOpenRouterPreset(preset)}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors",
                              preset.id === "stealth/ox-alpha"
                                ? "bg-blue-600 text-white font-medium shadow-sm hover:bg-blue-700"
                                : "bg-background border border-border hover:bg-accent text-foreground",
                            )}
                          >
                            {preset.id === "stealth/ox-alpha" ? "🔥 " : ""}
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Model Items Table */}
                  <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                    {models.map((model, idx) => (
                      <div
                        key={idx}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-xl border border-border bg-background/80 p-3 text-xs"
                      >
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] text-muted-foreground">模型 ID (API 标识)</span>
                          <Input
                            value={model.id}
                            onChange={(e) => handleUpdateModelRow(idx, { id: e.target.value })}
                            placeholder="如: stealth/ox-alpha, qwen3.5:27b"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="flex-1 space-y-1">
                          <span className="text-[10px] text-muted-foreground">客户端显示名称</span>
                          <Input
                            value={model.name}
                            onChange={(e) => handleUpdateModelRow(idx, { name: e.target.value })}
                            placeholder="如: Ox Alpha (OpenRouter)"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="w-28 space-y-1">
                          <span className="text-[10px] text-muted-foreground">上下文大小</span>
                          <Input
                            type="number"
                            value={model.contextLimit || 128000}
                            onChange={(e) => handleUpdateModelRow(idx, { contextLimit: Number(e.target.value) })}
                            placeholder="Tokens"
                            className="h-8 text-xs text-right font-mono"
                          />
                        </div>
                        <div className="flex items-end pb-0.5 sm:pt-4">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveModelRow(idx)}
                            className="size-8 text-muted-foreground hover:text-destructive rounded-lg"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* =================== Fixed Bottom Footer =================== */}
        <div className="shrink-0 px-6 py-4 border-t border-border bg-card/80 backdrop-blur flex items-center justify-between">
          {isAddingNew ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsAddingNew(false)}>
                返回列表
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-1.5 px-5">
                <CheckCircle2 className="size-4" />
                保存并生效配置
              </Button>
            </>
          ) : (
            <div className="flex w-full items-center justify-between">
              <span className="text-xs text-muted-foreground">
                提示：添加或修改模型后会自动热加载生效
              </span>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                完成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
