"""
RenWork × OKKI 架构重构 V2.0 - OKKI 集成数据模型
OKKI Integration Data Models for Snapshot Import, CRM Deduplication,
Qualified Handoff & Existing Customer Sync.
"""
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime
from pydantic import BaseModel, Field


# =============================================================
# 1. 枚举与常量 (Enums & Constants)
# =============================================================

class MatchStatus(str, Enum):
    """8 级匹配状态码 (8-Level Match Status Code)"""
    S1_EXACT_MATCH = "S1_EXACT_MATCH"
    S2_LIKELY_MATCH = "S2_LIKELY_MATCH"
    S3_EXISTING_CUSTOMER = "S3_EXISTING_CUSTOMER"
    S4_DORMANT_CUSTOMER = "S4_DORMANT_CUSTOMER"
    S5_MANUAL_CHECK = "S5_MANUAL_CHECK_REQUIRED"
    S6_NO_MATCH = "S6_NO_MATCH_IN_SNAPSHOT"
    S7_VERIFIED_NEW = "S7_VERIFIED_NEW_PROSPECT"
    S8_EXCLUDED = "S8_EXCLUDED"

class HandoffTier(str, Enum):
    """移交门禁分级 (Handoff Gate Tier)"""
    TIER_0_RAW = "Tier-0-RawLead"
    TIER_1_ENRICHED = "Tier-1-EnrichedEntity"
    TIER_2_CONTACT = "Tier-2-KeyContactFound"
    TIER_3_ENGAGED = "Tier-3-OutreachEngaged"
    TIER_4_REPLIED = "Tier-4-ActiveReplied"
    TIER_5_DEAL = "Tier-5-DealIntent"

class SnapshotFreshness(str, Enum):
    """快照新鲜度状态 (Snapshot Freshness Status)"""
    FRESH = "FRESH"
    EXPIRING_SOON = "EXPIRING_SOON"
    EXPIRED = "EXPIRED"

class HandoffDecision(str, Enum):
    """门禁判定结果"""
    BLOCKED = "BLOCKED"
    OPTIONAL = "OPTIONAL"
    RECOMMENDED = "RECOMMENDED"
    REQUIRED = "REQUIRED"
    MANDATORY = "MANDATORY"

class SyncDirection(str, Enum):
    """同步方向"""
    RENWORK_TO_OKKI = "RENWORK_TO_OKKI"
    OKKI_TO_RENWORK = "OKKI_TO_RENWORK"
    BIDIRECTIONAL = "BIDIRECTIONAL"


# =============================================================
# 2. OKKI 快照导入模型 (Snapshot Import Models)
# =============================================================

class OkkiCustomerRecord(BaseModel):
    """从 OKKI 导出的单条客户记录"""
    okki_customer_id: Optional[str] = None
    company_name: str
    company_name_en: Optional[str] = None
    country: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    domain: Optional[str] = None
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    owner_name: Optional[str] = None
    customer_stage: Optional[str] = None
    last_followup_date: Optional[str] = None
    quote_status: Optional[str] = None
    deal_status: Optional[str] = None
    invalid_reason: Optional[str] = None

class SnapshotMetadata(BaseModel):
    """快照元数据与新鲜度"""
    snapshot_id: str
    file_name: str
    imported_at: str
    record_count: int
    valid_until: str
    freshness: SnapshotFreshness
    file_hash: str

class SnapshotImportRequest(BaseModel):
    """快照导入请求"""
    workspace_id: str = "WS-DEFAULT-001"
    records: List[OkkiCustomerRecord]
    source_crm: str = "OKKI"

class SnapshotImportResponse(BaseModel):
    """快照导入结果"""
    status: str
    snapshot_metadata: SnapshotMetadata
    records_imported: int
    records_merged: int
    records_skipped: int
    index_build_time_ms: float
    credits_deducted: int


# =============================================================
# 3. CRM 查重模型 (CRM Deduplication Models)
# =============================================================

class DeduplicationRequest(BaseModel):
    """查重请求：传入新发现的海关买家"""
    workspace_id: str = "WS-DEFAULT-001"
    prospect_name: str = Field(..., description="海关提单买家名称")
    prospect_domain: Optional[str] = Field(None, description="买家官网域名")
    prospect_country: Optional[str] = Field(None, description="买家国家")
    prospect_city: Optional[str] = Field(None, description="买家城市")
    prospect_email: Optional[str] = Field(None, description="联系人邮箱")
    prospect_phone: Optional[str] = Field(None, description="联系人电话")
    prospect_contact_name: Optional[str] = Field(None, description="联系人姓名")

class MatchFactorDetail(BaseModel):
    """单项匹配因子明细"""
    factor_name: str
    weight: float
    similarity: float
    weighted_score: float
    evidence: str

