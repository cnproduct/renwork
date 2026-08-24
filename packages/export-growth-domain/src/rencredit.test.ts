import { describe, expect, it } from "bun:test";
import { BVU_PRICING_TABLE, type BvuOperationCode } from "./rencredit.js";

// Simulated In-Memory Double-Entry Ledger for Testing Invariants
class MockRenCreditWalletEngine {
  private availableBalance = 100;
  private reservedBalance = 0;
  private reservations = new Map<string, { operationCode: BvuOperationCode; amount: number; state: "reserved" | "captured" | "released" }>();
  private ledger: Array<{ type: string; amount: number; balanceAfter: number; idempotencyKey: string }> = [];

  getBalance() {
    return { available: this.availableBalance, reserved: this.reservedBalance };
  }

  // 1. Quote
  quote(op: BvuOperationCode, quantity = 1) {
    const item = BVU_PRICING_TABLE[op];
    return {
      quoteId: `quote_${Date.now()}`,
      operationCode: op,
      unitPrice: item.price,
      quantity,
      totalAmount: item.price * quantity,
      expiresAt: Date.now() + 300_000, // 5 min
    };
  }

  // 2. Reserve
  reserve(reservationId: string, amount: number, op: BvuOperationCode, idempotencyKey: string) {
    if (this.reservations.has(reservationId)) {
      return { ok: true, duplicate: true };
    }
    if (this.availableBalance < amount) {
      throw new Error("INSUFFICIENT_RENCREDIT: Available balance is less than required reserve amount");
    }
    this.availableBalance -= amount;
    this.reservedBalance += amount;
    this.reservations.set(reservationId, { operationCode: op, amount, state: "reserved" });
    this.ledger.push({ type: "reserve", amount, balanceAfter: this.availableBalance, idempotencyKey });
    return { ok: true, reservationId };
  }

  // 3. Capture (Successful delivery acceptance)
  capture(reservationId: string, actualAmount: number, idempotencyKey: string) {
    const res = this.reservations.get(reservationId);
    if (!res) throw new Error("RESERVATION_NOT_FOUND");
    if (res.state !== "reserved") throw new Error(`INVALID_STATE: ${res.state}`);
    if (actualAmount > res.amount) throw new Error("CAPTURE_EXCEEDS_RESERVED");

    // Release any uncaptured portion if actual < reserved
    const refund = res.amount - actualAmount;
    this.reservedBalance -= res.amount;
    this.availableBalance += refund;
    res.state = "captured";

    this.ledger.push({ type: "capture", amount: actualAmount, balanceAfter: this.availableBalance, idempotencyKey });
    return {
      ok: true,
      receiptId: `rcpt_${Date.now()}`,
      capturedAmount: actualAmount,
      refundedAmount: refund,
      signature: "MOCK_HMAC_SHA256_SIGNATURE",
    };
  }

  // 4. Release (Failed / Timed-out / Cancelled job)
  release(reservationId: string, idempotencyKey: string) {
    const res = this.reservations.get(reservationId);
    if (!res) throw new Error("RESERVATION_NOT_FOUND");
    if (res.state !== "reserved") throw new Error(`INVALID_STATE: ${res.state}`);

    this.reservedBalance -= res.amount;
    this.availableBalance += res.amount; // 100% refund
    res.state = "released";

    this.ledger.push({ type: "release", amount: res.amount, balanceAfter: this.availableBalance, idempotencyKey });
    return { ok: true, releasedAmount: res.amount };
  }
}

describe("RenCredit Cloud Billing & Double-Entry Ledger Specification (Spec Section 10)", () => {
  it("Validates all 8 BVU operation pricing benchmarks", () => {
    expect(BVU_PRICING_TABLE.TWIN_BUILD.price).toBe(50);
    expect(BVU_PRICING_TABLE.CUSTOMER_CLEAN_1K.price).toBe(10);
    expect(BVU_PRICING_TABLE.ACCOUNT_ENRICH.price).toBe(3);
    expect(BVU_PRICING_TABLE.ACCOUNT_MONITOR_MONTH.price).toBe(5);
    expect(BVU_PRICING_TABLE.DEAL_DIAGNOSE.price).toBe(8);
    expect(BVU_PRICING_TABLE.COMPLIANCE_AUDIT.price).toBe(15);
    expect(BVU_PRICING_TABLE.PRODUCT_OPPORTUNITY_REPORT.price).toBe(30);
    expect(BVU_PRICING_TABLE.BENCHMARK_REPORT.price).toBe(20);
  });

  it("Standard Successful Flow: Quote -> Reserve -> Delivery -> Capture", () => {
    const engine = new MockRenCreditWalletEngine();
    expect(engine.getBalance().available).toBe(100);

    // 1. Quote for Account Enrich (3 credits)
    const quote = engine.quote("ACCOUNT_ENRICH", 2); // 2 accounts = 6 credits
    expect(quote.totalAmount).toBe(6);

    // 2. Reserve
    engine.reserve("res_001", quote.totalAmount, "ACCOUNT_ENRICH", "idem_001");
    expect(engine.getBalance().available).toBe(94);
    expect(engine.getBalance().reserved).toBe(6);

    // 3. User Accepts Delivery -> Capture
    const receipt = engine.capture("res_001", 6, "idem_capture_001");
    expect(receipt.capturedAmount).toBe(6);
    expect(receipt.refundedAmount).toBe(0);
    expect(engine.getBalance().available).toBe(94);
    expect(engine.getBalance().reserved).toBe(0);
  });

  it("100% Refund Guarantee Flow: Reserve -> Task Timeout/Failure -> 100% Release", () => {
    const engine = new MockRenCreditWalletEngine();
    expect(engine.getBalance().available).toBe(100);

    // Reserve for Compliance Audit (15 credits)
    engine.reserve("res_002", 15, "COMPLIANCE_AUDIT", "idem_002");
    expect(engine.getBalance().available).toBe(85);
    expect(engine.getBalance().reserved).toBe(15);

    // External provider fails or user cancels -> Release
    const res = engine.release("res_002", "idem_release_002");
    expect(res.releasedAmount).toBe(15);
    expect(engine.getBalance().available).toBe(100); // 100% restored
    expect(engine.getBalance().reserved).toBe(0);
  });

  it("Invariant: Available Balance can never fall below 0", () => {
    const engine = new MockRenCreditWalletEngine();
    expect(() => {
      engine.reserve("res_excess", 150, "TWIN_BUILD", "idem_excess");
    }).toThrow("INSUFFICIENT_RENCREDIT");
    expect(engine.getBalance().available).toBe(100);
  });
});
