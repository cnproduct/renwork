from typing import List
from app.models.schemas import (
    BuyerProfileInput,
    ExporterGraphInput,
    ScoreFactorBreakdown,
    ExplainabilityNode,
    OpportunityEvaluationResponse,
    BuyerGrade,
    EvidenceType
)

class ScoringAndInferenceEngine:
    """
    RenWork 评分与异动推理引擎 (PRD V1.0 增强版)
    融合 Double Signal (海关提单交易事实 + LinkedIn/官网公开业务信号)
    按 PRD 规范严格拆解为 Fact, Inference, Recommendation 三层解释树
    """

    def evaluate(self, buyer: BuyerProfileInput, exporter: ExporterGraphInput) -> OpportunityEvaluationResponse:
        # -------------------------------------------------------------
        # 1. 采购证据分 (Purchase Evidence) - 权重 0.30 [Fact]
        # -------------------------------------------------------------
        freq_score = min(100.0, (buyer.recent_shipment_count_90d / 6.0) * 100.0)
        teu_score = min(100.0, (buyer.total_teu_90d / 10.0) * 100.0)
        velocity_score = 95.0 if buyer.mom_growth_pct > 20.0 else (80.0 if buyer.mom_growth_pct >= 0 else 50.0)

        layer1_factors = [
            ScoreFactorBreakdown(
                name="90d_shipment_frequency",
                weight=0.40,
                score=round(freq_score, 1),
                contribution=round(freq_score * 0.40, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Recent 90d import frequency: {buyer.recent_shipment_count_90d} shipments."
            ),
            ScoreFactorBreakdown(
                name="container_volume_teu",
                weight=0.35,
                score=round(teu_score, 1),
                contribution=round(teu_score * 0.35, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Total imported container volume: {buyer.total_teu_90d} TEU."
            ),
            ScoreFactorBreakdown(
                name="mom_growth_velocity",
                weight=0.25,
                score=round(velocity_score, 1),
                contribution=round(velocity_score * 0.25, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Month-over-Month import growth velocity is +{buyer.mom_growth_pct}%."
            )
        ]
        layer1_score = sum(f.contribution for f in layer1_factors)

        # -------------------------------------------------------------
        # 2. 出口商匹配度分 (Exporter–Buyer Fit) - 权重 0.25 [Fact]
        # -------------------------------------------------------------
        matched_certs = [c for c in exporter.certifications if c in ["FDA", "LFGB", "GRS", "ISO9001", "CPC"]]
        cert_score = min(100.0, (len(matched_certs) / 3.0) * 100.0)
        cap_score = 95.0 if exporter.monthly_capacity_units >= 300000 else 80.0
        moq_score = 90.0 if exporter.moq <= 1000 else 75.0

        layer2_factors = [
            ScoreFactorBreakdown(
                name="certification_compliance_fit",
                weight=0.40,
                score=round(cert_score, 1),
                contribution=round(cert_score * 0.40, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Compliance certifications matched: {', '.join(matched_certs)}."
            ),
            ScoreFactorBreakdown(
                name="capacity_fulfillment_fit",
                weight=0.35,
                score=round(cap_score, 1),
                contribution=round(cap_score * 0.35, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Monthly capacity ({exporter.monthly_capacity_units} units) fulfills buyer scale."
            ),
            ScoreFactorBreakdown(
                name="moq_and_tooling_agility",
                weight=0.25,
                score=round(moq_score, 1),
                contribution=round(moq_score * 0.25, 2),
                evidence_type=EvidenceType.FACT,
                explanation=f"Agile MOQ ({exporter.moq} pcs) and fast tooling ({exporter.tooling_lead_time_days} days)."
            )
        ]
        layer2_score = sum(f.contribution for f in layer2_factors)

        # -------------------------------------------------------------
        # 3. 供应商格局与异动切入分 (Supplier Opportunity) - 权重 0.25 [Inference]
        # -------------------------------------------------------------
        hhi_score = 95.0 if buyer.primary_supplier_share_pct >= 70.0 else (80.0 if buyer.primary_supplier_share_pct >= 50.0 else 60.0)
        trend_score = 95.0 if buyer.primary_supplier_trend == "DECLINING" else (85.0 if buyer.primary_supplier_trend == "UNSTABLE" else 65.0)

        layer3_factors = [
            ScoreFactorBreakdown(
                name="supplier_concentration_hhi",
                weight=0.50,
                score=round(hhi_score, 1),
                contribution=round(hhi_score * 0.50, 2),
                evidence_type=EvidenceType.INFERENCE,
                explanation=f"Primary supplier holds {buyer.primary_supplier_share_pct}% share (High Dual-Sourcing Need)."
            ),
            ScoreFactorBreakdown(
                name="primary_supplier_transition_trend",
                weight=0.50,
                score=round(trend_score, 1),
                contribution=round(trend_score * 0.50, 2),
                evidence_type=EvidenceType.INFERENCE,
                explanation=f"Observed supplier transition trend: '{buyer.primary_supplier_trend}'."
            )
        ]
        layer3_score = sum(f.contribution for f in layer3_factors)

        # -------------------------------------------------------------
        # 4. 公开数字与 Double Signal 共振分 (Digital/Public Signals) - 权重 0.20 [Inference]
        # -------------------------------------------------------------
        public_score = 95.0 if buyer.has_recent_product_launch else 70.0
        contact_score = 95.0 if buyer.has_verified_contact else 60.0

        layer4_factors = [
            ScoreFactorBreakdown(
                name="public_product_expansion_signal",
                weight=0.60,
                score=round(public_score, 1),
                contribution=round(public_score * 0.60, 2),
                evidence_type=EvidenceType.INFERENCE,
                explanation=buyer.public_signal_description or "Observed new product launch in digital footprint."
            ),
            ScoreFactorBreakdown(
                name="contactability_verified",
                weight=0.40,
                score=round(contact_score, 1),
                contribution=round(contact_score * 0.40, 2),
                evidence_type=EvidenceType.FACT,
                explanation="Target procurement/sourcing decision maker verified with valid email."
            )
        ]
        layer4_score = sum(f.contribution for f in layer4_factors)

        # -------------------------------------------------------------
        # 5. 加权综合 Opportunity Priority Score (OPS)
        # -------------------------------------------------------------
        w1, w2, w3, w4 = 0.30, 0.25, 0.25, 0.20
        ops_final = round((layer1_score * w1) + (layer2_score * w2) + (layer3_score * w3) + (layer4_score * w4), 1)

        # PRD Table 51 分级标准
        if ops_final >= 90.0:
            grade = BuyerGrade.A_PLUS_PLUS
        elif ops_final >= 80.0:
            grade = BuyerGrade.A_PLUS
        elif ops_final >= 70.0:
            grade = BuyerGrade.A
        elif ops_final >= 50.0:
            grade = BuyerGrade.B
        else:
            grade = BuyerGrade.C

        double_signal_verified = (buyer.mom_growth_pct > 10.0 or buyer.recent_shipment_count_90d >= 5) and buyer.has_recent_product_launch

        # 推荐角度与 Why Now (PRD Table 52)
        if buyer.primary_supplier_share_pct >= 70.0 and buyer.primary_supplier_trend == "DECLINING":
            recommended_angle = "second_source_resilience"
            why_now = "近期采购持续增长，主供出货异动下滑，产品与出口商能力高度匹配，同时出现新品公开信号，且已找到采购负责人。"
        elif buyer.mom_growth_pct >= 30.0:
            recommended_angle = "backup_capacity_peak"
            why_now = "买家采购频次与箱量激增，出现显著旺季脉冲，现有产能交付吃紧，急需弹性保供产线。"
        elif "GRS" in exporter.certifications:
            recommended_angle = "esg_sustainable_compliance"
            why_now = "欧美环保合规法规收紧，买家公开宣布绿色低碳升级，GRS/PCR 认证材料切入成功率最高。"
        else:
            recommended_angle = "private_label_innovation"
            why_now = "买家自有品牌处于新品迭代周期，提供私模 3D 快速打样与极速交期可直接打破僵局。"

        explainability_tree = [
            ExplainabilityNode(
                category="1. Purchase Evidence [Fact]",
                score=round(layer1_score, 1),
                weight=w1,
                factors=layer1_factors
            ),
            ExplainabilityNode(
                category="2. Exporter–Buyer Fit [Fact]",
                score=round(layer2_score, 1),
                weight=w2,
                factors=layer2_factors
            ),
            ExplainabilityNode(
                category="3. Supplier Opportunity [Inference]",
                score=round(layer3_score, 1),
                weight=w3,
                factors=layer3_factors
            ),
            ExplainabilityNode(
                category="4. Digital & Public Signals [Inference]",
                score=round(layer4_score, 1),
                weight=w4,
                factors=layer4_factors
            )
        ]

        return OpportunityEvaluationResponse(
            buyer_account_id=buyer.buyer_account_id,
            exporter_id=exporter.exporter_id,
            purchase_evidence_score=round(layer1_score, 1),
            exporter_fit_score=round(layer2_score, 1),
            supplier_opportunity_score=round(layer3_score, 1),
            digital_public_signal_score=round(layer4_score, 1),
            opportunity_priority_score_ops=ops_final,
            buyer_grade=grade,
            double_signal_verified=double_signal_verified,
            recommended_angle=recommended_angle,
            why_now_rationale=why_now,
            explainability_tree=explainability_tree,
            credits_deducted=2
        )

# 全局单例
scoring_engine = ScoringAndInferenceEngine()
