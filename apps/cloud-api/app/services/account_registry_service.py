"""
RenWork × OKKI V2.0 - 企业客户主索引管理服务 (Enterprise Account Registry Service)
管理 Prospect Pool (公网潜客池), Existing Customer Registry (存量快照库) 与 Qualified Handoff Queue (合格交接队列)
"""
import datetime
from typing import Dict, List, Optional

from app.models.okki_schemas import (
    ProspectPoolEntry, AccountRegistryStats, MatchStatus, HandoffTier, SnapshotFreshness
)
from app.services.snapshot_import import snapshot_service, normalize_company_name, normalize_domain
from app.services.handoff_packager import handoff_service


class AccountRegistryService:
    """
    RenWork 企业客户主索引服务 (Enterprise Account Master Registry)
    负责统一维护三大数据分区：
    1. Prospect Pool: 公网新发现潜客
    2. Existing Customer Registry: OKKI 存量客户索引
    3. Qualified Handoff Queue: 达标待移交 OKKI 的客户
    """

    def __init__(self):
        # 潜客池 {workspace_id: {prospect_id: ProspectPoolEntry}}
        self.prospect_pools: Dict[str, Dict[str, ProspectPoolEntry]] = {}
        self._seed_default_prospects()

    def _seed_default_prospects(self):
        ws = "WS-DEFAULT-001"
        self.prospect_pools[ws] = {}

        seed_data = [
            ProspectPoolEntry(
                prospect_id="PRP-001",
                company_name="HYDRATECH GLOBAL SOLUTIONS LLC",
                normalized_name="hydratech global solutions",
                domain="hydratech-solutions.com",
                country="US",
                source="CUSTOMS",
                discovery_date="2026-08-15",
                enrichment_status="ENRICHED",
                match_status=MatchStatus.S7_VERIFIED_NEW,
                handoff_tier=HandoffTier.TIER_4_REPLIED,
                ops_score=88.5
            ),
            ProspectPoolEntry(
                prospect_id="PRP-002",
                company_name="NORDIC ECO DRINKWARE AB",
                normalized_name="nordic eco drinkware",
                domain="nordic-ecodrinkware.se",
                country="SE",
                source="LINKEDIN",
                discovery_date="2026-08-16",
                enrichment_status="ENRICHED",
                match_status=MatchStatus.S7_VERIFIED_NEW,
                handoff_tier=HandoffTier.TIER_5_DEAL,
                ops_score=93.0
            ),
            ProspectPoolEntry(
                prospect_id="PRP-003",
                company_name="PACIFIC PEAK OUTDOORS INC",
                normalized_name="pacific peak outdoors",
                domain="pacificpeakoutdoors.com",
                country="US",
                source="CUSTOMS",
                discovery_date="2026-08-18",
                enrichment_status="IN_PROGRESS",
                match_status=MatchStatus.S6_NO_MATCH,
                handoff_tier=HandoffTier.TIER_2_CONTACT,
                ops_score=76.0
            ),
            ProspectPoolEntry(
                prospect_id="PRP-004",
                company_name="ALPEN BERGSTEIGER GMBH",
                normalized_name="alpen bergsteiger",
                domain="alpen-bergsteiger.de",
                country="DE",
                source="EXHIBITION",
                discovery_date="2026-08-19",
                enrichment_status="ENRICHED",
                match_status=MatchStatus.S1_EXACT_MATCH,
                handoff_tier=HandoffTier.TIER_3_ENGAGED,
                ops_score=82.0
            ),
        ]

        for item in seed_data:
            self.prospect_pools[ws][item.prospect_id] = item

    def add_prospect(self, workspace_id: str, entry: ProspectPoolEntry) -> str:
        if workspace_id not in self.prospect_pools:
            self.prospect_pools[workspace_id] = {}
        self.prospect_pools[workspace_id][entry.prospect_id] = entry
        return entry.prospect_id

    def list_prospects(self, workspace_id: str, tier: Optional[HandoffTier] = None, match_status: Optional[MatchStatus] = None) -> List[ProspectPoolEntry]:
        pool = self.prospect_pools.get(workspace_id, {})
        results = list(pool.values())
        if tier:
            results = [p for p in results if p.handoff_tier == tier]
        if match_status:
            results = [p for p in results if p.match_status == match_status]
        return results

    def get_stats(self, workspace_id: str) -> AccountRegistryStats:
        prospects = self.prospect_pools.get(workspace_id, {})
        existing_records = snapshot_service.get_raw_records(workspace_id)
        handoffs = handoff_service.list_handoffs()
        freshness, snapshot_date = snapshot_service.get_snapshot_freshness(workspace_id)

        # 统计待移交队列 (Tier 4 & Tier 5)
        handoff_queue_count = sum(1 for p in prospects.values() if p.handoff_tier in [HandoffTier.TIER_4_REPLIED, HandoffTier.TIER_5_DEAL])

        return AccountRegistryStats(
            workspace_id=workspace_id,
            prospect_pool_count=len(prospects),
            existing_customer_count=len(existing_records),
            handoff_queue_count=handoff_queue_count,
            snapshot_freshness=freshness,
            snapshot_date=snapshot_date,
            last_dedup_run=datetime.datetime.now(datetime.timezone.utc).isoformat()
        )


# 全局单例
account_registry_service = AccountRegistryService()
