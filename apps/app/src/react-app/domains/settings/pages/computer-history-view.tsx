/** @jsxImportSource react */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ComputerHistoryApp,
  ComputerHistoryClearRange,
  ComputerHistoryEntry,
  ComputerHistoryState,
} from "@openwork/types/desktop-ipc";
import {
  AppWindow,
  CalendarClock,
  ChevronDown,
  CircleAlert,
  Clock3,
  History,
  Loader2,
  MessageCircleQuestion,
  Pause,
  Play,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { desktopBridge } from "@/app/lib/desktop";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { SettingsNotice, SettingsStack } from "@/react-app/domains/settings/settings-section";

const STATE_QUERY_KEY = ["computer-history", "state"] as const;
const APPS_QUERY_KEY = ["computer-history", "apps"] as const;

function isElectronAvailable() {
  return typeof window !== "undefined" && Boolean(window.__OPENWORK_ELECTRON__?.invokeDesktop);
}

function dateKey(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("computer_history.group_earlier");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const entryDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((today.getTime() - entryDay.getTime()) / 86_400_000);
  if (difference === 0) return t("computer_history.group_today");
  if (difference === 1) return t("computer_history.group_yesterday");
  return new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 60) return t("computer_history.duration_less_minute");
  const minutes = Math.round(seconds / 60);
  return t("computer_history.duration_minutes", { count: minutes });
}

function buildAskPrompt(entries: ComputerHistoryEntry[]) {
  const lines = entries.map((entry) =>
    `- [${entry.capturedAt}] ${entry.appName} — ${entry.summary}`,
  );
  return [
    t("computer_history.ask_prompt_intro"),
    t("computer_history.ask_prompt_guardrail"),
    "",
    ...lines,
    "",
    t("computer_history.ask_prompt_question"),
  ].join("\n");
}

export type ComputerHistoryViewProps = {
  onOpenPrompt: (prompt: string) => void | Promise<void>;
};

