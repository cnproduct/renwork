import { DEFAULT_MODEL, MODEL_PREF_KEY, SESSION_MODEL_PREF_KEY } from "../../app/constants";
import type { ModelRef } from "../../app/types";
import { formatModelRef, parseModelRef } from "../../app/utils";
import { isCloudManagedProviderKey } from "../domains/connections/provider-auth/cloud-provider-config";
import { LOCAL_PREFERENCES_KEY } from "./local-preferences-storage";

const MIGRATION_KEY = "renwork.denOnlyModelMigration.v40";
const SESSION_SELECTIONS_KEY = "openwork.sessionModels.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

function isManagedModel(model: ModelRef | null) {
  return Boolean(model && isCloudManagedProviderKey(model.providerID));
}

function parseSelectionModel(value: unknown): ModelRef | null {
  if (!value || typeof value !== "object") return null;
  const model = Reflect.get(value, "model");
  if (!model || typeof model !== "object") return null;
  const providerID = Reflect.get(model, "providerID");
  const modelID = Reflect.get(model, "modelID");
  return typeof providerID === "string" && typeof modelID === "string"
    ? { providerID, modelID }
    : null;
}

/** Remove model choices that could invoke a client-side provider after a Den-only upgrade. */
export function migrateDenOnlyModelState(storage: StorageLike): boolean {
  if (storage.getItem(MIGRATION_KEY) === "done") return false;

  const storedDefault = parseModelRef(storage.getItem(MODEL_PREF_KEY));
  if (!isManagedModel(storedDefault)) {
    storage.setItem(MODEL_PREF_KEY, formatModelRef(DEFAULT_MODEL));
  }

  try {
    const raw = storage.getItem(LOCAL_PREFERENCES_KEY);
    const preferences = raw ? JSON.parse(raw) as Record<string, unknown> : null;
    if (preferences && typeof preferences === "object") {
      const value = preferences.defaultModel;
      const model = value && typeof value === "object"
        ? {
            providerID: Reflect.get(value, "providerID"),
            modelID: Reflect.get(value, "modelID"),
          }
        : null;
      if (
        !model ||
        typeof model.providerID !== "string" ||
        typeof model.modelID !== "string" ||
        !isManagedModel(model as ModelRef)
      ) {
        preferences.defaultModel = DEFAULT_MODEL;
        preferences.modelVariant = null;
        storage.setItem(LOCAL_PREFERENCES_KEY, JSON.stringify(preferences));
      }
    }
  } catch {
    storage.removeItem(LOCAL_PREFERENCES_KEY);
  }

  try {
    const raw = storage.getItem(SESSION_SELECTIONS_KEY);
    const selections = raw ? JSON.parse(raw) as Record<string, unknown> : null;
    if (selections && typeof selections === "object" && !Array.isArray(selections)) {
      const retained = Object.fromEntries(
        Object.entries(selections).filter(([, value]) => isManagedModel(parseSelectionModel(value))),
      );
      if (Object.keys(retained).length > 0) {
        storage.setItem(SESSION_SELECTIONS_KEY, JSON.stringify(retained));
      } else {
        storage.removeItem(SESSION_SELECTIONS_KEY);
      }
    }
  } catch {
    storage.removeItem(SESSION_SELECTIONS_KEY);
  }

  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => typeof key === "string",
  );
  for (const key of keys) {
    if (
      key !== SESSION_SELECTIONS_KEY &&
      key.startsWith(`${SESSION_MODEL_PREF_KEY}.`)
    ) storage.removeItem(key);
  }
  storage.setItem(MIGRATION_KEY, "done");
  return true;
}

export function migrateDenOnlyModelStateForDistributedDesktop(cloudWorkspaceRequired: boolean) {
  if (!cloudWorkspaceRequired || typeof window === "undefined") return false;
  return migrateDenOnlyModelState(window.localStorage);
}
