import pytest
from app.services.angle_decision import AngleDecisionAndOutreachEngine
from app.models.schemas import OutreachSequenceRequest, OutreachContactInput

def test_angle_decision_and_anti_surveillance():
    engine = AngleDecisionAndOutreachEngine()
    req = OutreachSequenceRequest(
        buyer_account_id="BUYER-001",
        buyer_company_name="Hydratech Global Solutions LLC",
        target_contact=OutreachContactInput(
            full_name="Sarah Jenkins",
            title="Director of Global Sourcing",
            email="sarah.jenkins@hydratech-solutions.com"
        ),
        specified_angle="second_source_resilience"
    )

    res = engine.generate_sequence(req)
    assert res.chosen_angle == "second_source_resilience"
    assert len(res.sequence) == 3
    assert res.anti_surveillance_audit_passed is True

    # 验证 Touch 1, Touch 2, Touch 3 的渠道与时序
    assert res.sequence[0].channel == "EMAIL"
    assert res.sequence[0].timing_day_offset == 0
    assert "Dual-sourcing" in res.sequence[0].subject_or_type

    assert res.sequence[1].channel == "LINKEDIN"
    assert res.sequence[1].timing_day_offset == 4

    assert res.sequence[2].channel == "EMAIL"
    assert res.sequence[2].timing_day_offset == 8
    assert "sample kit" in res.sequence[2].subject_or_type.lower()
