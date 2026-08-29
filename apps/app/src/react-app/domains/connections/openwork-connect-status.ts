import type { SessionCloudMcpMaintenanceState } from "./use-session-mcp-maintenance";
import { t } from "../../../i18n";

export type OpenWorkConnectStateStatus = "available" | "missing" | "invalid" | "unreadable";

export type OpenWorkConnectStateSummary = {
  status: "ready" | "not_configured" | "disabled" | "unavailable";
  statusLabel: string;
  tone: "ready" | "neutral" | "error";
  stageLabel: string;
  recommendedAction: string;
};

export function resolveOpenWorkConnectStateSummary(
  status: OpenWorkConnectStateStatus,
  connectEnabled: boolean,
): OpenWorkConnectStateSummary {
  if (status === "missing") {
    return {
      status: "not_configured",
      statusLabel: t("connect.state_not_configured_label"),
      tone: "neutral",
      stageLabel: t("connect.state_not_configured_stage"),
      recommendedAction: t("connect.state_not_configured_action"),
    };
  }
  if (status === "invalid" || status === "unreadable") {
    return {
      status: "unavailable",
      statusLabel: t("connect.state_unavailable_label"),
      tone: "error",
      stageLabel: t("connect.state_unavailable_stage"),
      recommendedAction: t("connect.state_unavailable_action"),
    };
  }
  if (!connectEnabled) {
    return {
      status: "disabled",
      statusLabel: t("connect.state_disabled_label"),
      tone: "neutral",
      stageLabel: t("connect.state_disabled_stage"),
      recommendedAction: t("connect.state_disabled_action"),
    };
  }
  return {
    status: "ready",
    statusLabel: t("connect.state_ready_label"),
    tone: "ready",
    stageLabel: t("connect.state_ready_stage"),
    recommendedAction: t("connect.state_ready_action"),
  };
}

export type OpenWorkConnectStatus = {
  state: "checking" | "ready" | "needs_attention";
  label: "Checking" | "Ready" | "Needs attention";
  description: string;
};

export function openWorkConnectAttentionTitle(description: string): string {
  return `One possible issue: ${description}`;
}

export function resolveOpenWorkConnectStatus(
  signedIn: boolean,
  maintenance: SessionCloudMcpMaintenanceState | undefined,
): OpenWorkConnectStatus | null {
  if (!signedIn) return null;

  // Den authentication is ready, but maintenance itself is workspace-scoped.
  // When there is no active workspace, report the verified Cloud connection
  // without claiming that connected-service delivery was checked.
  if (!maintenance || maintenance.status === "idle") {
    return {
      state: "ready",
      label: "Ready",
      description: "Signed in to RenWork Cloud. Connected service tools will be checked when a workspace is active.",
    };
  }

  if (maintenance.status === "ready") {
    return {
      state: "ready",
      label: "Ready",
      description: "Connected service tools are available.",
    };
  }

  // A skipped maintenance pass means the optional cloud-tool bridge is not
  // applicable to the current workspace. It is not a failed RenWork account
  // connection and must never create a red "Needs attention" warning.
  if (maintenance.status === "skipped") {
    const description = maintenance.skipReason === "missing_org"
      ? "Signed in to RenWork Cloud. Choose an organization to use connected service tools."
      : maintenance.skipReason === "missing_workspace"
        ? "Signed in to RenWork Cloud. Connected service tools will be checked when a workspace is active."
        : maintenance.skipReason === "signed_out"
          ? "RenWork Cloud sign-in is still being restored."
          : "RenWork Cloud is connected. Connected service tools are not enabled for this workspace.";
    return {
      state: "ready",
      label: "Ready",
      description,
    };
  }

  if (maintenance.status === "failed") {
    return {
      state: "needs_attention",
      label: "Needs attention",
      description: maintenance.issue?.message
        ?? "RenWork Connect could not verify connected service tools. Run diagnostics for details.",
    };
  }

  return {
    state: "checking",
    label: "Checking",
    description: maintenance.status === "retrying"
      ? `Restoring connected service tools (${maintenance.attempt}/${maintenance.maxAttempts}).`
      : "Checking connected service tools in the background.",
  };
}
