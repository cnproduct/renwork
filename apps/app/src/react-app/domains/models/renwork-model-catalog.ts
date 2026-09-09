import * as React from "react";
import type { RenWorkPublicModelCatalog } from "@openwork/rencredit-metering";

import type { ModelOption } from "@/app/types";
import { createDenClient, readDenSettings } from "@/app/lib/den";
import { denSettingsChangedEvent } from "@/app/lib/den-session-events";

export type RenWorkCatalogModelOption = {
  option: ModelOption;
  billing: RenWorkPublicModelCatalog["models"][number];
};

export function renWorkTierLabel(tier: RenWorkPublicModelCatalog["models"][number]["tier"]): string {
  if (tier === "auto") return "智能 Auto";
  if (tier === "standard") return "标准";
  if (tier === "professional") return "专业";
  return "极致";
}

export function catalogModelOptions(catalog: RenWorkPublicModelCatalog): RenWorkCatalogModelOption[] {
  return catalog.models.map((model) => ({
    billing: model,
    option: {
      providerID: model.providerID,
      modelID: model.modelID,
      title: model.displayName,
      description: model.description,
      behaviorTitle: "Reasoning",
      behaviorLabel: "Default",
      behaviorDescription: "",
      behaviorValue: null,
      isFree: model.billingMode === "free",
    },
  }));
}

export function requiredPersonalSubscriptionProvider(
  model: RenWorkPublicModelCatalog["models"][number] | null | undefined,
): "openai" | "google" | null {
  if (model?.executionLocation !== "local") return null;
  if (model.tags.includes("openai")) return "openai";
  if (model.tags.includes("google")) return "google";
  return null;
}

export function personalSubscriptionCatalogModelOptions(
  catalog: RenWorkPublicModelCatalog | null | undefined,
  connectedProviderIds: readonly string[],
): ModelOption[] {
  if (!catalog) return [];
  const connected = new Set(connectedProviderIds.map((providerId) => providerId.trim().toLowerCase()));
  return catalogModelOptions(catalog).flatMap(({ option, billing }) => {
    const providerId = requiredPersonalSubscriptionProvider(billing);
    return providerId && connected.has(providerId) ? [option] : [];
  });
}

export function useRenWorkModelCatalog(open: boolean, signedIn: boolean): RenWorkPublicModelCatalog | null {
  const [catalog, setCatalog] = React.useState<RenWorkPublicModelCatalog | null>(null);
  const [settingsRevision, setSettingsRevision] = React.useState(0);

  React.useEffect(() => {
    const handleSettingsChanged = () => setSettingsRevision((revision) => revision + 1);
    window.addEventListener(denSettingsChangedEvent, handleSettingsChanged);
    return () => window.removeEventListener(denSettingsChangedEvent, handleSettingsChanged);
  }, []);

  React.useEffect(() => {
    if (!open || !signedIn) {
      setCatalog(null);
      return;
    }
    const settings = readDenSettings();
    if (!settings.authToken || !settings.activeOrgId) {
      setCatalog(null);
      return;
    }
    let cancelled = false;
    // Never leave the previous organization's catalog visible while the new
    // account or active organization is being resolved.
    setCatalog(null);
    const client = createDenClient({ baseUrl: settings.baseUrl, token: settings.authToken });
    void client.getRenWorkModelCatalog(settings.activeOrgId)
      .then((result) => {
        if (!cancelled) setCatalog(result);
      })
      .catch(() => {
        // Compatibility window: a control plane that has not deployed the
        // catalog endpoint keeps the existing provider picker available.
        if (!cancelled) setCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, settingsRevision, signedIn]);

  return catalog;
}
