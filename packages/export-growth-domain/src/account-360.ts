import { z } from "zod";
import { buyerTypeSchema, accountTierSchema, accountLifecycleStatusSchema, buyingCommitteeRoleSchema } from "./entities.js";

export const account360AggregateSchema = z.object({
  account: z.object({
    id: z.string().min(1),
    canonicalName: z.string().min(1),
    normalizedDomain: z.string().nullable(),
    country: z.string().min(2).max(3),
    buyerType: buyerTypeSchema,
    tier: accountTierSchema,
    lifecycleStatus: accountLifecycleStatusSchema,
    aliases: z.array(z.string()).default([]),
    subsidiaryRelationships: z.array(
      z.object({
        relatedAccountId: z.string().min(1),
        type: z.enum(["parent", "subsidiary", "sister"]),
      })
    ).default([]),
  }),
  buyingCommittee: z.array(
    z.object({
      contactId: z.string().min(1),
      fullName: z.string().min(1),
      jobTitle: z.string().min(1),
      role: buyingCommitteeRoleSchema,
      influenceLevel: z.enum(["high", "medium", "low"]),
      contactability: z.object({
        email: z.string().email(),
        emailDeliverable: z.boolean(),
        phone: z.string().nullable(),
        whatsApp: z.string().nullable(),
      }),
      consentStatus: z.object({
        optInMarketing: z.boolean(),
        consentTimestamp: z.string(),
      }),
    })
  ),
  supplyFit: z.object({
    matchedProductIds: z.array(z.string()),
    moqFitRatio: z.number().min(0),
    priceBandCompatibility: z.enum(["perfect", "acceptable", "out_of_range"]),
    requiredCertificationsCovered: z.boolean(),
    missingCertifications: z.array(z.string()),
  }),
  historicalMetrics: z.object({
    totalOrdersCount: z.number().int().nonnegative(),
    lifetimeValueUsd: z.number().nonnegative(),
    averageOrderValueUsd: z.number().nonnegative(),
    averageGrossMarginRatio: z.number().min(0).max(1),
    lastOrderDate: z.string().nullable(),
    calculatedRepurchaseCycleDays: z.number().nullable(),
    nextExpectedOrderWindow: z.object({
      start: z.string(),
      end: z.string(),
    }).nullable(),
  }),
  signalsSummary: z.object({
    latestActiveSignals: z.array(
      z.object({
        signalType: z.string(),
        strength: z.number(),
        occurredAt: z.string(),
        effectiveWeight: z.number(),
      })
    ),
    recentCustomsShipments: z.array(
      z.object({
        shipmentDate: z.string(),
        hsCode: z.string(),
        volumeBand: z.string(),
        originCountry: z.string(),
      })
    ),
    lastActivity: z.object({
      channel: z.string(),
      summary: z.string(),
      occurredAt: z.string(),
    }).nullable(),
  }),
  decisionState: z.object({
    latestScoreSnapshot: z.object({
      dynamicPriority: z.number().min(0).max(100),
      valueScore: z.number().min(0).max(100),
      intentScore: z.number().min(0).max(100),
      timingScore: z.number().min(0).max(100),
      stageScore: z.number().min(0).max(100),
      reachabilityScore: z.number().min(0).max(100),
      riskScore: z.number().min(0).max(100),
      evidenceConfidence: z.number().min(0).max(1),
      calculatedAt: z.string(),
      modelVersion: z.string(),
    }),
    activeQueueMemberships: z.array(
      z.object({
        queueCode: z.string(),
        priority: z.number(),
        enteredAt: z.string(),
        dueAt: z.string().nullable(),
      })
    ),
    activeHardStops: z.array(
      z.object({
        riskType: z.string(),
        severity: z.string(),
        reason: z.string(),
      })
    ),
  }),
});

export type Account360Aggregate = z.infer<typeof account360AggregateSchema>;
