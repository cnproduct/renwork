import pytest
from app.services.scoring_engine import ScoringAndInferenceEngine
from app.models.schemas import BuyerProfileInput, ExporterGraphInput

def test_scoring_high_intent_r1():
    engine = ScoringAndInferenceEngine()
    buyer = BuyerProfileInput(
        buyer_account_id="BUYER-001",
        company_name="Hydratech Global Solutions LLC",
        recent_shipment_count_90d=8,
        total_teu_90d=16.0,
        mom_growth_pct=28.0,
        primary_supplier_share_pct=78.0,
        primary_supplier_trend="DECLINING"
    )
    exporter = ExporterGraphInput(
        exporter_id="EXP-101",
        company_name="Zenith Eco Drinkware",
        certifications=["FDA", "LFGB", "GRS", "ISO9001"],
        monthly_capacity_units=600000,
        moq=500,
        tooling_lead_time_days=7
    )

    res = engine.evaluate(buyer, exporter)
    assert res.opportunity_priority_score_ops >= 80.0
    assert "A" in res.buyer_grade
    assert res.recommended_angle == "second_source_resilience"
    assert len(res.explainability_tree) == 4
    assert "Dual-Sourcing" in res.why_now_rationale or "主供" in res.why_now_rationale

def test_scoring_peak_demand():
    engine = ScoringAndInferenceEngine()
    buyer = BuyerProfileInput(
        buyer_account_id="BUYER-002",
        company_name="Pacific Outdoor Brands",
        recent_shipment_count_90d=5,
        total_teu_90d=10.0,
        mom_growth_pct=45.0,  # 旺季激增
        primary_supplier_share_pct=45.0,
        primary_supplier_trend="STABLE"
    )
    exporter = ExporterGraphInput(
        exporter_id="EXP-101",
        company_name="Zenith Eco Drinkware",
        certifications=["FDA", "CE"],
        monthly_capacity_units=500000,
        moq=1000,
        tooling_lead_time_days=10
    )

    res = engine.evaluate(buyer, exporter)
    assert res.recommended_angle == "backup_capacity_peak"
    assert "旺季" in res.why_now_rationale
