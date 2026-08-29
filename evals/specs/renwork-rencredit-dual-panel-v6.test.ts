import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

async function source(path: string) {
  return readFile(`${repositoryRoot}/${path}`, "utf8");
}

test("task receipts show a truthful context reference and RenCredit settlement", async ({ evidence }) => {
  const commerce = await source("apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx");

  expect(commerce).toContain('data-testid="rencredit-context-capacity"');
  expect(commerce).toContain('data-testid="rencredit-settlement"');
  expect(commerce).toContain('data-testid="rencredit-token-breakdown"');
  expect(commerce).toContain("usage.inputTokens + usage.outputTokens + usage.reasoningTokens");
  expect(commerce).toContain("usage.cacheReadTokens");
  expect(commerce).toContain("usage.cacheWriteTokens");
  expect(commerce).toContain("receipt.reservedMicroCredits");
  expect(commerce).toContain("receipt.capturedMicroCredits");
  expect(commerce).toContain("receipt.releasedMicroCredits");
  expect(commerce).toContain("client.getRenWorkModelCatalog(organizationId)");

  evidence.fact(
    "The double-layer receipt is source-backed",
    "The upper layer labels per-task context as a reference against the current catalog window, while the lower layer uses durable reservation, capture, release and five provider-reported token counters.",
    true,
  );
});

test("the user-facing panel does not expose provider routing or secrets", async ({ evidence }) => {
  const commerce = await source("apps/app/src/react-app/domains/settings/pages/renwork-commerce-view.tsx");

  expect(commerce).not.toMatch(/provider_response_id|upstream_model_id|credential_ref|idempotency_key|pricing_snapshot/i);
  expect(commerce).toContain('receipt.status === "released" ? formatRenCreditBalance(0)');
  expect(commerce).toContain('t("commerce.receipt_no_charge")');

  evidence.fact(
    "No result remains no charge",
    "Released tasks display zero charge and the member receipt still excludes provider routes, credentials, idempotency keys and internal pricing snapshots.",
    true,
  );
});
