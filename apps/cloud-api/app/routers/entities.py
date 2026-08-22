from fastapi import APIRouter, HTTPException
from app.models.schemas import EntityResolveRequest, EntityResolveResponse, CreditActionType
from app.services.entity_resolution import entity_service
from app.services.credits_service import credits_service

router = APIRouter(prefix="/entities", tags=["Entity Resolution"])

@router.post("/resolve", response_model=EntityResolveResponse, summary="提交原始提单买家文本，返回归一化实体与置信度")
async def resolve_entity(request: EntityResolveRequest):
    """
    接收海关提单收货人原始文本及地址，比对 120,000+ 货代黑名单，执行实体去噪与组织归一化对齐。
    扣除 1 点 Entity Resolution Credit。
    """
    if not request.raw_consignee_text or len(request.raw_consignee_text.strip()) == 0:
        raise HTTPException(status_code=400, detail="raw_consignee_text cannot be empty.")

    # 信用点扣减
    deducted = credits_service.check_and_deduct(request.workspace_id, CreditActionType.ENTITY_RESOLUTION)

    normalized_data, elapsed_ms = entity_service.resolve(
        raw_consignee=request.raw_consignee_text,
        address=request.address_text,
        notify_party=request.notify_party_text
    )

    return EntityResolveResponse(
        status="SUCCESS",
        input_text=request.raw_consignee_text,
        entity=normalized_data,
        credits_deducted=deducted,
        processing_time_ms=round(elapsed_ms, 2)
    )
