from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

# =============================================================
# 1. PRD V1.0 核心枚举与证据分级 (Evidence Taxonomy)
# =============================================================

class EvidenceType(str, Enum):
    FACT = "Fact"                       # 原始交易、官网、工商或用户确认的可验证事实
    INFERENCE = "Inference"             # 基于多维度证据推断的 Buyer Type、异动信号或可能原因
    RECOMMENDATION = "Recommendation"   # 系统智能建议的商业切入角度、联系人或下一步动作

class BuyerGrade(str, Enum):
    A_PLUS_PLUS = "A++ (90-100 极速攻坚)"
    A_PLUS = "A+ (80-89 高价值优先)"
    A = "A (70-79 重点跟进)"
    B = "B (50-69 规律培育)"
    C = "C (<50 观察与归档)"

class CreditActionType(str, Enum):
    ENTITY_RESOLUTION = "Buyer Entity Resolution"          # 企业身份解析与去重 (1 credit)
    ACCOUNT_INTELLIGENCE = "Account Intelligence"          # 交易、供应商、评分与Why now形成 (2 credits)
    CONTACT_ENRICHMENT = "Contact Enrichment"              # 验证采购决策人及联系方式 (3 credits)
    SIGNAL_REFRESH = "Signal Refresh"                      # 账户交易或公开信号刷新 (1 credit)
    ACCOUNT_MONITORING = "Active Account Monitoring"        # 重点账户持续动态监控 (5 credits/month)
    OUTREACH_PACKAGE = "Outreach Package"                  # 多联系人多渠道序列与多模态物料包生成 (4 credits)
    CRM_DEDUPLICATION = "CRM Duplicate Check"              # 多因子存量快照查重 (1 credit)
    QUALIFIED_HANDOFF = "Qualified Lead Handoff"           # 合格线索门禁封包与交接 (3 credits)
    CUSTOMER_SYNC = "CRM Customer Sync"                    # 存量客户 API 增量状态回写 (1 credit)
    SNAPSHOT_IMPORT = "CRM Snapshot Import"                # 存量快照导入与本地索引 (0 credits)

# =============================================================
# 2. 实体消歧与身份解析 (POST /api/v1/entities/resolve)
# =============================================================

class EntityResolveRequest(BaseModel):
    raw_consignee_text: str = Field(..., description="海关提单原始收货人文本", json_schema_extra={"example": "HYDRATECH GLOBAL SOLUTIONS LLC C/O EXPEDITORS INTL"})
    address_text: Optional[str] = Field(None, description="收货人地址文本", json_schema_extra={"example": "123 INNOVATION WAY, IRVINE, CA 92618"})
    notify_party_text: Optional[str] = Field(None, description="提单通知人原始文本")
    workspace_id: str = "WS-DEFAULT-001"

class NormalizedEntityData(BaseModel):
    canonical_name: str
    official_domain: Optional[str]
    linkedin_company_url: Optional[str]
    country: str
    state: Optional[str]
    buyer_type: str = Field(..., description="Brand Owner / Wholesaler / Retailer / Forwarder / Unknown")
    is_freight_forwarder: bool
    forwarder_reason: Optional[str] = None
    identity_confidence_score: float
    evidence_tag: EvidenceType = EvidenceType.FACT

class EntityResolveResponse(BaseModel):
    status: str
    input_text: str
    entity: NormalizedEntityData
    credits_deducted: int
    processing_time_ms: float

# =============================================================
# 3. 意向评估与 Double Signal 三层加权评分 (POST /api/v1/intent/evaluate-opportunity)
# =============================================================

class BuyerProfileInput(BaseModel):
    buyer_account_id: str
    company_name: str
    destination_country: str = "US"
    recent_shipment_count_90d: int = 6
    total_teu_90d: float = 12.0
    mom_growth_pct: float = 25.0
    primary_supplier_share_pct: float = 75.0
    primary_supplier_trend: str = "DECLINING"
    target_hs_codes: List[str] = ["3924.10", "3924.90"]
    # PRD Double Signal: 公开数字信号
    has_recent_product_launch: bool = True
    public_signal_description: Optional[str] = "LinkedIn company page announced new eco-friendly product expansion 14 days ago."
    has_verified_contact: bool = True

class ExporterGraphInput(BaseModel):
    exporter_id: str
    company_name: str
    product_categories: List[str] = ["Sustainable Drinkware", "Baby Tableware Set"]
    certifications: List[str] = ["FDA", "LFGB", "GRS", "ISO9001", "CPC"]
    monthly_capacity_units: int = 500000
    moq: int = 1000
    tooling_lead_time_days: int = 7

class ScoreFactorBreakdown(BaseModel):
    name: str
    weight: float
    score: float
    contribution: float
    evidence_type: EvidenceType
    explanation: str

class ExplainabilityNode(BaseModel):
    category: str
    score: float
    weight: float
    factors: List[ScoreFactorBreakdown]