export function ComputerHistoryView({ onOpenPrompt }: ComputerHistoryViewProps) {
  const queryClient = useQueryClient();
  const [appsOpen, setAppsOpen] = React.useState(false);
  const [askOpen, setAskOpen] = React.useState(false);
  const [selectedApps, setSelectedApps] = React.useState<ReadonlySet<string>>(() => new Set());
  const [selectedEntries, setSelectedEntries] = React.useState<ReadonlySet<string>>(() => new Set());

  const stateQuery = useQuery({
    queryKey: STATE_QUERY_KEY,
    queryFn: () => desktopBridge.computerHistoryGetState(),
    enabled: isElectronAvailable(),
    retry: false,
    refetchInterval: 15_000,
  });
  const appsQuery = useQuery({
    queryKey: APPS_QUERY_KEY,
    queryFn: () => desktopBridge.computerHistoryListApps(),
    enabled: isElectronAvailable() && appsOpen,
    retry: false,
  });

  const setState = React.useCallback((next: ComputerHistoryState) => {
    queryClient.setQueryData(STATE_QUERY_KEY, next);
  }, [queryClient]);

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<ComputerHistoryState["settings"]>) =>
      desktopBridge.computerHistoryUpdateSettings(patch),
    onSuccess: setState,
    onError: (error) => toast.error(error instanceof Error ? error.message : t("computer_history.error_update")),
  });
  const deleteEntry = useMutation({
    mutationFn: (id: string) => desktopBridge.computerHistoryDeleteEntry(id),
    onSuccess: setState,
    onError: (error) => toast.error(error instanceof Error ? error.message : t("computer_history.error_delete")),
  });
  const clearHistory = useMutation({
    mutationFn: (range: ComputerHistoryClearRange) => desktopBridge.computerHistoryClear({ range }),
    onSuccess: (next) => {
      setState(next);
      toast.success(t("computer_history.cleared"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : t("computer_history.error_clear")),
  });

  const state = stateQuery.data;
  const settings = state?.settings ?? {
    enabled: false,
    paused: false,
    retentionDays: 30,
    allowedApps: [],
  };
  const entries = state?.entries ?? [];
  const busy = updateSettings.isPending || deleteEntry.isPending || clearHistory.isPending;

  const groupedEntries = React.useMemo(() => {
    const groups = new Map<string, ComputerHistoryEntry[]>();
    for (const entry of entries) {
      const key = dateKey(entry.capturedAt);
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    return [...groups.entries()];
  }, [entries]);

  const openApps = React.useCallback(() => {
    setSelectedApps(new Set(settings?.allowedApps.map((app) => app.bundleIdentifier) ?? []));
    setAppsOpen(true);
  }, [settings?.allowedApps]);

  const openAsk = React.useCallback(() => {
    setSelectedEntries(new Set(entries.map((entry) => entry.id)));
    setAskOpen(true);
  }, [entries]);

  const saveApps = React.useCallback(async () => {
    const available = appsQuery.data?.apps ?? [];
    const allowedApps = available.filter((app) => selectedApps.has(app.bundleIdentifier));
    try {
      await updateSettings.mutateAsync({ allowedApps });
      setAppsOpen(false);
    } catch {
      // The mutation owns the user-facing error toast and the dialog stays open for retry.
    }
  }, [appsQuery.data?.apps, selectedApps, updateSettings]);

  const toggleEnabled = React.useCallback(async (checked: boolean) => {
    if (checked && (settings?.allowedApps.length ?? 0) === 0) {
      toast.info(t("computer_history.select_first"));
      openApps();
      return;
    }
    try {
      const next = await updateSettings.mutateAsync({ enabled: checked, paused: false });
      if (checked) {
        setState(await desktopBridge.computerHistoryCaptureNow());
      } else {
        setState(next);
      }
    } catch {
      // The mutation owns the user-facing error toast.
    }
  }, [openApps, setState, settings?.allowedApps.length, updateSettings]);

  const confirmAsk = React.useCallback(async () => {
    const chosen = entries.filter((entry) => selectedEntries.has(entry.id));
    if (chosen.length === 0) {
      toast.error(t("computer_history.ask_select_one"));
      return;
    }
    setAskOpen(false);
    await onOpenPrompt(buildAskPrompt(chosen));
  }, [entries, onOpenPrompt, selectedEntries]);

  if (!isElectronAvailable()) {
    return (
      <SettingsStack>
        <SettingsNotice>{t("computer_history.desktop_only")}</SettingsNotice>
      </SettingsStack>
    );
  }

  if (stateQuery.isLoading) {
    return (
      <SettingsStack>
        <div className="flex min-h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </SettingsStack>
    );
  }

  if (stateQuery.isError || !state) {
    return (
      <SettingsStack>
        <SettingsNotice tone="error">
          {stateQuery.error instanceof Error ? stateQuery.error.message : t("computer_history.error_load")}
        </SettingsNotice>
      </SettingsStack>
    );
  }

  if (!state.supported) {
    return (
      <SettingsStack>
        <SettingsNotice>{t("computer_history.desktop_only")}</SettingsNotice>
      </SettingsStack>
    );
  }

  return (
    <SettingsStack className="gap-5">
      <Card data-testid="computer-history-view" variant="outline" className="overflow-hidden">
        <CardHeader className="border-b border-border/70 bg-muted/15">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <History className="size-5" />
                </div>
                <CardTitle>{t("computer_history.title")}</CardTitle>
                <Badge variant="secondary">{t("computer_history.local_badge")}</Badge>
              </div>
              <CardDescription className="max-w-2xl leading-relaxed">
                {t("computer_history.description")}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span data-testid="computer-history-status" className="text-sm font-medium text-muted-foreground">
                {!settings.enabled
                  ? t("computer_history.status_off")
                  : settings.paused
                    ? t("computer_history.status_paused")
                    : t("computer_history.status_recording")}
              </span>
              <Switch
                data-testid="computer-history-enabled"
                checked={settings.enabled}
                onCheckedChange={(checked) => void toggleEnabled(checked)}
                disabled={busy || !state.supported}
                aria-label={t("computer_history.toggle_label")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-10" />
            <div>
              <p className="text-sm font-medium">{t("computer_history.privacy_title")}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {t("computer_history.privacy_description")}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {settings.enabled ? (
              <Button
                data-testid="computer-history-pause"
                variant="outline"
                onClick={() => updateSettings.mutate({ paused: !settings.paused })}
                disabled={busy}
              >
                {settings.paused ? <Play /> : <Pause />}
                {settings.paused ? t("computer_history.resume") : t("computer_history.pause")}
              </Button>
            ) : null}
            <Button data-testid="computer-history-select-apps" variant="outline" onClick={openApps}>
              <AppWindow />
              {t("computer_history.choose_apps")}
              {settings.allowedApps.length > 0 ? ` (${settings.allowedApps.length})` : ""}
            </Button>
            <Select
              value={String(settings.retentionDays)}
              onValueChange={(value) => {
                const retentionDays = Number(value);
                if (retentionDays === 0 || retentionDays === 7 || retentionDays === 30 || retentionDays === 90) {
                  updateSettings.mutate({ retentionDays });
                }
              }}
            >
              <SelectTrigger aria-label={t("computer_history.retention_label")}>
                <CalendarClock />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">{t("computer_history.retention_7")}</SelectItem>
                <SelectItem value="30">{t("computer_history.retention_30")}</SelectItem>
                <SelectItem value="90">{t("computer_history.retention_90")}</SelectItem>
                <SelectItem value="0">{t("computer_history.retention_manual")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {state.permissions && !state.permissions.accessibility ? (
        <SettingsNotice className="border-amber-7/30 bg-amber-1/40 text-amber-11">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{t("computer_history.permission_required")}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void desktopBridge.openComputerUsePermissionSetup()}
            >
              {t("computer_history.permission_cta")}
            </Button>
          </div>
        </SettingsNotice>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">{t("computer_history.timeline_title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("computer_history.timeline_description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" disabled={entries.length === 0 || busy} />}
            >
              {t("computer_history.clear")}
              <ChevronDown />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => clearHistory.mutate("today")}>{t("computer_history.clear_today")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => clearHistory.mutate("7d")}>{t("computer_history.clear_7")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => clearHistory.mutate("30d")}>{t("computer_history.clear_30")}</DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={() => clearHistory.mutate("all")}>{t("computer_history.clear_all")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            data-testid="computer-history-ask"
            variant="outline"
            onClick={openAsk}
            disabled={entries.length === 0}
          >
            <MessageCircleQuestion />
            {t("computer_history.ask")}
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <Card variant="outline" className="border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <Clock3 className="size-9 text-muted-foreground/70" />
            <p className="mt-4 font-medium">{t("computer_history.empty_title")}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {settings.enabled
                ? t("computer_history.empty_waiting")
                : t("computer_history.empty_description")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card variant="outline" className="overflow-hidden">
          <CardContent className="p-0">
            {groupedEntries.map(([group, groupEntries], groupIndex) => (
              <section key={group} className={cn(groupIndex > 0 && "border-t border-border")}>
                <div className="bg-muted/20 px-5 py-3 text-sm font-semibold">{group}</div>
                <div className="divide-y divide-border/70">
                  {groupEntries.map((entry) => (
                    <article
                      data-testid="computer-history-entry"
                      key={entry.id}
                      className="group grid grid-cols-[auto_1fr_auto] gap-4 px-5 py-4"
                    >
                      <div className="flex size-9 items-center justify-center rounded-xl border border-border bg-background text-muted-foreground">
                        <AppWindow className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-medium">{entry.summary}</span>
                          <Badge variant="outline">{entry.appName}</Badge>
                        </div>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{entry.windowTitle}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {formatTime(entry.capturedAt)} · {formatDuration(entry.durationSeconds)} · {t("computer_history.text_summary_only")}
                        </p>
                      </div>
                      <Button
                        data-testid="computer-history-delete-entry"
                        variant="ghost"
                        size="icon-sm"
                        className="opacity-70 group-hover:opacity-100"
                        onClick={() => deleteEntry.mutate(entry.id)}
                        disabled={deleteEntry.isPending}
                        title={t("computer_history.delete_entry")}
                        aria-label={t("computer_history.delete_entry")}
                      >
                        <Trash2 />
                      </Button>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        {t("computer_history.billing_note")}
      </p>

      <Dialog open={appsOpen} onOpenChange={setAppsOpen}>
        <DialogContent data-testid="computer-history-app-dialog" className="lg:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("computer_history.apps_title")}</DialogTitle>
            <DialogDescription>{t("computer_history.apps_description")}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {appsQuery.isLoading ? (
              <div className="flex min-h-24 items-center justify-center"><Loader2 className="size-5 animate-spin" /></div>
            ) : (appsQuery.data?.apps.length ?? 0) === 0 ? (
              <SettingsNotice>{t("computer_history.apps_empty")}</SettingsNotice>
            ) : (
              appsQuery.data?.apps.map((app) => {
                const checked = selectedApps.has(app.bundleIdentifier);
                return (
                  <label key={app.bundleIdentifier} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border px-3 py-3 hover:bg-muted/20">
                    <Checkbox
                      data-testid={`computer-history-app-${app.bundleIdentifier}`}
                      checked={checked}
                      onCheckedChange={(next) => {
                        setSelectedApps((current) => {
                          const copy = new Set(current);
                          if (next) copy.add(app.bundleIdentifier);
                          else copy.delete(app.bundleIdentifier);
                          return copy;
                        });
                      }}
                    />
                    <AppWindow className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{app.name}</span>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppsOpen(false)}>{t("common.cancel")}</Button>
            <Button
              data-testid="computer-history-save-apps"
              onClick={() => void saveApps()}
              disabled={appsQuery.isLoading || updateSettings.isPending}
            >
              {t("computer_history.apps_save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={askOpen} onOpenChange={setAskOpen}>
        <DialogContent data-testid="computer-history-share-confirm" className="lg:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("computer_history.ask_confirm_title")}</DialogTitle>
            <DialogDescription>{t("computer_history.ask_confirm_description")}</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-6/40 bg-amber-3/30 p-3 text-sm text-amber-12">
            <div className="flex gap-2">
              <CircleAlert className="mt-0.5 size-4 shrink-0" />
              <span>{t("computer_history.ask_cloud_disclosure")}</span>
            </div>
          </div>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const checked = selectedEntries.has(entry.id);
              return (
                <label key={entry.id} className="flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3 hover:bg-muted/20">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) => {
                      setSelectedEntries((current) => {
                        const copy = new Set(current);
                        if (next) copy.add(entry.id);
                        else copy.delete(entry.id);
                        return copy;
                      });
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{entry.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{entry.appName} · {formatTime(entry.capturedAt)}</p>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button data-testid="computer-history-share-cancel" variant="outline" onClick={() => setAskOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button data-testid="computer-history-share-confirm-cta" onClick={() => void confirmAsk()}>
              {t("computer_history.ask_confirm_cta")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsStack>
  );
}
