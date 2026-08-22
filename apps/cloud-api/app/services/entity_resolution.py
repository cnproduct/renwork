import re
import json
import os
import time
from typing import Tuple
from app.models.schemas import NormalizedEntityData, EvidenceType

class EntityResolutionService:
    """
    RenWork 实体消歧核心微服务 (Entity Resolution Service)
    依据 PRD V1.0：
    1. 维护 120,000+ 货代与物流服务商特征库。
    2. 剥离 C/O / IN CARE OF 托管机构，穿透真实买家。
    3. 判定企业形态 Buyer Type (Brand Owner / Wholesaler / Retailer / Forwarder)。
    4. 计算置信度与证据标签 (Evidence Taxonomy)。
    """

    def __init__(self):
        self.blacklist_keywords = []
        self.custody_patterns = []
        self.known_trusted_retailers = []
        self._load_knowledge_base()

    def _load_knowledge_base(self):
        cur_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(cur_dir, "..", "data", "forwarders_blacklist.json")
        try:
            if os.path.exists(data_path):
                with open(data_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self.blacklist_keywords = data.get("blacklist_keywords", [])
                    self.custody_patterns = data.get("custody_patterns", [])
                    self.known_trusted_retailers = data.get("known_trusted_retailers", [])
        except Exception as e:
            print(f"[EntityResolutionService] Warning: Failed to load forwarders blacklist: {e}")
            self.blacklist_keywords = ["LOGISTICS", "FREIGHT", "FORWARDING", "EXPEDITORS", "NVOCC"]

    def resolve(self, raw_consignee: str, address: str = None, notify_party: str = None) -> Tuple[NormalizedEntityData, float]:
        start_time = time.perf_counter()
        raw_upper = (raw_consignee or "").upper().strip()

        # 1. 检查是否为托管/C/O 结构
        actual_buyer_name = raw_upper
        is_custody = False
        for pattern in self.custody_patterns:
            match = re.search(pattern, raw_upper, re.IGNORECASE)
            if match:
                is_custody = True
                parts = re.split(pattern, raw_upper, maxsplit=1, flags=re.IGNORECASE)
                if len(parts) > 0 and len(parts[0].strip()) > 3:
                    actual_buyer_name = parts[0].strip()
                elif notify_party and len(notify_party.strip()) > 3:
                    actual_buyer_name = notify_party.upper().strip()
                break

        # 2. 货代物流黑名单库判定
        is_forwarder = False
        forwarder_reason = None

        for kw in self.blacklist_keywords:
            if kw in actual_buyer_name:
                is_forwarder = True
                forwarder_reason = f"Matched logistics forwarder keyword: '{kw}'"
                break

        # 3. 规范化清洗企业名称
        cleaned = actual_buyer_name
        cleaned = re.sub(r"[,./\-\(\)]", " ", cleaned)
        cleaned = re.sub(r"\b(LLC|INC|LTD|CORP|CO|GMBH|BV|PTY|SA|SP Z O O|LIMITED|CORPORATION|COMPANY)\b", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()

        canonical_name = " ".join([word.capitalize() for word in cleaned.split()]) if cleaned else raw_consignee

        # 4. 推导 Buyer Type
        if is_forwarder:
            buyer_type = "Freight Forwarder / NVOCC"
        elif any(r in canonical_name.upper() for r in self.known_trusted_retailers):
            buyer_type = "Tier-1 Retailer / Category Giant"
        elif "WHOLESALE" in raw_upper or "DISTRIBUTOR" in raw_upper or "SUPPLY" in raw_upper:
            buyer_type = "Wholesaler / Regional Importer"
        else:
            buyer_type = "Brand Owner & Specialty Importer"

        # 5. 域名与 LinkedIn 主页推导
        clean_slug = re.sub(r"[^a-zA-Z0-9]", "", cleaned.lower())
        if not clean_slug:
            clean_slug = "enterprise"
        official_domain = f"{clean_slug}.com"
        linkedin_url = f"https://www.linkedin.com/company/{clean_slug}"

        # 6. 置信度计算
        if is_forwarder:
            confidence = 0.15
        else:
            base_score = 0.85
            if address and len(address) > 10:
                base_score += 0.08
            if is_custody:
                base_score -= 0.05
            confidence = round(min(0.99, max(0.20, base_score)), 2)

        entity_data = NormalizedEntityData(
            canonical_name=canonical_name,
            official_domain=official_domain if not is_forwarder else None,
            linkedin_company_url=linkedin_url if not is_forwarder else None,
            country="United States" if "US" in (address or "") or "CA" in (address or "") else "Global",
            state="California" if "CA" in (address or "") else None,
            buyer_type=buyer_type,
            is_freight_forwarder=is_forwarder,
            forwarder_reason=forwarder_reason,
            identity_confidence_score=confidence,
            evidence_tag=EvidenceType.FACT
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return entity_data, elapsed_ms

# 全局单例
entity_service = EntityResolutionService()
