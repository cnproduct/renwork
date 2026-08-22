from fastapi import APIRouter
import datetime
from app.models.schemas import DailyQueueResponse, DailyQueueItem, BuyerGrade

router = APIRouter(prefix="/orchestrator", tags=["Daily Queue & Orchestrator"])

@router.get("/daily-queue", response_model=DailyQueueResponse, summary="销售代表拉取每日优先级排序后的高意向买家队列与执行卡片")
async def get_daily_queue():
    """
    拉取今日经过三层模型与 Double Signal 加权排序的买家执行卡片（NBA Cards），供外贸业务员一键执行。
    """
    today_str = datetime.date.today().isoformat()

    items = [
        DailyQueueItem(
            rank=1,
            buyer_account_id="BUYER-US-99102",
            buyer_company_name="Hydratech Global Solutions LLC",
            country="United States",
            ops_score=93.4,
            grade=BuyerGrade.A_PLUS_PLUS,
            hhi_index=0.74,
            primary_signal="主供份额近 60 天骤降 38.5% (供应链异动窗口)",
            double_signal_status="已共振 (海关提单异动 + LinkedIn 官方发布 Q3 扩产声明)",
            recommended_angle="second_source_resilience",
            why_now="近期采购持续增长，主供出货异动下滑，产品与出口商能力高度匹配，同时出现新品公开信号，且已找到采购负责人。",
            primary_contact_name="Sarah Jenkins",
            primary_contact_email="sarah.jenkins@hydratech-solutions.com",
            action_card_title="发送 Second Source 保供方案、ChatCut 18秒 3D 视频与 1-Page 模具公差对比表",
            action_ready_asset="PDF_SPEC_TRITAN_TOLERANCE_2026.pdf"
        ),
        DailyQueueItem(
            rank=2,
            buyer_account_id="BUYER-DE-44120",
            buyer_company_name="Nordic Living GmbH & Co. KG",
            country="Germany",
            ops_score=85.2,
            grade=BuyerGrade.A_PLUS,
            hhi_index=0.52,
            primary_signal="欧洲再生塑料合规新规生效 (ESG/GRS 替换紧迫)",
            double_signal_status="已共振 (欧洲海关提单 + 官网首页公告全面淘汰传统原生塑料)",
            recommended_angle="esg_sustainable_compliance",
            why_now="欧洲客户官网公告全面淘汰非再生塑料，持有 GRS 认证及 LFGB 测试报告可直击需求。",
            primary_contact_name="Klaus Weber",
            primary_contact_email="klaus.weber@nordic-living.de",
            action_card_title="发送 GRS 认证合规包及免费 PCR 材料样品套件",
            action_ready_asset="GRS_RECYCLED_TRITAN_CERT_BUNDLE.pdf"
        ),
        DailyQueueItem(
            rank=3,
            buyer_account_id="BUYER-US-10294",
            buyer_company_name="Pacific Outdoor Brands Inc",
            country="United States",
            ops_score=78.0,
            grade=BuyerGrade.A,
            hhi_index=0.62,
            primary_signal="采购量环比激增 +42% (旺季补单脉冲)",
            double_signal_status="交易单向信号 (待刷新社交公开信号)",
            recommended_angle="backup_capacity_peak",
            why_now="连续两月追加货柜，现有产能面临交付吃紧，锁定备用产线契机好。",
            primary_contact_name="Mark Robinson",
            primary_contact_email="m.robinson@pacific-outdoor.com",
            action_card_title="提供 21 天极速大货出货承诺函与排产绿色通道",
            action_ready_asset="EXPEDITED_DELIVERY_SLA_SHEET.pdf"
        )
    ]

    return DailyQueueResponse(
        generated_date=today_str,
        total_in_queue=len(items),
        high_priority_count=2,
        items=items
    )
