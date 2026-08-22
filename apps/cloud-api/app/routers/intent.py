from fastapi import APIRouter
from pydantic import BaseModel
from app.models.schemas import (
    BuyerProfileInput,
    ExporterGraphInput,
    OpportunityEvaluationResponse,
    CreditActionType
)
from app.services.scoring_engine import scoring_engine
from app.services.credits_service import credits_service

router = APIRouter(prefix="/intent", tags=["Buyer Intent & Scoring"])

class IntentEvaluatePayload(BaseModel):
    buyer_profile: BuyerProfileInput
    exporter_graph: ExporterGraphInput
    workspace_id: str = "WS-DEFAULT-001"

@router.post("/evaluate-opportunity", response_model=OpportunityEvaluationResponse, summary="传入买家画像与出口商图谱，返回三层评分明细与 Why Now 决策阐释")
async def evaluate_opportunity(payload: IntentEvaluatePayload):
    """
    计算 Purchase Evidence + Exporter Fit + Supplier Opportunity + Double Signal，
    扣除 2 点 Account Intelligence Credits。
    """
    credits_service.check_and_deduct(payload.workspace_id, CreditActionType.ACCOUNT_INTELLIGENCE)

    result = scoring_engine.evaluate(
        buyer=payload.buyer_profile,
        exporter=payload.exporter_graph
    )
    return result
