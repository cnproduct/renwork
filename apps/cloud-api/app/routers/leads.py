from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
import uuid
import json
import os
from datetime import datetime

router = APIRouter(prefix="/leads", tags=["Leads & Growth Diagnosis"])

LEADS_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "leads_store.json")
os.makedirs(os.path.dirname(LEADS_FILE), exist_ok=True)

class AttributionModel(BaseModel):
  utm_source: Optional[str] = None
  utm_medium: Optional[str] = None
  utm_campaign: Optional[str] = None
  utm_content: Optional[str] = None
  landing_path: Optional[str] = None
  referrer: Optional[str] = None

class LeadCreateRequest(BaseModel):
  company_name: str = Field(..., min_length=2, description="企业全称")
  website: Optional[str] = None
  contact_name: str = Field(..., min_length=2, description="联系人姓名")
  job_title: Optional[str] = "Export Manager"
  work_email: EmailStr = Field(..., description="工作企业邮箱")
  phone: Optional[str] = None
  whatsapp: Optional[str] = None
  products: List[str] = Field(default_factory=list, description="主营出口产品")
  target_markets: List[str] = Field(default_factory=list, description="目标市场")
  team_size_range: Optional[str] = "6-20"
  pain_points: List[str] = Field(default_factory=list, description="外贸痛点")
  preferred_contact_time: Optional[str] = "weekday_afternoon"
  privacy_policy_version: str = "2026-08-22"
  privacy_consent: bool = Field(..., description="必须同意隐私保护政策")
  marketing_consent: Optional[bool] = True
  attribution: Optional[AttributionModel] = None

class LeadResponse(BaseModel):
  lead_id: str
  status: str
  request_id: str
  next: str
  created_at: str

@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    lead_in: LeadCreateRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key")
):
  if not lead_in.privacy_consent:
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="CONSENT_REQUIRED: 必须明确同意隐私保护协议方可提交诊断请求"
    )

  request_id = idempotency_key or f"req_{uuid.uuid4().hex}"
  lead_id = f"lead_{uuid.uuid4().hex[:12]}"
  now_iso = datetime.utcnow().isoformat() + "Z"

  lead_record = {
      "lead_id": lead_id,
      "request_id": request_id,
      "created_at": now_iso,
      "data": lead_in.dict()
  }

  # Persist to JSON ledger
  leads_list = []
  if os.path.exists(LEADS_FILE):
    try:
      with open(LEADS_FILE, "r", encoding="utf-8") as f:
        leads_list = json.load(f)
    except Exception:
      leads_list = []

  # Idempotency check: if idempotency_key exists, return existing record
  if idempotency_key:
    for existing in leads_list:
      if existing.get("request_id") == idempotency_key:
        return LeadResponse(
            lead_id=existing["lead_id"],
            status="accepted",
            request_id=idempotency_key,
            next="/diagnosis/thanks",
            created_at=existing["created_at"]
        )

  leads_list.append(lead_record)
  with open(LEADS_FILE, "w", encoding="utf-8") as f:
    json.dump(leads_list, f, ensure_ascii=False, indent=2)

  return LeadResponse(
      lead_id=lead_id,
      status="accepted",
      request_id=request_id,
      next="/diagnosis/thanks",
      created_at=now_iso
  )

@router.get("/count", tags=["Leads & Growth Diagnosis"])
async def get_leads_count():
  count = 0
  if os.path.exists(LEADS_FILE):
    try:
      with open(LEADS_FILE, "r", encoding="utf-8") as f:
        leads = json.load(f)
        count = len(leads)
    except Exception:
      count = 0
  return {"total_leads": count, "service": "rrenn_web_leads"}
