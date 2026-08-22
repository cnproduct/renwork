from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/health", tags=["Health & Liveness"])

@router.get("/live")
async def liveness_probe():
  return {"status": "LIVE", "timestamp": "2026-08-22T02:00:00Z"}

@router.get("/ready")
async def readiness_probe():
  return {
      "status": "READY",
      "app_name": settings.app_name,
      "version": settings.version,
      "environment": settings.environment,
      "database": "connected"
  }
