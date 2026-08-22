from fastapi import APIRouter
from app.models.schemas import OutreachSequenceRequest, OutreachSequenceResponse, CreditActionType
from app.services.angle_decision import outreach_engine
from app.services.credits_service import credits_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/outreach", tags=["Outreach & Sequence Generation"])

@router.post("/generate-sequence", response_model=OutreachSequenceResponse, summary="传入买家、决策人与指定 Angle，返回自然化 3-Touch 开发序列与 ChatCut 4 轨物料")
async def generate_sequence(request: OutreachSequenceRequest):
    """
    根据 12 种商业切入角度生成 3-Touch 序列与 ChatCut 4 轨物料包，
    扣除 4 点 Outreach Package Credits 并注册待人工确认的 Action。
    """
    credits_service.check_and_deduct(request.workspace_id, CreditActionType.OUTREACH_PACKAGE)

    response = outreach_engine.generate_sequence(request)

    # 注册待人工确认 Action 记录
    audit_service.register_pending_action(
        action_type="OUTREACH_PACKAGE_GENERATION",
        user_id="SALES-USER-01",
        target_account_id=request.buyer_account_id,
        content=response.sequence[0].content_text
    )

    return response
