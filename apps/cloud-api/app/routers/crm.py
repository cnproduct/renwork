"""
RenWork × OKKI V2.0 - CRM 协同核心 RESTful 路由
CRM Integration Endpoints for Snapshot Import, Deduplication, Handoff & Sync
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import CreditActionType
from app.models.okki_schemas import (
    SnapshotImportRequest, SnapshotImportResponse,
    DeduplicationRequest, DeduplicationResponse,
    HandoffRequest, HandoffResponse,
    CustomerSyncRequest, CustomerSyncResponse,
    AccountRegistryStats, HandoffTier, MatchStatus
)
from app.services.snapshot_import import snapshot_service
from app.services.deduplication_engine import deduplication_engine
from app.services.handoff_packager import handoff_service
from app.services.customer_sync_service import customer_sync_service
from app.services.account_registry_service import account_registry_service
from app.services.credits_service import credits_service

router = APIRouter(prefix="/crm", tags=["CRM & OKKI Integration (Pre-CRM Engine)"])


@router.post("/snapshot/import", response_model=SnapshotImportResponse, summary="导入 OKKI 存量客户快照并构建本地索引")
async def import_okki_snapshot(request: SnapshotImportRequest):
    """
    导入从 OKKI 导出的客户数据（CSV/Excel转换后的JSON），在本地完成标准化清洗与哈希索引构建。
    不消耗 credits（免费提供），建立防撞单本地底座。
    """
    if not request.records:
        raise HTTPException(status_code=400, detail="records list cannot be empty.")
    
    # 记录扣费流水 (0 credit)
    credits_service.check_and_deduct(
        workspace_id=request.workspace_id,
        action=CreditActionType.SNAPSHOT_IMPORT,
        description=f"Imported {len(request.records)} OKKI customer snapshot records."
    )

    return snapshot_service.import_snapshot(request)


@router.get("/snapshot/freshness", summary="查询 OKKI 客户快照新鲜度与有效期")
async def get_snapshot_freshness(workspace_id: str = "WS-DEFAULT-001"):
    """
    查询当前工作区 OKKI 快照的导入日期、有效期限 (默认14天 TTL) 与新鲜度状态 (FRESH / EXPIRING_SOON / EXPIRED)。
    """
    freshness, imported_at = snapshot_service.get_snapshot_freshness(workspace_id)
    records = snapshot_service.get_raw_records(workspace_id)
    return {
        "workspace_id": workspace_id,
        "freshness": freshness.value,
        "imported_at": imported_at,
        "cached_records_count": len(records),
        "ttl_days": snapshot_service.SNAPSHOT_TTL_DAYS
    }


@router.post("/deduplicate", response_model=DeduplicationResponse, summary="海关新买家与 OKKI 存量快照多因子查重")
async def deduplicate_prospect(request: DeduplicationRequest):
    """
    对新发现的海关买家执行 6 维多因子加权查重（域名40% + 公司名25% + 邮箱15% + 地理10% + 电话5% + 联系人5%），
    输出 8 级匹配状态代码 (S1-S8)、置信度与排重决策。
    扣除 1 点 CRM Duplicate Check Credit。
    """
    if not request.prospect_name or len(request.prospect_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="prospect_name cannot be empty.")

    # 信用点扣减
    credits_service.check_and_deduct(
        workspace_id=request.workspace_id,
        action=CreditActionType.CRM_DEDUPLICATION,
        target_entity=request.prospect_name,
        description=f"Deduplicated prospect '{request.prospect_name}' against OKKI snapshot."
    )

    return deduplication_engine.check_deduplication(request)


@router.post("/handoff", response_model=HandoffResponse, summary="达标潜客交接门禁封包与生成 OKKI 导入模板")
async def handoff_qualified_lead(request: HandoffRequest):
    """
    针对达到 Tier 4 (积极回复) 或 Tier 5 (明确意向) 的合格线索执行门禁核验，
    自动组装海关采购证据、采购决策链画像与 Next Best Action，生成 OKKI 标准导入包。
    扣除 3 点 Qualified Lead Handoff Credits。
    """
    # 信用点扣减
    credits_service.check_and_deduct(
        workspace_id=request.workspace_id,
        action=CreditActionType.QUALIFIED_HANDOFF,
        target_entity=request.company_profile.normalized_name,
        description=f"Packaged qualified lead '{request.company_profile.normalized_name}' for OKKI handoff ({request.qualification_tier.value})."
    )

    return handoff_service.package_handoff(request)


@router.post("/sync", response_model=CustomerSyncResponse, summary="存量客户 API 增量活动记录与阶段同步")
async def sync_existing_customer(request: CustomerSyncRequest):
    """
    针对已在 OKKI 建立正式客户 ID 的存量客户，调用 OKKI Open API 回写 RenWork 监测到的新互动日志与阶段变更。
    扣除 1 点 CRM Customer Sync Credit。
    """
    if not request.okki_customer_id:
        raise HTTPException(status_code=400, detail="okki_customer_id is required for customer sync.")

    credits_service.check_and_deduct(
        workspace_id=request.workspace_id,
        action=CreditActionType.CUSTOMER_SYNC,
        target_entity=request.okki_customer_id,
        description=f"Synced {len(request.activities)} activities to OKKI Customer ID '{request.okki_customer_id}'."
    )

    return customer_sync_service.sync_customer(request)


@router.get("/registry/stats", response_model=AccountRegistryStats, summary="获取企业客户主索引 (Account Registry) 统计看板")
async def get_account_registry_stats(workspace_id: str = "WS-DEFAULT-001"):
    """
    获取三层存储分区统计：
    1. Prospect Pool 潜客池数量
    2. Existing Customer Registry 存量快照数
    3. Qualified Handoff Queue 待交接合格线索数
    """
    return account_registry_service.get_stats(workspace_id)


@router.get("/registry/prospects", summary="查询潜客池中的潜在买家列表")
async def list_prospect_pool(
    workspace_id: str = "WS-DEFAULT-001",
    tier: Optional[HandoffTier] = None,
    match_status: Optional[MatchStatus] = None
):
    """
    按成熟度分级 (Tier 0 - Tier 5) 或查重状态 (S1 - S8) 筛选潜客池中的买家。
    """
    prospects = account_registry_service.list_prospects(workspace_id, tier=tier, match_status=match_status)
    return {
        "workspace_id": workspace_id,
        "total_count": len(prospects),
        "prospects": prospects
    }
