"""
RenWork × OKKI V2.0 - 全套集成与信用点计量自动化测试
Comprehensive Automated Test Suite for OKKI Integration, Deduplication, Handoff & Credits
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.okki_schemas import MatchStatus, HandoffTier, HandoffDecision

client = TestClient(app)

SAMPLE_OKKI_RECORDS = [
    {
        "okki_customer_id": "OKKI-1001",
        "company_name": "ACME INDUSTRIAL SOLUTIONS GMBH",
        "country": "Germany",
        "address": "Industriestrasse 42, 20457 Hamburg",
        "website": "https://www.acme-industrial.de",
        "domain": "acme-industrial.de",
        "contact_name": "Klaus Weber",
        "email": "k.weber@acme-industrial.de",
        "phone": "+49 40 12345678",
        "owner_name": "张三 (Sales Rep A)",
        "customer_stage": "QUOTING",
        "last_followup_date": "2026-08-10T09:00:00Z",
        "deal_status": "OPEN_DEAL"
    },
    {
        "okki_customer_id": "OKKI-1002",
        "company_name": "PACIFIC OCEAN IMPORTERS LLC",
        "country": "United States",
        "address": "900 Ocean Blvd, Long Beach, CA 90802",
        "website": "https://pacific-ocean.com",
        "domain": "pacific-ocean.com",
        "contact_name": "David Miller",
        "email": "david@pacific-ocean.com",
        "phone": "+1 562 9876543",
        "owner_name": "李四 (Sales Rep B)",
        "customer_stage": "DORMANT",
        "last_followup_date": "2025-10-01T12:00:00Z",  # >180 days ago -> S4 Dormant
        "deal_status": "NO_RECENT_DEAL"
    }
]


def test_okki_snapshot_import():
    """测试 1: 导入 OKKI 存量快照并验证索引构建与 0 扣费"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "records": SAMPLE_OKKI_RECORDS,
        "source_crm": "OKKI"
    }
    response = client.post("/api/v1/crm/snapshot/import", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SNAPSHOT_IMPORTED"
    assert data["records_imported"] == 2
    assert data["snapshot_metadata"]["record_count"] == 2
    assert data["snapshot_metadata"]["freshness"] == "FRESH"
    assert data["credits_deducted"] == 0


def test_okki_snapshot_freshness():
    """测试 2: 查询快照新鲜度与有效期"""
    response = client.get("/api/v1/crm/snapshot/freshness?workspace_id=WS-TEST-001")
    assert response.status_code == 200
    data = response.json()
    assert data["freshness"] == "FRESH"
    assert data["cached_records_count"] == 2
    assert data["ttl_days"] == 14


def test_deduplication_exact_match():
    """测试 3: 域名完全一致触发 S1_EXACT_MATCH 并扣除 1 credit"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "prospect_name": "Acme Industrial Solutions Co., Ltd.",
        "prospect_domain": "acme-industrial.de",
        "prospect_country": "DE",
        "prospect_email": "purchasing@acme-industrial.de"
    }
    response = client.post("/api/v1/crm/deduplicate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["final_verdict"] == MatchStatus.S1_EXACT_MATCH.value
    assert data["best_match"]["okki_customer_id"] == "OKKI-1001"
    assert data["best_match"]["confidence_score"] >= 0.90
    assert data["credits_deducted"] == 1
    assert "强行阻断" in data["action_recommendation"]


def test_deduplication_dormant_customer():
    """测试 4: 匹配到存量客户但超过 180 天未跟进，触发 S4_DORMANT_CUSTOMER"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "prospect_name": "Pacific Ocean Importers Inc.",
        "prospect_domain": "pacific-ocean.com",
        "prospect_country": "US"
    }
    response = client.post("/api/v1/crm/deduplicate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["final_verdict"] == MatchStatus.S4_DORMANT_CUSTOMER.value
    assert data["best_match"]["okki_customer_id"] == "OKKI-1002"
    assert data["best_match"]["dormant_days"] > 180
    assert "沉睡客户" in data["action_recommendation"]


def test_deduplication_verified_new():
    """测试 5: 全新未知买家，经比对无冲突触发 S7_VERIFIED_NEW_PROSPECT"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "prospect_name": "GLOBAL NORDIC HYDRAULICS BV",
        "prospect_domain": "nordic-hydraulics.nl",
        "prospect_country": "NL",
        "prospect_email": "contact@nordic-hydraulics.nl"
    }
    response = client.post("/api/v1/crm/deduplicate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["final_verdict"] == MatchStatus.S7_VERIFIED_NEW.value
    assert "确认为全新潜在买家" in data["action_recommendation"]


def test_deduplication_forwarder_excluded():
    """测试 6: 命中货代黑名单直接返回 S8_EXCLUDED"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "prospect_name": "EXPEDITORS INTERNATIONAL FORWARDING LLC",
        "prospect_country": "US"
    }
    response = client.post("/api/v1/crm/deduplicate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "COMPLETED"
    assert data["final_verdict"] == MatchStatus.S8_EXCLUDED.value
    assert "货代或排除黑名单" in data["action_recommendation"]


def test_qualified_handoff_gate_and_packaging():
    """测试 7: Tier 4 积极回复线索交接封包，验证门禁放行与扣除 3 credits"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "qualification_tier": HandoffTier.TIER_4_REPLIED.value,
        "company_profile": {
            "normalized_name": "Hydratech Global Solutions",
            "legal_name": "Hydratech Global Solutions LLC",
            "root_domain": "hydratech-solutions.com",
            "country_code": "US",
            "city": "Irvine",
            "address": "123 Innovation Way, Irvine, CA 92618",
            "website": "https://www.hydratech-solutions.com",
            "industry_category": "Sustainable Drinkware & Precision Bottles"
        },
        "primary_contact": {
            "full_name": "Sarah Jenkins",
            "title": "Director of Global Sourcing",
            "email": "sarah.jenkins@hydratech-solutions.com",
            "email_verification": "Deliverable (SMTP 250 OK)",
            "linkedin_url": "https://www.linkedin.com/in/sarah-jenkins-sourcing"
        },
        "customs_evidence": {
            "hs_code": "3924.10",
            "annual_volume": 320.5,
            "last_shipment_date": "2026-07-20",
            "origin_countries": ["CN", "VN"]
        },
        "outreach_history": {
            "campaign_name": "2026 Q3 US Scaling Drinkware Campaign",
            "selected_angle": "second_source_resilience",
            "reply_snippet": "We are looking for dual-sourcing partners for our 2027 flask lines."
        },
        "sales_rep_id": "SALES-REP-01"
    }
    response = client.post("/api/v1/crm/handoff", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["handoff_decision"] == HandoffDecision.REQUIRED.value
    assert data["credits_deducted"] == 3
    assert "okki_import_template" in data
    assert data["okki_import_template"]["company_info"]["name"] == "Hydratech Global Solutions LLC"
    assert data["okki_import_template"]["contact_info"]["email"] == "sarah.jenkins@hydratech-solutions.com"


def test_customer_sync_api():
    """测试 8: 存量客户 API 增量活动记录同步并扣除 1 credit"""
    payload = {
        "workspace_id": "WS-TEST-001",
        "okki_customer_id": "OKKI-1001",
        "sync_direction": "RENWORK_TO_OKKI",
        "activities": [
            {
                "activity_type": "EMAIL_REPLIED",
                "timestamp": "2026-08-20T07:30:00Z",
                "content_summary": "Buyer requested quotation for 50,000 units of custom 32oz flasks.",
                "related_contact": "Klaus Weber"
            }
        ],
        "update_stage": "QUOTATION_SENT",
        "update_notes": "Synchronized from RenWork Intent 360 AI Agent."
    }
    response = client.post("/api/v1/crm/sync", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert data["activities_synced"] == 1
    assert data["stage_updated"] is True
    assert data["credits_deducted"] == 1


def test_account_registry_stats_and_prospects():
    """测试 9: 查询企业客户主索引 (Account Registry) 统计与潜客列表"""
    stats_resp = client.get("/api/v1/crm/registry/stats?workspace_id=WS-TEST-001")
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert "prospect_pool_count" in stats
    assert "existing_customer_count" in stats
    assert "handoff_queue_count" in stats

    prospects_resp = client.get("/api/v1/crm/registry/prospects?workspace_id=WS-DEFAULT-001")
    assert prospects_resp.status_code == 200
    prospects_data = prospects_resp.json()
    assert prospects_data["total_count"] > 0


def test_credit_ledger_history():
    """测试 10: 查询企业信用点详细扣减流水与账本记录"""
    resp = client.get("/api/v1/credits/ledger?workspace_id=WS-TEST-001&limit=20")
    assert resp.status_code == 200
    ledger = resp.json()
    assert "transactions" in ledger
    assert len(ledger["transactions"]) > 0
    # 验证交易流水的字段完整性
    first_tx = ledger["transactions"][0]
    assert "transaction_id" in first_tx
    assert "action_type" in first_tx
    assert "credits_deducted" in first_tx
    assert "balance_after" in first_tx
