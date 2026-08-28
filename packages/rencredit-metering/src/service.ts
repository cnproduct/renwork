import { findPublishedAdminModel } from "./catalog.js";
import {
  type RenWorkAdminModelCatalog,
  type RenWorkTokenQuote,
  type RenWorkTokenReceipt,
  type RenWorkTokenReservation,
  type RenWorkTokenUsageEvent,
} from "./contracts.js";
import { addTokenUsage, calculateRenCreditMicroCharge, EMPTY_TOKEN_USAGE } from "./metering.js";

type Clock = () => Date;
type IdFactory = (prefix: string) => string;

export interface RenCreditBillingServiceOptions {
  catalog: RenWorkAdminModelCatalog;
  wallets: Readonly<Record<string, number>>;
  now?: Clock;
  createId?: IdFactory;
}

export interface ReserveTokenQuoteInput {
  quoteId: string;
  tenantId: string;
  userId: string;
  idempotencyKey: string;
}

export interface SettleTokenReservationInput {
  reservationId: string;
  runId: string;
  events: RenWorkTokenUsageEvent[];
  idempotencyKey: string;
}

export function createRenCreditBillingService(options: RenCreditBillingServiceOptions) {
  const now = options.now ?? (() => new Date());
  let sequence = 0;
  const createId = options.createId ?? ((prefix) => `${prefix}_${now().getTime()}_${++sequence}`);
  const wallets = new Map(Object.entries(options.wallets));
  const quotes = new Map<string, RenWorkTokenQuote>();
  const reservations = new Map<string, RenWorkTokenReservation>();
  const reservationByIdempotencyKey = new Map<string, string>();
  const receipts = new Map<string, RenWorkTokenReceipt>();
  const receiptByIdempotencyKey = new Map<string, string>();

  return {
    getBalance(tenantId: string): number {
      return wallets.get(tenantId) ?? 0;
    },

    quote(input: { modelSku: string; estimatedUsage: RenWorkTokenQuote["estimatedUsage"]; ttlMs?: number }): RenWorkTokenQuote {
      const model = findPublishedAdminModel(options.catalog, input.modelSku);
      const createdAt = now();
      const quote: RenWorkTokenQuote = {
        id: createId("quote"),
        catalogVersion: options.catalog.version,
        modelSku: model.sku,
        estimatedUsage: { ...input.estimatedUsage },
        reservedMicroCredits: calculateRenCreditMicroCharge(input.estimatedUsage, model, createdAt),
        expiresAt: new Date(createdAt.getTime() + (input.ttlMs ?? 5 * 60_000)).toISOString(),
      };
      quotes.set(quote.id, quote);
      return quote;
    },

    reserve(input: ReserveTokenQuoteInput): RenWorkTokenReservation {
      const existingId = reservationByIdempotencyKey.get(input.idempotencyKey);
      if (existingId) return reservations.get(existingId)!;
      const quote = quotes.get(input.quoteId);
      if (!quote) throw new Error("Quote not found.");
      if (Date.parse(quote.expiresAt) <= now().getTime()) throw new Error("Quote expired.");
      const balance = wallets.get(input.tenantId) ?? 0;
      if (balance < quote.reservedMicroCredits) throw new Error("INSUFFICIENT_RENCREDIT");
      wallets.set(input.tenantId, balance - quote.reservedMicroCredits);
      const reservation: RenWorkTokenReservation = {
        id: createId("reservation"),
        quoteId: quote.id,
        tenantId: input.tenantId,
        userId: input.userId,
        modelSku: quote.modelSku,
        catalogVersion: quote.catalogVersion,
        reservedMicroCredits: quote.reservedMicroCredits,
        status: "reserved",
        createdAt: now().toISOString(),
      };
      reservations.set(reservation.id, reservation);
      reservationByIdempotencyKey.set(input.idempotencyKey, reservation.id);
      return reservation;
    },

    settle(input: SettleTokenReservationInput): RenWorkTokenReceipt {
      const existingId = receiptByIdempotencyKey.get(input.idempotencyKey);
      if (existingId) return receipts.get(existingId)!;
      const reservation = reservations.get(input.reservationId);
      if (!reservation || reservation.status !== "reserved") throw new Error("Active reservation not found.");
      const model = findPublishedAdminModel(options.catalog, reservation.modelSku);
      const uniqueEvents = [...new Map(input.events.map((event) => [event.providerResponseId, event])).values()];
      const usage = uniqueEvents.reduce((total, event) => addTokenUsage(total, event.usage), { ...EMPTY_TOKEN_USAGE });
      const capturedMicroCredits = calculateRenCreditMicroCharge(usage, model, new Date(reservation.createdAt));
      if (capturedMicroCredits > reservation.reservedMicroCredits) throw new Error("ADDITIONAL_RESERVATION_REQUIRED");
      const releasedMicroCredits = reservation.reservedMicroCredits - capturedMicroCredits;
      wallets.set(reservation.tenantId, (wallets.get(reservation.tenantId) ?? 0) + releasedMicroCredits);
      reservation.status = "captured";
      const receipt: RenWorkTokenReceipt = {
        id: createId("receipt"),
        reservationId: reservation.id,
        runId: input.runId,
        tenantId: reservation.tenantId,
        userId: reservation.userId,
        modelSku: reservation.modelSku,
        catalogVersion: reservation.catalogVersion,
        usage,
        capturedMicroCredits,
        releasedMicroCredits,
        eventCount: uniqueEvents.length,
        createdAt: now().toISOString(),
      };
      receipts.set(receipt.id, receipt);
      receiptByIdempotencyKey.set(input.idempotencyKey, receipt.id);
      return receipt;
    },

    release(input: { reservationId: string; idempotencyKey: string }): RenWorkTokenReservation {
      const reservation = reservations.get(input.reservationId);
      if (!reservation) throw new Error("Reservation not found.");
      if (reservation.status === "released") return reservation;
      if (reservation.status !== "reserved") throw new Error("Reservation already captured.");
      wallets.set(reservation.tenantId, (wallets.get(reservation.tenantId) ?? 0) + reservation.reservedMicroCredits);
      reservation.status = "released";
      return reservation;
    },
  };
}
