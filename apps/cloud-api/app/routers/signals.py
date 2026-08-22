from fastapi import APIRouter
from app.models.schemas import CRMFeedbackEventRequest, CRMFeedbackEventResponse
from app.services.continuous_learning import continuous_learning_engine

router = APIRouter(prefix="/signals", tags=["Signals & Feedback Loop"])

@router.post("/feedback-event", response_model=CRMFeedbackEventResponse, summary="上报 CRM 转化节点事件（回复/样品/流失），触发权重模型微调")
async def report_feedback_event(event: CRMFeedbackEventRequest):
    """
    异步/实时消费 CRM 阶段流转信号，动态更新特定品类与目标市场策略权重。
    """
    return continuous_learning_engine.process_feedback(event)
