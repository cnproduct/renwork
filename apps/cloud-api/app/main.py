from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import (
    entities,
    intent,
    outreach,
    signals,
    orchestrator,
    actions,
    credits,
    crm,
    leads,
    releases,
    health_routes
)

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="RenWork Buyer Intent 360 云端核心大脑微服务 (PRD V1.0 增强版)：托管实体消歧、Double Signal 三层评分、ChatCut 4轨多模态物料、12类商业策略、自进化学习、人工审批与 Credits 计量账本。"
)

# 允许本地插件与客户端跨域请求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载业务与契约路由
app.include_router(health_routes.router, prefix=settings.api_prefix)
app.include_router(leads.router, prefix=settings.api_prefix)
app.include_router(releases.router, prefix=settings.api_prefix)

app.include_router(entities.router, prefix=settings.api_prefix)
app.include_router(intent.router, prefix=settings.api_prefix)
app.include_router(outreach.router, prefix=settings.api_prefix)
app.include_router(signals.router, prefix=settings.api_prefix)
app.include_router(orchestrator.router, prefix=settings.api_prefix)
app.include_router(actions.router, prefix=settings.api_prefix)
app.include_router(credits.router, prefix=settings.api_prefix)
app.include_router(crm.router, prefix=settings.api_prefix)

@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "HEALTHY",
        "app_name": settings.app_name,
        "version": settings.version,
        "environment": settings.environment,
        "forwarder_patterns_loaded": settings.forwarder_database_size,
        "prd_version": "PRD_V1.0_COMPLIANT"
    }

@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "Welcome to RenWork Buyer Intent 360 Cloud API (PRD V1.0 Enhanced Local Sandbox)",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "api_v1": settings.api_prefix
    }
