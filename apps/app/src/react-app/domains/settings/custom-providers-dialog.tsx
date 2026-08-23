/** @jsxImportSource react */
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  Cpu,
  Globe,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      const res = await client.testCustomProvider({
        type: selectedType,
        baseURL,
        apiKey: apiKey.trim(),
      });
      if (res.ok) {
        setTestResult({
          ok: true,
          message: `连接成功！延迟 ${res.latencyMs}ms${res.modelsCount ? `，扫描到 ${res.modelsCount} 个可用模型` : ""}`,
          latency: res.latencyMs,
        });
        toast.success(`测试通过 (${res.latencyMs}ms)`);
      } else {
        setTestResult({
          ok: false,
          message: res.error || "连接测试失败",
          latency: res.latencyMs,
        });
        toast.error(`测试失败: ${res.error}`);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto p-6">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold">自定义大模型与供应商管理</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                支持对接 Ollama 本地私有大模型、OpenRouter 聚合平台及任意 OpenAI-Compatible API
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {!isAddingNew ? (
          /* =================== List View =================== */
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">已配置的自定义模型</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => startAddProvider("ollama")} className="h-8 gap-1 text-xs">
                  <Bot className="size-3.5 text-amber-500" />
                  + Ollama 本地
                </Button>
                <Button variant="outline" size="sm" onClick={() => startAddProvider("openrouter")} className="h-8 gap-1 text-xs">
                  <Zap className="size-3.5 text-blue-500" />
                  + OpenRouter (Ox Alpha)
                </Button>
                <Button size="sm" onClick={() => startAddProvider("openai-compatible")} className="h-8 gap-1 text-xs">
                  <Plus className="size-3.5" />
                  + 自定义通用 API
                </Button>
              </div>
            </div>

            {isLoadingProviders ? (
              <div className="flex h-32 items-center justify-center text-xs text-muted-foreground gap-2">
                <Loader2 className="size-4 animate-spin" /> 加载供应商配置中...
              </div>
            ) : providers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 px-4 text-center">
                <Server className="size-10 text-muted-foreground/40 mb-3" />
                <h4 className="text-sm font-medium text-foreground">暂无自定义模型</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  点击上方按钮快速接入本地 Ollama、OpenRouter (Ox Alpha) 或硅基流动/DeepSeek 等 OpenAI 兼容服务
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((prov) => (
                  <div
                    key={prov.id}
                    className="flex flex-col gap-2 rounded-xl border border-border/80 bg-card p-4 transition-all hover:border-border"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          {prov.type === "ollama" ? (
                            <Bot className="size-4 text-amber-500" />
                          ) : prov.type === "openrouter" ? (
                            <Zap className="size-4 text-blue-500" />
                          ) : (
                            <Globe className="size-4 text-emerald-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground">{prov.name}</span>
                            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {prov.type === "ollama" ? "本地 Ollama" : prov.type === "openrouter" ? "OpenRouter" : "OpenAI 兼容"}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-md font-mono mt-0.5">
                            {prov.baseURL}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => startEditProvider(prov)}
                        >
                          编辑配置
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:bg-destructive/10"
                          onClick={() => void handleDelete(prov.id, prov.name)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {prov.models.map((m) => (
                        <span
                          key={m.id}
                          className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-xs text-secondary-foreground"
                        >
                          <Cpu className="size-3 text-muted-foreground" />
                          {m.name || m.id}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* =================== Form Add/Edit View =================== */
          <div className="space-y-5 py-2">
            {/* Type selector tabs */}
            <div className="flex items-center gap-2 p-1 bg-muted/60 rounded-xl">
              <button
                type="button"
                onClick={() => initFormForType("openrouter")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                  selectedType === "openrouter"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Zap className="size-3.5 text-blue-500" />
                OpenRouter (Ox Alpha)
              </button>
              <button
                type="button"
                onClick={() => initFormForType("ollama")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                  selectedType === "ollama"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Bot className="size-3.5 text-amber-500" />
                Ollama 本地模型
              </button>
              <button
                type="button"
                onClick={() => initFormForType("openai-compatible")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all",
                  selectedType === "openai-compatible"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Globe className="size-3.5 text-emerald-500" />
                OpenAI 兼容协议
              </button>
            </div>

            {/* Provider Basics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">供应商名称 (Display Name)</Label>
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
            </div>

            {/* Base URL & API Key */}
            <div className="space-y-3">
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
                      重新扫描本地模型
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
                    <span className="text-[11px] text-muted-foreground">已在客户端安全隔离</span>
                  </div>
                  <div className="relative">
                    <Input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={selectedType === "openrouter" ? "sk-or-v1-..." : "sk-..."}
                      className="h-9 text-xs font-mono pe-20"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestConnection}
                      disabled={isTesting || !baseURL}
                      className="absolute right-1 top-1 h-7 text-[11px] px-2.5 gap-1"
                    >
                      {isTesting ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                      测试连接
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-amber-500" />
                    <span>Ollama 本地服务状态:</span>
                    {ollamaRunning === true ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircle2 className="size-3.5" /> 正常运行中
                      </span>
                    ) : ollamaRunning === false ? (
                      <span className="inline-flex items-center gap-1 text-destructive font-medium">
                        <XCircle className="size-3.5" /> 未连接 (请确认 ollama serve 已启动)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">检测中...</span>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestConnection}
                    disabled={isTesting}
                    className="h-7 text-xs"
                  >
                    {isTesting ? <Loader2 className="size-3 animate-spin" /> : "测试连通性"}
                  </Button>
                </div>
              )}

              {/* Test Result Banner */}
              {testResult ? (
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg p-2.5 text-xs",
                    testResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20",
                  )}
                >
                  {testResult.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <XCircle className="size-4 shrink-0" />}
                  <span className="flex-1">{testResult.message}</span>
                </div>
              ) : null}
            </div>

            {/* OpenRouter Presets Quick Bar */}
            {selectedType === "openrouter" ? (
              <div className="space-y-2 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    ⚡ OpenRouter 推荐热门模型（点击一键添加）:
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {OPENROUTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectOpenRouterPreset(preset)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
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

            {/* Model List Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">配置模型列表 ({models.length} 个)</Label>
                <Button variant="ghost" size="sm" onClick={handleAddModelRow} className="h-6 text-xs gap-1 text-primary">
                  <Plus className="size-3" /> 添加模型
                </Button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {models.map((model, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs">
                    <div className="flex-1 space-y-0.5">
                      <Input
                        value={model.id}
                        onChange={(e) => handleUpdateModelRow(idx, { id: e.target.value })}
                        placeholder="模型 ID (如 stealth/ox-alpha, qwen3.5:27b)"
                        className="h-7 text-xs font-mono"
                      />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <Input
                        value={model.name}
                        onChange={(e) => handleUpdateModelRow(idx, { name: e.target.value })}
                        placeholder="显示名称 (如 Ox Alpha)"
                        className="h-7 text-xs"
                      />
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        value={model.contextLimit || 128000}
                        onChange={(e) => handleUpdateModelRow(idx, { contextLimit: Number(e.target.value) })}
                        placeholder="上下文 (Tokens)"
                        className="h-7 text-xs text-right font-mono"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveModelRow(idx)}
                      className="size-7 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          {isAddingNew ? (
            <div className="flex w-full items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => setIsAddingNew(false)}>
                返回列表
              </Button>
              <Button size="sm" onClick={handleSave} className="gap-1">
                保存并生效配置
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              完成
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
