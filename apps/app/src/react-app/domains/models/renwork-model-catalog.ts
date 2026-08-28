import * as React from "react";
import type { RenWorkPublicModelCatalog } from "@openwork/rencredit-metering";

import type { ModelOption } from "@/app/types";
import { createDenClient, readDenSettings } from "@/app/lib/den";

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
      isFree: false,
    },
  }));
}

export function useRenWorkModelCatalog(open: boolean, signedIn: boolean): RenWorkPublicModelCatalog | null {
  const [catalog, setCatalog] = React.useState<RenWorkPublicModelCatalog | null>(null);

  React.useEffect(() => {
    if (!open || !signedIn) return;
    const settings = readDenSettings();
    if (!settings.authToken || !settings.activeOrgId) return;
    let cancelled = false;
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
  }, [open, signedIn]);

  return catalog;
}