class OpportunityEvaluationResponse(BaseModel):
    buyer_account_id: str
    exporter_id: str
    purchase_evidence_score: float = Field(..., description="海关真实采购证据分 (0-100) [Fact]")
    exporter_fit_score: float = Field(..., description="出口商能力与品类匹配分 (0-100) [Fact]")
    supplier_opportunity_score: float = Field(..., description="供应商格局与异动切入分 (0-100) [Inference]")
    digital_public_signal_score: float = Field(..., description="公开数字与Double Signal共振分 (0-100) [Inference]")
    opportunity_priority_score_ops: float = Field(..., description="加权综合 OPS 分数 (0-100)")
    buyer_grade: BuyerGrade
    double_signal_verified: bool = Field(..., description="海关交易信号 + 官网/LinkedIn公开业务信号双重共振验证")
    recommended_angle: str = Field(..., description="12 种商业切入角度之最优推荐 [Recommendation]")
    why_now_rationale: str = Field(..., description="Why Now 决策切入阐释 [Recommendation]")
    explainability_tree: List[ExplainabilityNode]
    credits_deducted: int = 2

# =============================================================
# 4. ChatCut 多模态 4 轨物料包与 3-Touch 序列 (POST /api/v1/outreach/generate-sequence)
# =============================================================

class OutreachContactInput(BaseModel):
    full_name: str = "Sarah Jenkins"
    title: str = "Director of Global Sourcing"
    email: str = "sarah.jenkins@hydratech-solutions.com"
    linkedin_url: Optional[str] = "https://www.linkedin.com/in/sarah-jenkins-sourcing"
    buying_role_tag: str = "Economic Buyer & Sourcing Lead"

class OutreachSequenceRequest(BaseModel):
    buyer_account_id: str
    buyer_company_name: str
    target_contact: OutreachContactInput
    specified_angle: Optional[str] = None
    include_chatcut_video_pitch: bool = True
    workspace_id: str = "WS-DEFAULT-001"

class TouchpointStep(BaseModel):
    step_number: int
    channel: str  # EMAIL / LINKEDIN
    timing_day_offset: int
    subject_or_type: str
    content_text: str
    call_to_action: str
    evidence_tag: EvidenceType
    anti_surveillance_verified: bool = True

class MultimodalAssetBundle(BaseModel):
    track_1_strategy_copy: str
    track_2_compliance_cert_bundle: str  # PDF / Watermarked test report
    track_3_chatcut_video_pitch_url: Optional[str] = None
    track_3_video_duration_seconds: Optional[int] = 18
    track_4_tiered_quote_sheet_asset: str

class OutreachSequenceResponse(BaseModel):
    buyer_account_id: str
    chosen_angle: str
    angle_display_name: str
    contact_name: str
    contact_email: str
    sequence: List[TouchpointStep]
    multimodal_assets: MultimodalAssetBundle
    anti_surveillance_audit_passed: bool
    requires_human_approval: bool = True

# =============================================================
# 5. 人工确认与操作审计 (POST /api/v1/actions/approve & GET /api/v1/audit/logs)
# =============================================================

class ActionApprovalRequest(BaseModel):
    action_id: str
    approved_by_user_id: str
    approval_decision: str  # "APPROVED" / "REJECTED" / "MODIFIED"
    final_content_text: Optional[str] = None
    reason: Optional[str] = None

class ActionApprovalResponse(BaseModel):
    action_id: str
    status: str
    dispatched_timestamp: str
    audit_hash: str
    message: str

class AuditLogItem(BaseModel):
    log_id: str
    timestamp: str
    user_id: str
    action_type: str
    target_account_id: str
    content_summary: str
    approval_status: str
    model_version: str

# =============================================================
# 6. 信用点计量账本 (Credits Ledger)
# =============================================================

class CreditBalanceResponse(BaseModel):
    workspace_id: str
    total_quota: int
    used_credits: int
    remaining_credits: int
    active_monitoring_accounts_count: int
    tier_name: str = "Enterprise Intelligence Tier"

# =============================================================
# 7. CRM 反馈与自进化微调 (POST /api/v1/signals/feedback-event)
# =============================================================

class CRMFeedbackEventRequest(BaseModel):
    exporter_id: str
    buyer_account_id: str
    product_category: str
    target_market: str
    angle_used: str
    event_type: str  # "POSITIVE_REPLY", "SAMPLE_REQUESTED", "MEETING_BOOKED", "DEAL_WON", "LOST_PRICE_HIGH", "LOST_NO_DEMAND"
    feedback_notes: Optional[str] = None

class CRMFeedbackEventResponse(BaseModel):
    status: str
    event_id: str
    adjusted_weights: Dict[str, float]
    message: str

# =============================================================
# 8. 每日高意向买家队列 (GET /api/v1/orchestrator/daily-queue)
# =============================================================

class DailyQueueItem(BaseModel):
    rank: int
    buyer_account_id: str
    buyer_company_name: str
    country: str
    ops_score: float
    grade: BuyerGrade
    hhi_index: float
    primary_signal: str
    double_signal_status: str
    recommended_angle: str
    why_now: str
    primary_contact_name: str
    primary_contact_email: str
    action_card_title: str
    action_ready_asset: str

class DailyQueueResponse(BaseModel):
    generated_date: str
    total_in_queue: int
    high_priority_count: int
    items: List[DailyQueueItem]


class CreditTransactionItem(BaseModel):
    transaction_id: str
    timestamp: str
    workspace_id: str
    action_type: str
    credits_deducted: int
    balance_after: int
    description: str
    target_entity: Optional[str] = None

class CreditLedgerHistoryResponse(BaseModel):
    workspace_id: str
    total_quota: int
    used_credits: int
    remaining_credits: int
    transactions_count: int
    transactions: List[CreditTransactionItem]
