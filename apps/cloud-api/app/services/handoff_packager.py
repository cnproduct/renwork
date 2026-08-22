"""
RenWork × OKKI V2.0 - 合格线索交接封包服务 (Qualified Handoff Packager & Gate Service)
Skill 03: OKKI Qualified Handoff Packager Skill
"""
import time
import datetime
from typing import Dict, Any, Tuple, Optional, List

from app.models.okki_schemas import (
    HandoffRequest, HandoffResponse, HandoffTier, HandoffDecision
)


class QualifiedHandoffService:
    """
    RenWork 合格线索门禁与 OKKI 交付封包服务
    负责对达到 Tier 4/5 或业务员确认的潜客进行标准化打包，生成 OKKI 导入模板与 Next Best Action。
    """

    GATE_RULES: Dict[HandoffTier, Tuple[HandoffDecision, str]] = {
        HandoffTier.TIER_0_RAW: (
            HandoffDecision.BLOCKED,
            "❌ 门禁阻断：仅有一条原始海关记录，缺少官网、域名与有效联系方式，严禁导入 OKKI 污染 CRM 数据库。"
        ),
        HandoffTier.TIER_1_ENRICHED: (
            HandoffDecision.BLOCKED,
            "❌ 暂不移交：已确认真实买家画像，但尚未定位关键采购决策人与邮箱，留在 RenWork 继续穿透采购委员会。"
        ),
        HandoffTier.TIER_2_CONTACT: (
            HandoffDecision.OPTIONAL,
            "⚠️ 可选准入：已找到采购负责人及验证邮箱，需业务员在界面手动勾选认领后方可移交。"
        ),
        HandoffTier.TIER_3_ENGAGED: (
            HandoffDecision.RECOMMENDED,
            "⚠️ 建议移交：已建立 LinkedIn 连接或开发信送达且打开，进入待移交队列，提醒业务员审核。"
        ),
        HandoffTier.TIER_4_REPLIED: (
            HandoffDecision.REQUIRED,
            "✅ 必须移交：买家已主动回复邮件或社媒消息，达到 MQL/SQL 移交标准，立即生成完整交付档案并分配业务员。"
        ),
        HandoffTier.TIER_5_DEAL: (
            HandoffDecision.MANDATORY,
            "🚨 强制移交：买家明确索取 Catalog、样品或要求正式报价，最高优先级移交，OKKI 自动建立关联 Deal (商机)。"
        ),
    }

    def __init__(self):
        self.handoff_records: Dict[str, Dict] = {}

    def package_handoff(self, request: HandoffRequest) -> HandoffResponse:
        start_time = time.perf_counter()
        now = datetime.datetime.now(datetime.timezone.utc)
        tier = request.qualification_tier

        decision, explanation = self.GATE_RULES.get(
            tier,
            (HandoffDecision.OPTIONAL, "未明确分级，按可选模式处理。")
        )

        handoff_id = f"HND-{now.strftime('%Y%m%d%H%M%S')}-{abs(hash(request.company_profile.normalized_name)) % 10000}"

        # 组装 OKKI 标准导入模板数据结构
        okki_import_template = {
            "company_info": {
                "name": request.company_profile.legal_name or request.company_profile.normalized_name,
                "english_name": request.company_profile.normalized_name,
                "country": request.company_profile.country_code,
                "city": request.company_profile.city,
                "address": request.company_profile.address,
                "website": request.company_profile.website,
                "domain": request.company_profile.root_domain,
                "industry": request.company_profile.industry_category or "Foreign Trade / B2B Manufacturing",
                "source": "RenWork AI Pre-CRM (Customs + LinkedIn Outreach)",
                "lead_grade": "A++" if tier == HandoffTier.TIER_5_DEAL else ("A+" if tier == HandoffTier.TIER_4_REPLIED else "A"),
            },
            "contact_info": {
                "name": request.primary_contact.full_name,
                "title": request.primary_contact.title or "Procurement / Sourcing Lead",
                "email": request.primary_contact.email,
                "email_status": request.primary_contact.email_verification or "Verified Deliverable",
                "linkedin": request.primary_contact.linkedin_url,
                "phone": request.primary_contact.phone,
                "is_primary": True,
            },
            "customs_evidence": {
                "hs_code": request.customs_evidence.hs_code if request.customs_evidence else None,
                "annual_volume_tons": request.customs_evidence.annual_volume if request.customs_evidence else None,
                "last_shipment": request.customs_evidence.last_shipment_date if request.customs_evidence else None,
                "origin_countries": request.customs_evidence.origin_countries if request.customs_evidence else [],
            },
            "outreach_summary": {
                "campaign": request.outreach_history.campaign_name if request.outreach_history else None,
                "angle": request.outreach_history.selected_angle if request.outreach_history else None,
                "reply_snippet": request.outreach_history.reply_snippet if request.outreach_history else None,
                "reply_date": request.outreach_history.reply_timestamp if request.outreach_history else None,
            },
            "system_metadata": {
                "renwork_handoff_id": handoff_id,
                "packaged_at": now.isoformat(),
                "qualification_tier": tier.value,
                "assigned_sales_rep": request.sales_rep_id or "SALES-REP-DEFAULT",
            }
        }

        # 生成证据摘要
        evidence_parts = []
        if request.customs_evidence and request.customs_evidence.hs_code:
            evidence_parts.append(f"海关 HS: {request.customs_evidence.hs_code}")
        if request.customs_evidence and request.customs_evidence.annual_volume:
            evidence_parts.append(f"年采购量: {request.customs_evidence.annual_volume} 吨")
        if request.outreach_history and request.outreach_history.reply_snippet:
            snippet = request.outreach_history.reply_snippet[:60]
            evidence_parts.append(f"回复内容: '{snippet}...'")
        evidence_summary = " | ".join(evidence_parts) if evidence_parts else "已完成采购决策人匹配与验证。"

        # Next Best Action 建议
        if tier == HandoffTier.TIER_5_DEAL:
            nba = request.recommended_next_action or "买家已表达明确采购意向，立即在 2 小时内由资深业务员发送标准产品报价单 (Quotation Sheet) 并预约打样沟通视频会议。"
        elif tier == HandoffTier.TIER_4_REPLIED:
            nba = request.recommended_next_action or "买家已产生积极回复，业务员在 4 小时内回复邮件，发送 1 页纸产品规格书并询问具体采购规格需求。"
        else:
            nba = request.recommended_next_action or "跟进 LinkedIn 互动，持续监控最新海关提单与企业动态。"

        # 记录到交接历史
        self.handoff_records[handoff_id] = {
            "handoff_id": handoff_id,
            "company_name": request.company_profile.normalized_name,
            "tier": tier.value,
            "decision": decision.value,
            "template": okki_import_template,
            "created_at": now.isoformat(),
        }

        return HandoffResponse(
            status="SUCCESS",
            handoff_id=handoff_id,
            qualification_tier=tier,
            handoff_decision=decision,
            company_name=request.company_profile.normalized_name,
            okki_import_template=okki_import_template,
            evidence_summary=evidence_summary,
            assigned_to=request.sales_rep_id or "SALES-REP-DEFAULT",
            next_best_action=nba,
            credits_deducted=3  # Handoff 封包消耗 3 Credits
        )

    def get_handoff_record(self, handoff_id: str) -> Optional[Dict]:
        return self.handoff_records.get(handoff_id)

    def list_handoffs(self) -> List[Dict]:
        return list(self.handoff_records.values())


# 全局单例
handoff_service = QualifiedHandoffService()
