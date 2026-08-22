from fastapi import APIRouter
from typing import List
from app.models.schemas import ActionApprovalRequest, ActionApprovalResponse, AuditLogItem
from app.services.audit_service import audit_service

router = APIRouter(prefix="/actions", tags=["Human Approval & Audit"])

@router.post("/approve", response_model=ActionApprovalResponse, summary="人工操作员审核批准/驳回外部触达动作")
async def approve_action(request: ActionApprovalRequest):
    """
    符合 PRD Table 41 规范：外部触达与发送动作必须经过人工确认并生成审计日志。
    """
    return audit_service.process_approval(request)

@router.get("/audit-logs", response_model=List[AuditLogItem], summary="查询系统安全操作与决策审计追踪日志")
async def get_audit_logs(limit: int = 50):
    """
    获取安全合规审计日志列表。
    """
    return audit_service.get_audit_logs(limit=limit)
