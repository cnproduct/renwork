"""
RenWork × OKKI V2.0 - 存量客户 API 增量同步服务 (Existing Customer Sync Service)
Skill 04: OKKI Existing Customer Sync Skill
"""
import time
import datetime
from typing import Dict, List, Optional, Any

from app.models.okki_schemas import (
    CustomerSyncRequest, CustomerSyncResponse, ActivityLogEntry, SyncDirection
)


class ExistingCustomerSyncService:
    """
    OKKI 存量客户 API 增量双向同步服务
    在潜客成功导入 OKKI 并取得 OKKI Customer ID 后，负责将 RenWork 监测到的新互动、
    新海关提单异动及触达结果回写至 OKKI 客户时间轴。
    """

    def __init__(self):
        # 同步审计日志 {sync_id: sync_record}
        self.sync_logs: Dict[str, Dict] = {}
        # 客户映射表 {okki_id: {renwork_id, last_sync, activities_count}}
        self.mapped_customers: Dict[str, Dict] = {}

    def sync_customer(self, request: CustomerSyncRequest) -> CustomerSyncResponse:
        start_time = time.perf_counter()
        now = datetime.datetime.now(datetime.timezone.utc)
        okki_id = request.okki_customer_id

        sync_id = f"SYNC-{now.strftime('%Y%m%d%H%M%S')}-{abs(hash(okki_id)) % 10000}"

        # 模拟调用 OKKI Open API 写入活动记录与更新客户阶段
        activities_count = len(request.activities)
        stage_updated = bool(request.update_stage)
        notes_appended = bool(request.update_notes)

        # 更新本地映射缓存
        if okki_id not in self.mapped_customers:
            self.mapped_customers[okki_id] = {
                "okki_customer_id": okki_id,
                "first_synced_at": now.isoformat(),
                "total_activities": 0,
                "current_stage": request.update_stage or "IN_PROGRESS",
            }

        cust_record = self.mapped_customers[okki_id]
        cust_record["last_synced_at"] = now.isoformat()
        cust_record["total_activities"] += activities_count
        if request.update_stage:
            cust_record["current_stage"] = request.update_stage

        # 记录同步日志
        sync_log = {
            "sync_id": sync_id,
            "workspace_id": request.workspace_id,
            "okki_customer_id": okki_id,
            "sync_direction": request.sync_direction.value,
            "activities_synced": activities_count,
            "stage_updated": stage_updated,
            "notes_appended": notes_appended,
            "timestamp": now.isoformat(),
        }
        self.sync_logs[sync_id] = sync_log

        return CustomerSyncResponse(
            status="SUCCESS",
            sync_id=sync_id,
            okki_customer_id=okki_id,
            activities_synced=activities_count,
            stage_updated=stage_updated,
            notes_appended=notes_appended,
            sync_direction=request.sync_direction,
            credits_deducted=1  # 同步消耗 1 Credit
        )

    def get_sync_history(self, okki_id: Optional[str] = None) -> List[Dict]:
        if okki_id:
            return [log for log in self.sync_logs.values() if log.get("okki_customer_id") == okki_id]
        return list(self.sync_logs.values())

    def get_mapped_customers_count(self) -> int:
        return len(self.mapped_customers)


# 全局单例
customer_sync_service = ExistingCustomerSyncService()
