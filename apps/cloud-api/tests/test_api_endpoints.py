import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["forwarder_patterns_loaded"] > 100000
    assert data["prd_version"] == "PRD_V1.0_COMPLIANT"

def test_api_entities_resolve_with_credits():
    payload = {
        "raw_consignee_text": "HYDRATECH GLOBAL SOLUTIONS LLC C/O EXPEDITORS INTL",
        "address_text": "123 INNOVATION WAY, IRVINE, CA 92618",
        "workspace_id": "WS-DEFAULT-001"
    }
    response = client.post("/api/v1/entities/resolve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["entity"]["is_freight_forwarder"] is False
    assert "Retailer" in data["entity"]["buyer_type"] or "Brand" in data["entity"]["buyer_type"]
    assert data["entity"]["evidence_tag"] == "Fact"
    assert data["credits_deducted"] == 1
    assert "Hydratech" in data["entity"]["canonical_name"]

def test_api_intent_evaluate_double_signal():
    payload = {
        "buyer_profile": {
            "buyer_account_id": "BUYER-US-001",
            "company_name": "Hydratech Global Solutions LLC",
            "destination_country": "US",
            "recent_shipment_count_90d": 7,
            "total_teu_90d": 14.0,
            "mom_growth_pct": 22.0,
            "primary_supplier_share_pct": 74.0,
            "primary_supplier_trend": "DECLINING",
            "target_hs_codes": ["3924.10"],
            "has_recent_product_launch": True,
            "has_verified_contact": True
        },
        "exporter_graph": {
            "exporter_id": "EXP-7701",
            "company_name": "Zenith Drinkware Co",
            "product_categories": ["Sustainable Drinkware"],
            "certifications": ["FDA", "LFGB", "GRS", "CPC"],
            "monthly_capacity_units": 500000,
            "moq": 1000,
            "tooling_lead_time_days": 7
        },
        "workspace_id": "WS-DEFAULT-001"
    }
    response = client.post("/api/v1/intent/evaluate-opportunity", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["opportunity_priority_score_ops"] >= 80.0
    assert "A" in data["buyer_grade"]
    assert data["double_signal_verified"] is True
    assert data["recommended_angle"] == "second_source_resilience"
    assert len(data["explainability_tree"]) == 4

def test_api_outreach_chatcut_multimodal():
    payload = {
        "buyer_account_id": "BUYER-US-001",
        "buyer_company_name": "Hydratech Global Solutions LLC",
        "target_contact": {
            "full_name": "Sarah Jenkins",
            "title": "Director of Global Sourcing",
            "email": "sarah.jenkins@hydratech-solutions.com",
            "linkedin_url": "https://www.linkedin.com/in/sarah-jenkins-sourcing"
        },
        "specified_angle": "second_source_resilience",
        "include_chatcut_video_pitch": True,
        "workspace_id": "WS-DEFAULT-001"
    }
    response = client.post("/api/v1/outreach/generate-sequence", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["chosen_angle"] == "second_source_resilience"
    assert len(data["sequence"]) == 3
    assert data["anti_surveillance_audit_passed"] is True
    assert data["requires_human_approval"] is True
    assert "3d-preview.mp4" in data["multimodal_assets"]["track_3_chatcut_video_pitch_url"]
    assert data["multimodal_assets"]["track_3_video_duration_seconds"] == 18

def test_api_actions_approval_and_audit():
    # 模拟人工操作员审批
    payload = {
        "action_id": "ACT-20260820-9901",
        "approved_by_user_id": "USER-SARAH-LEAD",
        "approval_decision": "APPROVED",
        "reason": "Verified that buyer opened sample inquiry; approving 3-touch sequence dispatch."
    }
    response = client.post("/api/v1/actions/approve", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ACTION_APPROVED_AND_QUEUED"
    assert len(data["audit_hash"]) > 0

    # 查阅审计日志
    audit_res = client.get("/api/v1/actions/audit-logs")
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) >= 1
    assert logs[-1]["user_id"] == "USER-SARAH-LEAD"

def test_api_credits_balance():
    response = client.get("/api/v1/credits/balance?workspace_id=WS-DEFAULT-001")
    assert response.status_code == 200
    data = response.json()
    assert data["workspace_id"] == "WS-DEFAULT-001"
    assert data["remaining_credits"] > 0
    assert data["active_monitoring_accounts_count"] >= 18

def test_api_signals_feedback_event():
    payload = {
        "exporter_id": "EXP-7701",
        "buyer_account_id": "BUYER-US-001",
        "product_category": "Sustainable Drinkware",
        "target_market": "North America",
        "angle_used": "second_source_resilience",
        "event_type": "POSITIVE_REPLY",
        "feedback_notes": "Buyer replied asking for mold tolerance sheet."
    }
    response = client.post("/api/v1/signals/feedback-event", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "WEIGHT_MODEL_UPDATED"
    assert "second_source_resilience" in data["adjusted_weights"]

def test_api_orchestrator_daily_queue():
    response = client.get("/api/v1/orchestrator/daily-queue")
    assert response.status_code == 200
    data = response.json()
    assert data["total_in_queue"] >= 3
    assert data["high_priority_count"] >= 1
    first_item = data["items"][0]
    assert first_item["ops_score"] >= 80.0
    assert "已共振" in first_item["double_signal_status"]
