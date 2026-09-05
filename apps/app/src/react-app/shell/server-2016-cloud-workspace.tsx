/** @jsxImportSource react */
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import {
  createDenClient,
  readDenSettings,
  type DenCloudInstance,
  type DenWorkerSummary,
  type DenWorkerTokens,
} from "@/app/lib/den";
import { denSettingsChangedEvent } from "@/app/lib/den-session-events";
import {
  isServer2016CloudDesktopRuntime,
  resolveWorkspaceListSelectedId,
  workspaceBootstrap,
  workspaceCreateRemote,
  workspaceSetRuntimeActive,
  workspaceSetSelected,
  workspaceUpdateRemote,
  type WorkspaceInfo,
} from "@/app/lib/desktop";
import { Button } from "@/components/ui/button";
import { useDenAuth } from "@/react-app/domains/cloud/den-auth-provider";
import { useCloudWorkspaceStatus } from "./cloud-workspace-overlay";

const CLOUD_BACKEND = "renwork-cloud";
const CONNECTED_MARKER_PREFIX = "renwork.server2016.cloud.connected";

function subscribeToDenSettings(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(denSettingsChangedEvent, onStoreChange);
  return () => window.removeEventListener(denSettingsChangedEvent, onStoreChange);
}

function readSettingsSnapshot() {
  const settings = readDenSettings();
  return JSON.stringify({
    baseUrl: settings.baseUrl,
    authToken: settings.authToken ?? "",
    activeOrgId: settings.activeOrgId ?? "",
  });
}

export function selectCloudWorker(
  workers: DenWorkerSummary[],
  instance: DenCloudInstance,
): DenWorkerSummary | null {
  const mine = workers.filter((worker) => worker.isMine);
  if (mine.length === 0) return null;
  const instanceUrl = instance.url?.replace(/\/+$/, "") ?? "";
  return mine.find((worker) => worker.instanceUrl?.replace(/\/+$/, "") === instanceUrl)
    ?? mine.find((worker) => worker.status === "ready" || worker.status === "active")
    ?? mine[0]
    ?? null;
}

export function cloudWorkspaceUrl(
  instance: DenCloudInstance,
  worker: DenWorkerSummary,
  tokens: DenWorkerTokens,
): string | null {
  return tokens.openworkUrl?.trim()
    || worker.instanceUrl?.trim()
    || instance.url?.trim()
    || null;
}

function workspaceForOrganization(workspaces: WorkspaceInfo[], orgId: string) {
  return workspaces.find((workspace) => (
    workspace.workspaceType === "remote"
    && workspace.sandboxBackend === CLOUD_BACKEND
    && workspace.sandboxRunId === orgId
  ));
}

function connectedMarker(orgId: string, workerId: string) {
  return `${CONNECTED_MARKER_PREFIX}:${orgId}:${workerId}`;
}

export function Server2016CloudWorkspaceConnector() {
  const denAuth = useDenAuth();
  const cloud = useCloudWorkspaceStatus();
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const settingsSnapshot = useSyncExternalStore(
    subscribeToDenSettings,
    readSettingsSnapshot,
    readSettingsSnapshot,
  );
  const settings = useMemo(() => readDenSettings(), [settingsSnapshot]);
  const authToken = settings.authToken?.trim() ?? "";
  const orgId = settings.activeOrgId?.trim() ?? "";
  const denClient = useMemo(
    () => createDenClient({ baseUrl: settings.baseUrl, token: authToken }),
    [authToken, settings.baseUrl],
  );
  const enabled = isServer2016CloudDesktopRuntime();

  const connect = useCallback(async (signal: AbortSignal) => {
    if (!enabled || !denAuth.isSignedIn || !authToken || !orgId || cloud.instance?.status !== "ready") return;
    setError(null);
    try {
      const workers = await denClient.listWorkers(orgId, 50);
      if (signal.aborted) return;
      const worker = selectCloudWorker(workers, cloud.instance);
      if (!worker) throw new Error("Your cloud workspace is ready, but its worker record is not available yet.");
      const tokens = await denClient.getWorkerTokens(worker.workerId, orgId);
      if (signal.aborted) return;
      const baseUrl = cloudWorkspaceUrl(cloud.instance, worker, tokens);
      if (!baseUrl) throw new Error("The cloud worker did not return a RenWork connection URL.");
      if (!tokens.clientToken && !tokens.ownerToken) {
        throw new Error("The cloud worker did not return a usable access token.");
      }

      const list = await workspaceBootstrap();
      if (signal.aborted) return;
      const existing = workspaceForOrganization(list.workspaces, orgId);
      const payload = {
        baseUrl,
        remoteType: "openwork" as const,
        displayName: `RenWork Cloud · ${worker.workerName}`,
        openworkHostUrl: baseUrl,
        openworkToken: tokens.ownerToken ?? tokens.clientToken,
        openworkClientToken: tokens.clientToken,
        openworkHostToken: tokens.hostToken,
        openworkWorkspaceId: tokens.workspaceId,
        sandboxBackend: CLOUD_BACKEND,
        sandboxRunId: orgId,
        sandboxContainerName: worker.workerId,
      };
      const next = existing
        ? await workspaceUpdateRemote({ workspaceId: existing.id, ...payload })
        : await workspaceCreateRemote(payload);
      if (signal.aborted) return;
      const workspaceId = existing?.id
        ?? resolveWorkspaceListSelectedId(next)
        ?? next.workspaces[next.workspaces.length - 1]?.id
        ?? "";
      if (!workspaceId) throw new Error("RenWork could not save the cloud workspace connection.");
      await workspaceSetSelected(workspaceId);
      await workspaceSetRuntimeActive(workspaceId);

      const marker = connectedMarker(orgId, worker.workerId);
      if (window.sessionStorage.getItem(marker) !== "1") {
        window.sessionStorage.setItem(marker, "1");
        window.location.reload();
      }
    } catch (cause) {
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "RenWork could not connect to your cloud workspace.");
    }
  }, [authToken, cloud.instance, denAuth.isSignedIn, denClient, enabled, orgId]);

  useEffect(() => {
    if (!enabled || cloud.instance?.status !== "ready") return;
    const controller = new AbortController();
    void connect(controller.signal);
    return () => controller.abort();
  }, [attempt, cloud.instance?.status, connect, enabled]);

  useEffect(() => {
    if (!enabled || !error) return;
    const timeoutId = window.setTimeout(() => setAttempt((value) => value + 1), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [enabled, error]);

  if (!enabled || !error) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[110] flex justify-center px-4">
      <div className="flex max-w-2xl items-center gap-3 rounded-2xl border border-red-7/50 bg-popover/95 px-4 py-3 text-popover-foreground shadow-md backdrop-blur-sm">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Cloud workspace connection needs attention</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
        <Button type="button" size="xs" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
          Retry
        </Button>
      </div>
    </div>
  );
}
