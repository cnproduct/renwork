import re
from typing import List, Dict
from app.models.schemas import (
    OutreachSequenceRequest,
    OutreachSequenceResponse,
    TouchpointStep,
    MultimodalAssetBundle,
    EvidenceType
)

class AngleDecisionAndOutreachEngine:
    """
    RenWork 商业切入策略决策机与 ChatCut 多模态 4 轨物料生成引擎
    结合 PRD V1.0 与 ChatCut 多轨道时间轴设计：
    - 轨道 1：去监控感商业策略文案 (Strategy Copy)
    - 轨道 2：权威合规认证水印包 (Compliance Cert Bundle)
    - 轨道 3：ChatCut 专属个性化视频邀请卡 (18s Video Pitch Asset)
    - 轨道 4：即用型阶梯报价测算单 (Tiered Quote Sheet)
    """

    ANGLE_DEFINITIONS: Dict[str, Dict[str, str]] = {
        "second_source_resilience": {
            "name": "Second Source / Dual Sourcing 供应链弹性备份",
            "hook": "mitigating single-source bottlenecks with parallel high-precision capacity"
        },
        "backup_capacity_peak": {
            "name": "旺季保供弹性产线锁定",
            "hook": "securing dedicated production slots ahead of peak season delivery rushes"
        },
        "cost_optimization": {
            "name": "垂直一体化工艺成本优化 (8-15% 降本)",
            "hook": "lean direct manufacturing efficiencies to expand product unit margins"
        },
        "private_label_innovation": {
            "name": "私模创新与自主品牌差异化",
            "hook": "exclusive 3D tooling and customized mold design for brand distinctiveness"
        },
        "esg_sustainable_compliance": {
            "name": "GRS 环保再生材料与合规认证升级",
            "hook": "circular economy compliance using GRS-certified PCR Tritan and zero-BPA standards"
        },
        "lead_time_acceleration": {
            "name": "极速打样与 21 天大货交期提速",
            "hook": "7-day prototype validation and expedited 3-week production lead times"
        },
        "low_moq_trial_agility": {
            "name": "低 MOQ 敏捷试销与零库存压力",
            "hook": "flexible 500-unit initial trial runs to validate new SKU demand"
        },
        "quality_material_upgrade": {
            "name": "五轴精密公差与航天级耐冲击品质",
            "hook": "ultra-tight +/-0.01mm mold tolerances eliminating common leakage defects"
        },
        "exclusive_regional_odm": {
            "name": "区域独家款式代理合作",
            "hook": "territory exclusivity agreements safeguarding distributor pricing power"
        },
        "ddp_inventory_buffering": {
            "name": "DDP 完税门到门与本地安全仓缓冲",
            "hook": "hassle-free landed DDP fulfillment with local safety stock buffers"
        },
        "category_line_extension": {
            "name": "品类横向协同配套拓展",
            "hook": "expanding complementary accessory lines through a single qualified partner"
        },
        "supplier_disruption_switch": {
            "name": "原产地工厂异动平滑无缝切换",
            "hook": "seamless mold transfer and instant production onboarding without disruption"
        }
    }

    def generate_sequence(self, req: OutreachSequenceRequest) -> OutreachSequenceResponse:
        angle_key = req.specified_angle or "second_source_resilience"
        if angle_key not in self.ANGLE_DEFINITIONS:
            angle_key = "second_source_resilience"

        angle_info = self.ANGLE_DEFINITIONS[angle_key]
        contact_first_name = req.target_contact.full_name.split()[0] if req.target_contact.full_name else "there"
        company = req.buyer_company_name

        # -------------------------------------------------------------
        # Touch 1: Day 1 - Email 1 (价值锚点 - 去监控感) [Recommendation]
        # -------------------------------------------------------------
        t1_subject = f"Dual-sourcing resilience for {company}'s upcoming product runs"
        if angle_key == "backup_capacity_peak":
            t1_subject = f"Securing peak season manufacturing capacity for {company}"
        elif angle_key == "esg_sustainable_compliance":
            t1_subject = f"GRS-certified sustainable material specs for {company}"
        elif angle_key == "private_label_innovation":
            t1_subject = f"Private mold 3D tooling for {company}'s next product wave"

        t1_body = (
            f"Hi {contact_first_name},\n\n"
            f"Noticed how rapidly {company}'s product line is scaling across North America this season.\n\n"
            f"As category leaders scale, many sourcing teams we work with are establishing a reliable secondary manufacturing line "
            f"to protect fulfillment lead times and maintain cost leverage without single-source dependency.\n\n"
            f"Our facility specializes in high-precision Tritan and sustainable drinkware (500k monthly capacity, ISO9001/FDA/GRS certified) "
            f"with rapid 7-day tooling turnaround.\n\n"
            f"Would you be open to a quick 1-page QA benchmark sheet comparing our mold tolerances and material certifications?"
        )

        t1_step = TouchpointStep(
            step_number=1,
            channel="EMAIL",
            timing_day_offset=0,
            subject_or_type=t1_subject,
            content_text=t1_body,
            call_to_action="Request 1-page QA benchmark sheet",
            evidence_tag=EvidenceType.RECOMMENDATION,
            anti_surveillance_verified=True
        )

        # -------------------------------------------------------------
        # Touch 2: Day 4 - LinkedIn (专业互动与轻量触点) [Recommendation]
        # -------------------------------------------------------------
        t2_type = "LINKEDIN_CONNECT_AND_ENGAGE"
        t2_body = (
            f"Hi {contact_first_name}, really enjoyed your recent update regarding sustainable sourcing initiatives at {company}. "
            f"Sent a brief note to your email regarding dual-sourcing tooling benchmarks for Tritan lines—wishing you and the team continued momentum this quarter!"
        )

        t2_step = TouchpointStep(
            step_number=2,
            channel="LINKEDIN",
            timing_day_offset=4,
            subject_or_type=t2_type,
            content_text=t2_body,
            call_to_action="Connect on LinkedIn and establish industry rapport",
            evidence_tag=EvidenceType.RECOMMENDATION,
            anti_surveillance_verified=True
        )

        # -------------------------------------------------------------
        # Touch 3: Day 8 - Email 2 (ChatCut 专属个性化视频与样品邀约) [Recommendation]
        # -------------------------------------------------------------
        t3_subject = f"18s video walkthrough & complimentary sample kit for {company}"
        video_pitch_url = f"https://media.renwork.ai/pitch/v/{req.buyer_account_id}/3d-preview.mp4" if req.include_chatcut_video_pitch else None

        t3_body = (
            f"Hi {contact_first_name},\n\n"
            f"Following up on my previous note. Our engineering team recorded a personalized 18-second video walkthrough showcasing our 360-leakproof Tritan caps and high-impact sports flask molds tailored for {company}'s standards:\n\n"
            f"▶ Watch 18s Video Demo: {video_pitch_url or '[Link Attached]'}\n\n"
            f"We'd be glad to express a complimentary physical test kit directly to your California office for your team to evaluate in-hand.\n\n"
            f"Could you confirm if the office address on file is still the best location to send the parcel to?"
        )

        t3_step = TouchpointStep(
            step_number=3,
            channel="EMAIL",
            timing_day_offset=8,
            subject_or_type=t3_subject,
            content_text=t3_body,
            call_to_action="Watch 18s Video Demo & Confirm sample delivery address",
            evidence_tag=EvidenceType.RECOMMENDATION,
            anti_surveillance_verified=True
        )

        # -------------------------------------------------------------
        # ChatCut 4 轨物料全包组装 (Multimodal 4-Track Bundle)
        # -------------------------------------------------------------
        multimodal_assets = MultimodalAssetBundle(
            track_1_strategy_copy=f"Angle: {angle_info['name']} | Hook: {angle_info['hook']}",
            track_2_compliance_cert_bundle=f"CERT-BUNDLE-{company.upper().replace(' ', '-')}-FDA-GRS-2026.pdf",
            track_3_chatcut_video_pitch_url=video_pitch_url,
            track_3_video_duration_seconds=18,
            track_4_tiered_quote_sheet_asset=f"QUOTE-TIER-{company.upper().replace(' ', '-')}-EXW-FOB-DDP.xlsx"
        )

        # 自动执行去监控感审查
        full_text = f"{t1_body} {t2_body} {t3_body}".lower()
        forbidden_patterns = [
            r"according to (us )?customs",
            r"i saw your (bill of lading|b/l|manifest)",
            r"we tracked your shipments",
            r"you imported \d+ containers from",
            r"your current supplier is"
        ]

        audit_passed = True
        for pat in forbidden_patterns:
            if re.search(pat, full_text):
                audit_passed = False
                break

        return OutreachSequenceResponse(
            buyer_account_id=req.buyer_account_id,
            chosen_angle=angle_key,
            angle_display_name=angle_info["name"],
            contact_name=req.target_contact.full_name,
            contact_email=req.target_contact.email,
            sequence=[t1_step, t2_step, t3_step],
            multimodal_assets=multimodal_assets,
            anti_surveillance_audit_passed=audit_passed,
            requires_human_approval=True
        )

# 全局单例
outreach_engine = AngleDecisionAndOutreachEngine()
