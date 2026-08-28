import { describe, expect, test } from "bun:test";

import { createRenCreditBillingService } from "./service.js";
import { createTestCatalog } from "./test-fixtures.js";

describe("RenCredit token reservation lifecycle", () => {
  test("quotes, reserves, captures actual usage and releases the remainder", () => {
    const service = createRenCreditBillingService({
      catalog: createTestCatalog(),
      wallets: { tenant_a: 1_000 },
      now: () => new Date("2026-08-28T12:00:00.000Z"),
    });
    const quote = service.quote({
      modelSku: "renwork-standard",
      estimatedUsage: {
        inputTokens: 40,
        outputTokens: 40,
        reasoningTokens: 40,
        cacheReadTokens: 40,
        cacheWriteTokens: 40,
      },
    });
    expect(quote.reservedMicroCredits).toBe(100);

    const reservation = service.reserve({
      quoteId: quote.id,
      tenantId: "tenant_a",
      userId: "user_a",
      idempotencyKey: "reserve-run-1",
    });
    expect(service.getBalance("tenant_a")).toBe(900);
    expect(service.reserve({
      quoteId: quote.id,
      tenantId: "tenant_a",
      userId: "user_a",
      idempotencyKey: "reserve-run-1",
    }).id).toBe(reservation.id);
    expect(service.getBalance("tenant_a")).toBe(900);

    const duplicateEvent = {
      id: "usage-1-copy",
      runId: "run-1",
      modelSku: "renwork-standard",
      routeId: "route-openrouter-standard",
      providerResponseId: "provider-response-1",
      usage: {
        inputTokens: 20,
        outputTokens: 20,
        reasoningTokens: 20,
        cacheReadTokens: 20,
        cacheWriteTokens: 20,
      },
      measuredAt: "2026-08-28T12:00:01.000Z",
      accuracy: "reported" as const,
    };
    const receipt = service.settle({
      reservationId: reservation.id,
      runId: "run-1",
      events: [{ ...duplicateEvent, id: "usage-1" }, duplicateEvent],
      idempotencyKey: "settle-run-1",
    });

    expect(receipt.eventCount).toBe(1);
    expect(receipt.capturedMicroCredits).toBe(50);
    expect(receipt.releasedMicroCredits).toBe(50);
    expect(service.getBalance("tenant_a")).toBe(950);
    expect(service.settle({
      reservationId: reservation.id,
      runId: "run-1",
      events: [],
      idempotencyKey: "settle-run-1",
    }).id).toBe(receipt.id);
  });

  test("releases the full reservation when a run produces no billable usage", () => {
    const service = createRenCreditBillingService({
      catalog: createTestCatalog(),
      wallets: { tenant_a: 100 },
      now: () => new Date("2026-08-28T12:00:00.000Z"),
    });
    const quote = service.quote({
      modelSku: "renwork-standard",
      estimatedUsage: {
        inputTokens: 20,
        outputTokens: 20,
        reasoningTokens: 20,
        cacheReadTokens: 20,
        cacheWriteTokens: 20,
      },
    });
    const reservation = service.reserve({
      quoteId: quote.id,
      tenantId: "tenant_a",
      userId: "user_a",
      idempotencyKey: "reserve-failed-run",
    });
    service.release({ reservationId: reservation.id, idempotencyKey: "release-failed-run" });
    expect(service.getBalance("tenant_a")).toBe(100);
  });

  test("does not exempt official, BYOK, or local routes from token metering", () => {
    for (const source of ["official", "byok", "local"] as const) {
      const catalog = createTestCatalog();
      catalog.models[0]!.routes[0]!.source = source;
      const service = createRenCreditBillingService({
        catalog,
        wallets: { tenant_a: 100 },
        now: () => new Date("2026-08-28T12:00:00.000Z"),
      });
      const quote = service.quote({
        modelSku: "renwork-standard",
        estimatedUsage: {
          inputTokens: 1,
          outputTokens: 1,
          reasoningTokens: 1,
          cacheReadTokens: 1,
          cacheWriteTokens: 1,
        },
      });
      expect(quote.reservedMicroCredits).toBeGreaterThan(0);
      expect(quote.billingMode).toBe("token_metered");
    }
  });

  test("honors a super-admin free-source policy while still recording token usage", () => {
    const catalog = createTestCatalog();
    catalog.billingPolicy.local = "free";
    catalog.models[0]!.routes[0]!.source = "local";
    const service = createRenCreditBillingService({
      catalog,
      wallets: { tenant_a: 100 },
      now: () => new Date("2026-08-28T12:00:00.000Z"),
    });
    const quote = service.quote({
      modelSku: "renwork-standard",
      estimatedUsage: {
        inputTokens: 10,
        outputTokens: 10,
        reasoningTokens: 10,
        cacheReadTokens: 10,
        cacheWriteTokens: 10,
      },
    });
    expect(quote.billingMode).toBe("free");
    expect(quote.reservedMicroCredits).toBe(0);
  });
});
