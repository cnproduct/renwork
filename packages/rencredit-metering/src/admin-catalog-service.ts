import { findPublishedAdminModel, requireSuperAdmin, toPublicModelCatalog, validateAdminModelCatalog } from "./catalog.js";
import type {
  RenWorkActorRole,
  RenWorkAdminModelCatalog,
  RenWorkAdminModelRoute,
  RenWorkPublicModelCatalog,
} from "./contracts.js";

function cloneCatalog(catalog: RenWorkAdminModelCatalog): RenWorkAdminModelCatalog {
  return structuredClone(catalog);
}

export function createRenWorkModelCatalogService(initialCatalog: RenWorkAdminModelCatalog) {
  validateAdminModelCatalog(initialCatalog);
  let catalog = cloneCatalog(initialCatalog);

  return {
    getPublicCatalog(now = new Date()): RenWorkPublicModelCatalog {
      return toPublicModelCatalog(catalog, now);
    },

    getAdminCatalog(role: RenWorkActorRole): RenWorkAdminModelCatalog {
      requireSuperAdmin(role);
      return cloneCatalog(catalog);
    },

    replaceAdminCatalog(input: {
      role: RenWorkActorRole;
      expectedVersion: string;
      catalog: RenWorkAdminModelCatalog;
    }): RenWorkAdminModelCatalog {
      requireSuperAdmin(input.role);
      if (input.expectedVersion !== catalog.version) throw new Error("MODEL_CATALOG_VERSION_CONFLICT");
      validateAdminModelCatalog(input.catalog);
      catalog = cloneCatalog(input.catalog);
      return cloneCatalog(catalog);
    },

    resolveRoute(modelSku: string): RenWorkAdminModelRoute {
      const model = findPublishedAdminModel(catalog, modelSku);
      const providers = new Map(catalog.providers.map((provider) => [provider.id, provider]));
      const route = model.routes
        .filter((candidate) => candidate.enabled)
        .filter((candidate) => {
          const provider = providers.get(candidate.providerId);
          return provider?.enabled && provider.health !== "offline";
        })
        .sort((left, right) => left.priority - right.priority)[0];
      if (!route) throw new Error("MODEL_ROUTE_UNAVAILABLE");
      return { ...route };
    },
  };
}