class MatchCandidate(BaseModel):
    """查重匹配候选结果"""
    okki_customer_id: Optional[str]
    company_name: str
    domain: Optional[str]
    country: Optional[str]
    owner_name: Optional[str]
    customer_stage: Optional[str]
    last_followup_date: Optional[str]
    dormant_days: Optional[int]
    confidence_score: float
    match_status: MatchStatus
    factor_breakdown: List[MatchFactorDetail]

class DeduplicationResponse(BaseModel):
    """查重结果"""
    status: str
    prospect_name: str
    normalized_prospect_name: str
    normalized_prospect_domain: Optional[str]
    snapshot_freshness: SnapshotFreshness
    snapshot_date: str
    best_match: Optional[MatchCandidate]
    all_candidates: List[MatchCandidate]
    final_verdict: MatchStatus
    action_recommendation: str
    credits_deducted: int
    processing_time_ms: float


# =============================================================
# 4. 合格线索交接模型 (Qualified Handoff Models)
# =============================================================

class HandoffCompanyProfile(BaseModel):
    """交接公司画像"""
    normalized_name: str
    legal_name: Optional[str] = None
    root_domain: Optional[str] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    industry_category: Optional[str] = None

class HandoffContact(BaseModel):
    """交接联系人"""
    full_name: str
    title: Optional[str] = None
    email: str
    email_verification: Optional[str] = None
    linkedin_url: Optional[str] = None
    phone: Optional[str] = None

class HandoffCustomsEvidence(BaseModel):
    """海关证据摘要"""
    hs_code: Optional[str] = None
    annual_volume: Optional[float] = None
    last_shipment_date: Optional[str] = None
    origin_countries: List[str] = []
    shipment_count_90d: Optional[int] = None

class HandoffOutreachHistory(BaseModel):
    """触达历史摘要"""
    campaign_name: Optional[str] = None
    selected_angle: Optional[str] = None
    first_touch_date: Optional[str] = None
    reply_timestamp: Optional[str] = None
    reply_snippet: Optional[str] = None
    linkedin_connection_status: Optional[str] = None

class HandoffRequest(BaseModel):
    """合格线索移交请求"""
    workspace_id: str = "WS-DEFAULT-001"
    qualification_tier: HandoffTier
    company_profile: HandoffCompanyProfile
    primary_contact: HandoffContact
    customs_evidence: Optional[HandoffCustomsEvidence] = None
    outreach_history: Optional[HandoffOutreachHistory] = None
    recommended_next_action: Optional[str] = None
    sales_rep_id: Optional[str] = None

class HandoffResponse(BaseModel):
    """合格线索移交结果"""
    status: str
    handoff_id: str
    qualification_tier: HandoffTier
    handoff_decision: HandoffDecision
    company_name: str
    okki_import_template: Dict[str, Any]
    evidence_summary: str
    assigned_to: Optional[str]
    next_best_action: str
    credits_deducted: int


# =============================================================
# 5. 存量客户同步模型 (Existing Customer Sync Models)
# =============================================================

class ActivityLogEntry(BaseModel):
    """活动日志条目"""
    activity_type: str  # EMAIL_SENT, EMAIL_REPLIED, LINKEDIN_CONNECTED, etc.
    timestamp: str
    content_summary: str
    related_contact: Optional[str] = None
    metadata: Dict[str, Any] = {}

class CustomerSyncRequest(BaseModel):
    """存量客户同步请求"""
    workspace_id: str = "WS-DEFAULT-001"
    okki_customer_id: str
    sync_direction: SyncDirection = SyncDirection.RENWORK_TO_OKKI
    activities: List[ActivityLogEntry] = []
    update_stage: Optional[str] = None
    update_notes: Optional[str] = None

class CustomerSyncResponse(BaseModel):
    """存量客户同步结果"""
    status: str
    sync_id: str
    okki_customer_id: str
    activities_synced: int
    stage_updated: bool
    notes_appended: bool
    sync_direction: SyncDirection
    credits_deducted: int


# =============================================================
# 6. 企业客户主索引模型 (Account Registry Models)
# =============================================================

class ProspectPoolEntry(BaseModel):
    """潜客池条目"""
    prospect_id: str
    company_name: str
    normalized_name: str
    domain: Optional[str]
    country: Optional[str]
    source: str  # CUSTOMS, LINKEDIN, WEBSITE, GOOGLE, EXHIBITION, MANUAL
    discovery_date: str
    enrichment_status: str
    match_status: Optional[MatchStatus] = None
    handoff_tier: HandoffTier = HandoffTier.TIER_0_RAW
    ops_score: Optional[float] = None

class AccountRegistryStats(BaseModel):
    """企业客户主索引统计"""
    workspace_id: str
    prospect_pool_count: int
    existing_customer_count: int
    handoff_queue_count: int
    snapshot_freshness: SnapshotFreshness
    snapshot_date: Optional[str]
    last_dedup_run: Optional[str]
