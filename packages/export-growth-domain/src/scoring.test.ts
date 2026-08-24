import { describe, expect, it } from "bun:test";
import {
  computeExponentialDecay,
  computePriorityScore,
  evaluateHardStops,
  classifyAccountTier,
} from "./scoring.js";
import { evaluateAccountWorkQueues } from "./work-queues.js";
import { computeEntityMergeScore } from "./entity-merge.js";
import type { Account360Aggregate } from "./account-360.js";
import type { HardStop } from "./entities.js";

describe("Export Growth Domain - Pure Function Specifications (Spec 14.3)", () => {
  // 1. 证明优先级分值在任何输入下均严格收敛于 [0, 100] 区间
  it("Property 1: Priority score strictly converges to [0, 100] across arbitrary extreme inputs", () => {
    const testCases = [
      { valueScore: 0, intentScore: 0, timingScore: 0, stageScore: 0, reachabilityScore: 0, historyScore: 0, riskScore: 0, evidenceConfidence: 0 },
      { valueScore: 100, intentScore: 100, timingScore: 100, stageScore: 100, reachabilityScore: 100, historyScore: 100, riskScore: 0, evidenceConfidence: 1.0 },
      { valueScore: 100, intentScore: 100, timingScore: 100, stageScore: 100, reachabilityScore: 100, historyScore: 100, riskScore: 100, evidenceConfidence: 1.0 },
      { valueScore: 9999, intentScore: 9999, timingScore: 9999, stageScore: 9999, reachabilityScore: 9999, historyScore: 9999, riskScore: -500, evidenceConfidence: 5.0 },
      { valueScore: -100, intentScore: -100, timingScore: -100, stageScore: -100, reachabilityScore: -100, historyScore: -100, riskScore: 9999, evidenceConfidence: -2.0 },
    ];

    for (const tc of testCases) {
      const res = computePriorityScore(tc);
      expect(res.rawPriority).toBeGreaterThanOrEqual(0);
      expect(res.rawPriority).toBeLessThanOrEqual(100);
      expect(res.dynamicPriority).toBeGreaterThanOrEqual(0);
      expect(res.dynamicPriority).toBeLessThanOrEqual(100);
    }

    // Randomized Property-based simulation (100 iterations)
    for (let i = 0; i < 100; i++) {
      const randScore = {
        valueScore: Math.random() * 200 - 50,
        intentScore: Math.random() * 200 - 50,
        timingScore: Math.random() * 200 - 50,
        stageScore: Math.random() * 200 - 50,
        reachabilityScore: Math.random() * 200 - 50,
        historyScore: Math.random() * 200 - 50,
        riskScore: Math.random() * 200 - 50,
        evidenceConfidence: Math.random() * 2 - 0.5,
      };
      const res = computePriorityScore(randScore);
      expect(res.dynamicPriority).toBeGreaterThanOrEqual(0);
      expect(res.dynamicPriority).toBeLessThanOrEqual(100);
    }
  });

  // 2. 证明信号衰减随时间单调递减
  it("Property 2: Exponential signal decay is strictly monotonic over time", () => {
    const baseWeight = 10.0;
    const halfLifeDays = 14;
    const t0 = 1000000;
    const dayMs = 24 * 3600 * 1000;

    let previousWeight = baseWeight;
    for (let day = 1; day <= 60; day++) {
      const currentT = t0 + day * dayMs;
      const currentWeight = computeExponentialDecay(baseWeight, t0, currentT, halfLifeDays);
      expect(currentWeight).toBeLessThan(previousWeight);
      expect(currentWeight).toBeGreaterThan(0);
      previousWeight = currentWeight;
    }

    // At exact half-life (14 days), weight should be exactly 50% (5.0)
    const halfLifeWeight = computeExponentialDecay(baseWeight, t0, t0 + 14 * dayMs, halfLifeDays);
    expect(Number(halfLifeWeight.toFixed(2))).toBe(5.00);
  });

  // 3. 证明仅凭单一弱登录信号绝对无法将客户提升至 S 级
  it("Property 3: Single weak login signal alone can NEVER promote an account to S Tier", () => {
    // Weak login signal contributes at most 2.0 points
    const weakInputs = {
      valueScore: 30, // low value
      intentScore: 2, // only weak signal
      timingScore: 0,
      stageScore: 10,
      reachabilityScore: 20,
      historyScore: 0,
      riskScore: 0,
      evidenceConfidence: 0.5,
    };
    const scoreRes = computePriorityScore(weakInputs);
    expect(scoreRes.dynamicPriority).toBeLessThan(45);

    const tierRes = classifyAccountTier(scoreRes.dynamicPriority, {
      hasStrongIntentOrTiming: false,
      isInNegotiationOrSampleStage: false,
    });

    expect(tierRes.tier).not.toBe("S");
    expect(tierRes.tier).not.toBe("A");
    expect(["C", "D"]).toContain(tierRes.tier);
  });

  // 4. 证明触发 Hard Stop 时所有营销推荐被 100% 阻断
  it("Property 4: Active Hard Stop completely blocks all automated marketing recommendations", () => {
    const activeHardStops: HardStop[] = [
      {
        riskType: "export_control_sanctions",
        severity: "critical",
        reason: "命中反洗钱与出口管制未经验证名单",
        active: true,
        detectedAt: new Date().toISOString(),
      },
    ];

    const hardStopEval = evaluateHardStops(activeHardStops);
    expect(hardStopEval.isBlocked).toBe(true);

    const tierRes = classifyAccountTier(95, {
      hasActiveHardStop: hardStopEval.isBlocked,
      hasStrongIntentOrTiming: true,
    });
    expect(tierRes.tier).toBe("D");
    expect(tierRes.capacityLimit).toBe(0);
  });

  // 5. 证明单客户可正确输出命中多个队列的结果集合
  it("Property 5: An account can match multiple work queues simultaneously", () => {
    const mockNow = Date.now();
    const mockAccount360: Account360Aggregate = {
      account: {
        id: "acc_001",
        canonicalName: "Acme European Importers",
        normalizedDomain: "acme-europe.com",
        country: "DE",
        buyerType: "importer_distributor",
        tier: "S",
        lifecycleStatus: "negotiating",
        aliases: ["Acme Europe GmbH"],
        subsidiaryRelationships: [],
      },
      buyingCommittee: [],
      supplyFit: {
        matchedProductIds: ["prod_101"],
        moqFitRatio: 1.0,
        priceBandCompatibility: "perfect",
        requiredCertificationsCovered: true,
        missingCertifications: [],
      },
      historicalMetrics: {
        totalOrdersCount: 3,
        lifetimeValueUsd: 150000,
        averageOrderValueUsd: 50000,
        averageGrossMarginRatio: 0.35,
        lastOrderDate: new Date(mockNow - 90 * 86400 * 1000).toISOString(),
        calculatedRepurchaseCycleDays: 90,
        nextExpectedOrderWindow: {
          start: new Date(mockNow - 5 * 86400 * 1000).toISOString(),
          end: new Date(mockNow + 10 * 86400 * 1000).toISOString(),
        },
      },
      signalsSummary: {
        latestActiveSignals: [
          {
            signalType: "RFQ_SPEC_PRICE_REQUEST",
            strength: 8.0,
            occurredAt: new Date(mockNow - 2 * 86400 * 1000).toISOString(),
            effectiveWeight: 7.5,
          },
        ],
        recentCustomsShipments: [
          {
            shipmentDate: new Date(mockNow - 10 * 86400 * 1000).toISOString(),
            hsCode: "841810",
            volumeBand: "10-20 TEU",
            originCountry: "CN",
          },
        ],
        lastActivity: {
          channel: "email",
          summary: "Sent quotation sheet v1.2",
          occurredAt: new Date(mockNow - 5 * 86400 * 1000).toISOString(), // 5 days ago (stalled)
        },
      },
      decisionState: {
        latestScoreSnapshot: {
          dynamicPriority: 88,
          valueScore: 90,
          intentScore: 85,
          timingScore: 80,
          stageScore: 75,
          reachabilityScore: 90,
          riskScore: 0,
          evidenceConfidence: 0.95,
          calculatedAt: new Date().toISOString(),
          modelVersion: "v1.0",
        },
        activeQueueMemberships: [],
        activeHardStops: [],
      },
    };

    const matchedQueues = evaluateAccountWorkQueues(mockAccount360, mockNow);
    const matchedCodes = matchedQueues.map((q) => q.queueCode);

    // Should match TODAY_MUST_FOLLOW (>24h since activity with recent RFQ), QUOTE_STALLED (negotiating + 5d), REPURCHASE_WINDOW (in window), SUPPLY_SHIFT (has shipments)
    expect(matchedCodes).toContain("TODAY_MUST_FOLLOW");
    expect(matchedCodes).toContain("QUOTE_STALLED");
    expect(matchedCodes).toContain("REPURCHASE_WINDOW");
    expect(matchedCodes).toContain("SUPPLY_SHIFT");
    expect(matchedQueues.length).toBeGreaterThanOrEqual(4);
  });

  // 6. 验证多源实体合并解析置信度矩阵
  it("Entity Merge: Computes accurate confidence matching and blocks conflicting entities", () => {
    // Exact domain (+0.60) + Normalized name match (+0.30) = 0.90
    const merge1 = computeEntityMergeScore(
      { name: "Acme Global Co.", normalizedDomain: "acmeglobal.com", country: "US" },
      { name: "Acme Global Ltd.", normalizedDomain: "acmeglobal.com", country: "US" }
    );
    expect(merge1.totalScore).toBeGreaterThanOrEqual(0.90);
    expect(merge1.hasConflict).toBe(false);
    expect(merge1.decision).toBe("review_required");

    // Exact registration number (+0.80) + domain (+0.60) = 1.0 -> auto_merge
    const mergeAuto = computeEntityMergeScore(
      { name: "Alpha Tech Inc", registrationNumber: "US-987654", normalizedDomain: "alphatech.com", country: "US" },
      { name: "Alpha Tech LLC", registrationNumber: "US-987654", normalizedDomain: "alphatech.com", country: "US" }
    );
    expect(mergeAuto.totalScore).toBeGreaterThanOrEqual(0.98);
    expect(mergeAuto.decision).toBe("auto_merge");

    // Country conflict
    const merge2 = computeEntityMergeScore(
      { name: "Sun Pharma Inc", country: "US" },
      { name: "Sun Pharma Ltd", country: "DE" }
    );
    expect(merge2.hasConflict).toBe(true);
    expect(merge2.decision).toBe("review_required");

    // Subsidiary relationship
    const merge3 = computeEntityMergeScore(
      { name: "Parent Company", isSubsidiary: true },
      { name: "Child Division", isSubsidiary: false }
    );
    expect(merge3.hasConflict).toBe(true);
    expect(merge3.decision).toBe("create_new");
  });
});
