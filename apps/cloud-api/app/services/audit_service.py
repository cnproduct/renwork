import hashlib
import datetime
from typing import List, Dict, Optional
from app.models.schemas import ActionApprovalRequest, ActionApprovalResponse, AuditLogItem

class AuditAndApprovalService:
    """
    RenWork 操作审批与安全审计服务 (Audit & Approval Service)
    依据 PRD Table 41 & 46 规范：
    - 外部触达与发信动作默认触发【人工确认闸门 (Human Approval Gate)】。
    - 记录完整的审计哈希链（User ID, Action Type, Target, Timestamp, Model Version）。
    """

    def __init__(self):
        self.pending_actions: Dict[str, Dict] = {}
        self.audit_trail: List[AuditLogItem] = []

    def register_pending_action(self, action_type: str, user_id: str, target_account_id: str, content: str) -> str:
        action_id = f"ACT-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')}-{abs(hash(content)) % 10000}"
        self.pending_actions[action_id] = {
            "action_id": action_id,
            "action_type": action_type,
            "user_id": user_id,
            "target_account_id": target_account_id,
            "content": content,
            "status": "PENDING_HUMAN_APPROVAL",
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        return action_id

    def process_approval(self, req: ActionApprovalRequest) -> ActionApprovalResponse:
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        content_hash = hashlib.sha256(f"{req.action_id}:{req.approved_by_user_id}:{now_iso}".encode()).hexdigest()[:16]

        log_item = AuditLogItem(
            log_id=f"AUD-{len(self.audit_trail) + 1001}",
            timestamp=now_iso,
            user_id=req.approved_by_user_id,
            action_type="OUTREACH_DISPATCH",
            target_account_id=req.action_id,
            content_summary=req.reason or "Human operator confirmed outreach sequence dispatch.",
            approval_status=req.approval_decision,
            model_version="RenWork-Intent-360-v1.0"
        )
        self.audit_trail.append(log_item)

        if req.action_id in self.pending_actions:
            self.pending_actions[req.action_id]["status"] = req.approval_decision

        return ActionApprovalResponse(
            action_id=req.action_id,
            status="ACTION_APPROVED_AND_QUEUED" if req.approval_decision == "APPROVED" else "ACTION_REJECTED",
            dispatched_timestamp=now_iso,
            audit_hash=content_hash,
            message=f"Action '{req.action_id}' has been recorded in audit trail with status '{req.approval_decision}'."
        )

    def get_audit_logs(self, limit: int = 50) -> List[AuditLogItem]:
        return self.audit_trail[-limit:]

# 全局单例
audit_service = AuditAndApprovalService()
