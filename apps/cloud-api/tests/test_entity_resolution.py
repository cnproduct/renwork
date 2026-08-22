import pytest
from app.services.entity_resolution import EntityResolutionService

def test_entity_resolution_pure_forwarder():
    svc = EntityResolutionService()
    entity, elapsed = svc.resolve("EXPEDITORS INTERNATIONAL OF WASHINGTON INC", "SEATTLE, WA")
    assert entity.is_freight_forwarder is True
    assert "expeditors" in (entity.forwarder_reason or "").lower()
    assert entity.identity_confidence_score <= 0.20

def test_entity_resolution_custody_peeling():
    svc = EntityResolutionService()
    # 托管机构剥离：真实买家 C/O 货代
    entity, elapsed = svc.resolve(
        "HYDRATECH GLOBAL SOLUTIONS LLC C/O KUEHNE & NAGEL INC",
        "123 INNOVATION WAY, IRVINE, CA, US"
    )
    assert entity.is_freight_forwarder is False
    assert "Hydratech" in entity.canonical_name
    assert entity.official_domain == "hydratechglobalsolutions.com"
    assert entity.identity_confidence_score >= 0.85
    assert elapsed < 50.0  # 毫秒级消歧

def test_entity_resolution_clean_buyer():
    svc = EntityResolutionService()
    entity, elapsed = svc.resolve("PACIFIC OUTDOOR BRANDS CORP", "456 SEATTLE COMMERCE PKWY, WA")
    assert entity.is_freight_forwarder is False
    assert entity.canonical_name == "Pacific Outdoor Brands"
    assert entity.official_domain == "pacificoutdoorbrands.com"
    assert entity.identity_confidence_score >= 0.85
