import pytest
from app.services.continuous_learning import ContinuousLearningEngine
from app.models.schemas import CRMFeedbackEventRequest

def test_continuous_learning_adaptation():
    engine = ContinuousLearningEngine()
    event = CRMFeedbackEventRequest(
        exporter_id="EXP-101",
        buyer_account_id="BUYER-001",
        product_category="Sustainable Drinkware",
        target_market="North America",
        angle_used="second_source_resilience",
        event_type="SAMPLE_REQUESTED"
    )

    res = engine.process_feedback(event)
    assert res.status == "WEIGHT_MODEL_UPDATED"
    assert "second_source_resilience" in res.adjusted_weights
    # 权重总和应当严格归一化为 1.0 (考虑浮点精度)
    assert abs(sum(res.adjusted_weights.values()) - 1.0) < 0.01
