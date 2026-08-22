"""
RenWork 信用点计量与账本查询路由
"""
from fastapi import APIRouter, Query
from app.models.schemas import CreditBalanceResponse, CreditLedgerHistoryResponse
from app.services.credits_service import credits_service

router = APIRouter(prefix="/credits", tags=["Credits & Quota Ledger"])


@router.get("/balance", response_model=CreditBalanceResponse, summary="查询工作区买家情报信用点余额与监控账户数")
async def get_credit_balance(workspace_id: str = "WS-DEFAULT-001"):
    """
    符合 PRD Table 44 商业模式：查询工作区信用点额度、已消耗点数与持续监控中的重点买家账户数。
    """
    return credits_service.get_balance(workspace_id)


@router.get("/ledger", response_model=CreditLedgerHistoryResponse, summary="查询工作区信用点详细扣减流水与交易账本")
async def get_credit_ledger(
    workspace_id: str = "WS-DEFAULT-001",
    limit: int = Query(50, ge=1, le=200, description="返回最新流水记录数")
):
    """
    查询企业工作区所有操作的详细扣减账本（包括实体消歧、查重、评分、切入物料、合格移交与存量同步）。
    """
    return credits_service.get_transactions(workspace_id, limit=limit)
