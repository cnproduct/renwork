"""
RenWork 信用点计量与计费管理服务 (Credits Ledger Service)
依据 PRD Table 44 商业模式与 V2.0 规范：
- Buyer Entity Resolution: 1 credit
- Account Intelligence: 2 credits
- Contact Enrichment: 3 credits
- Signal Refresh: 1 credit
- Active Account Monitoring: 5 credits/month
- Outreach Package: 4 credits
- CRM Duplicate Check: 1 credit
- Qualified Lead Handoff: 3 credits
- CRM Customer Sync: 1 credit
- CRM Snapshot Import: 0 credits (Free)
"""
import datetime
from typing import Dict, List, Optional
from app.models.schemas import CreditActionType, CreditBalanceResponse, CreditTransactionItem, CreditLedgerHistoryResponse


class CreditsLedgerService:

    ACTION_COSTS: Dict[CreditActionType, int] = {
        CreditActionType.ENTITY_RESOLUTION: 1,
        CreditActionType.ACCOUNT_INTELLIGENCE: 2,
        CreditActionType.CONTACT_ENRICHMENT: 3,
        CreditActionType.SIGNAL_REFRESH: 1,
        CreditActionType.ACCOUNT_MONITORING: 5,
        CreditActionType.OUTREACH_PACKAGE: 4,
        CreditActionType.CRM_DEDUPLICATION: 1,
        CreditActionType.QUALIFIED_HANDOFF: 3,
        CreditActionType.CUSTOMER_SYNC: 1,
        CreditActionType.SNAPSHOT_IMPORT: 0
    }

    def __init__(self):
        self.workspace_ledgers: Dict[str, Dict[str, int]] = {
            "WS-DEFAULT-001": {
                "total_quota": 5000,
                "used_credits": 142,
                "active_monitoring_count": 18
            }
        }
        self.transactions: Dict[str, List[CreditTransactionItem]] = {
            "WS-DEFAULT-001": []
        }

    def check_and_deduct(self, workspace_id: str, action: CreditActionType, target_entity: Optional[str] = None, description: Optional[str] = None) -> int:
        if workspace_id not in self.workspace_ledgers:
            self.workspace_ledgers[workspace_id] = {
                "total_quota": 1000,
                "used_credits": 0,
                "active_monitoring_count": 0
            }
            self.transactions[workspace_id] = []

        ledger = self.workspace_ledgers[workspace_id]
        cost = self.ACTION_COSTS.get(action, 1)

        if ledger["used_credits"] + cost > ledger["total_quota"]:
            remaining = ledger['total_quota'] - ledger['used_credits']
            raise ValueError(f"Insufficient credits for {action.value}. Current balance: {remaining}, required: {cost}")

        ledger["used_credits"] += cost
        balance_after = ledger["total_quota"] - ledger["used_credits"]

        # 记录交易流水
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        tx_id = f"TX-{datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')}-{abs(hash(now_iso)) % 10000}"
        
        tx_item = CreditTransactionItem(
            transaction_id=tx_id,
            timestamp=now_iso,
            workspace_id=workspace_id,
            action_type=action.value,
            credits_deducted=cost,
            balance_after=balance_after,
            description=description or f"Consumed {cost} credits for {action.value}.",
            target_entity=target_entity
        )
        self.transactions.setdefault(workspace_id, []).append(tx_item)

        return cost

    def get_balance(self, workspace_id: str) -> CreditBalanceResponse:
        ledger = self.workspace_ledgers.get(workspace_id, {
            "total_quota": 1000,
            "used_credits": 0,
            "active_monitoring_count": 0
        })
        return CreditBalanceResponse(
            workspace_id=workspace_id,
            total_quota=ledger["total_quota"],
            used_credits=ledger["used_credits"],
            remaining_credits=ledger["total_quota"] - ledger["used_credits"],
            active_monitoring_accounts_count=ledger["active_monitoring_count"],
            tier_name="Enterprise Growth Tier (RenWork × OKKI Integration)"
        )

    def get_transactions(self, workspace_id: str, limit: int = 50) -> CreditLedgerHistoryResponse:
        balance = self.get_balance(workspace_id)
        tx_list = self.transactions.get(workspace_id, [])[-limit:]
        return CreditLedgerHistoryResponse(
            workspace_id=workspace_id,
            total_quota=balance.total_quota,
            used_credits=balance.used_credits,
            remaining_credits=balance.remaining_credits,
            transactions_count=len(tx_list),
            transactions=tx_list
        )


# 全局单例
credits_service = CreditsLedgerService()
