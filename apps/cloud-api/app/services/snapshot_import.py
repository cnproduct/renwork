"""
RenWork × OKKI V2.0 - OKKI 存量客户快照导入与本地索引服务
OKKI Customer Snapshot Import & Local Index Service
"""
import re
import time
import hashlib
import datetime
from typing import Dict, List, Optional, Tuple

from app.models.okki_schemas import (
    OkkiCustomerRecord, SnapshotMetadata, SnapshotFreshness,
    SnapshotImportRequest, SnapshotImportResponse
)

# 全球常见法定组织后缀剥离字典 (30+ 国家)
LEGAL_SUFFIXES = [
    r"\bINC\.?\b", r"\bINCORPORATED\b", r"\bCORP\.?\b", r"\bCORPORATION\b",
    r"\bLLC\b", r"\bLTD\.?\b", r"\bLIMITED\b", r"\bCO\.?,?\s*LTD\.?\b",
    r"\bGMBH\b", r"\bAG\b", r"\bS\.?A\.?\b", r"\bS\.?R\.?L\.?\b",
    r"\bB\.?V\.?\b", r"\bN\.?V\.?\b", r"\bPTY\.?\s*LTD\.?\b",
    r"\bPVT\.?\s*LTD\.?\b", r"\bS\.?P\.?\s*Z\.?\s*O\.?\s*O\.?\b",
    r"\bS\.?R\.?O\.?\b", r"\bOY\b", r"\bAB\b", r"\bA/S\b", r"\bAS\b",
    r"\bKFT\b", r"\bLDA\b", r"\bMBH\b", r"\bEURL\b", r"\bSARL\b",
    r"\bCOMPANY\b", r"\bCO\.?\b", r"\bENTERPRISE\b", r"\bGROUP\b",
    r"\bHOLDINGS?\b", r"\bINTERNATIONAL\b", r"\bINT\'?L\b",
    r"\bTRADING\b", r"\bINDUSTR(Y|IES|IAL)\b",
]

# 公用邮箱域名黑名单
PUBLIC_EMAIL_DOMAINS = {
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "163.com", "126.com", "qq.com", "foxmail.com", "sina.com",
    "mail.ru", "yandex.ru", "protonmail.com", "icloud.com",
}

# ISO 3166-1 常见国家名称到 alpha-2 代码映射
COUNTRY_MAP = {
    "united states": "US", "usa": "US", "u.s.a.": "US", "u.s.": "US", "america": "US",
    "united kingdom": "GB", "uk": "GB", "england": "GB", "great britain": "GB",
    "germany": "DE", "deutschland": "DE", "france": "FR", "italy": "IT", "italia": "IT",
    "spain": "ES", "netherlands": "NL", "holland": "NL", "belgium": "BE",
    "canada": "CA", "australia": "AU", "japan": "JP", "south korea": "KR", "korea": "KR",
    "china": "CN", "taiwan": "TW", "hong kong": "HK", "singapore": "SG",
    "malaysia": "MY", "thailand": "TH", "vietnam": "VN", "indonesia": "ID",
    "india": "IN", "pakistan": "PK", "bangladesh": "BD", "philippines": "PH",
    "brazil": "BR", "mexico": "MX", "argentina": "AR", "chile": "CL",
    "turkey": "TR", "saudi arabia": "SA", "uae": "AE", "united arab emirates": "AE",
    "israel": "IL", "egypt": "EG", "south africa": "ZA", "nigeria": "NG",
    "russia": "RU", "poland": "PL", "czech republic": "CZ", "sweden": "SE",
    "norway": "NO", "denmark": "DK", "finland": "FI", "switzerland": "CH",
    "austria": "AT", "portugal": "PT", "ireland": "IE", "greece": "GR",
    "new zealand": "NZ", "colombia": "CO", "peru": "PE", "venezuela": "VE",
}


def normalize_domain(raw: Optional[str]) -> Optional[str]:
    """域名归一化：提取 eTLD+1 标准根域名"""
    if not raw:
        return None
    d = raw.strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = re.sub(r"^www\.", "", d)
    d = d.split("/")[0].split("?")[0].split("#")[0]
    d = d.strip().rstrip(".")
    return d if d and "." in d else None


def normalize_company_name(raw: str) -> str:
    """组织名称规范化：去除法定后缀、标点与多余空格"""
    name = raw.upper().strip()
    name = re.sub(r"[,./\\\-()\[\]{}]", " ", name)
    for suffix_pattern in LEGAL_SUFFIXES:
        name = re.sub(suffix_pattern, "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s+", " ", name).strip()
    return name.lower()


def normalize_country(raw: Optional[str]) -> Optional[str]:
    """国家代码对齐：转 ISO 3166-1 alpha-2"""
    if not raw:
        return None
    key = raw.strip().lower()
    if len(key) == 2:
        return key.upper()
    return COUNTRY_MAP.get(key, key.upper()[:2])


def extract_email_domain(email: Optional[str]) -> Optional[str]:
    """提取企业邮箱后缀域名，过滤公用邮箱"""
    if not email or "@" not in email:
        return None
    domain = email.strip().lower().split("@")[1]
    if domain in PUBLIC_EMAIL_DOMAINS:
        return None
    return domain


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """电话号码规范化：提取数字"""
    if not raw:
        return None
    digits = re.sub(r"[^0-9]", "", raw)
    return digits[-8:] if len(digits) >= 8 else digits if digits else None


class SnapshotImportService:
    """
    OKKI 存量客户快照导入与本地索引服务
    Skill 01: OKKI Customer Snapshot Import Skill
    """

    SNAPSHOT_TTL_DAYS = 14

    def __init__(self):
        # 本地存量客户索引 {workspace_id: {normalized_domain|name: [records]}}
        self.customer_index: Dict[str, Dict[str, List[Dict]]] = {}
        # 快照元数据 {workspace_id: SnapshotMetadata}
        self.snapshot_metadata: Dict[str, SnapshotMetadata] = {}
        # 原始记录存储 {workspace_id: [records]}
        self.raw_records: Dict[str, List[Dict]] = {}

    def import_snapshot(self, request: SnapshotImportRequest) -> SnapshotImportResponse:
        """导入 OKKI 客户快照并构建本地高速哈希索引"""
        start_time = time.perf_counter()
        ws = request.workspace_id

        # 初始化索引
        self.customer_index[ws] = {}
        self.raw_records[ws] = []
        imported = 0
        merged = 0
        skipped = 0

        for record in request.records:
            # 标准化处理
            norm_name = normalize_company_name(record.company_name)
            norm_domain = normalize_domain(record.website or record.domain)
            norm_country = normalize_country(record.country)
            norm_email_domain = extract_email_domain(record.email)
            norm_phone = normalize_phone(record.phone)

            if not norm_name and not norm_domain:
                skipped += 1
                continue

            entry = {
                "okki_id": record.okki_customer_id,
                "raw_name": record.company_name,
                "normalized_name": norm_name,
                "normalized_domain": norm_domain,
                "country": norm_country,
                "email_domain": norm_email_domain,
                "phone_suffix": norm_phone,
                "contact_name": (record.contact_name or "").strip().lower(),
                "owner": record.owner_name,
                "stage": record.customer_stage,
                "last_followup": record.last_followup_date,
                "deal_status": record.deal_status,
            }

            # 检查是否为更新已存在记录
            existing_key = norm_domain or norm_name
            if existing_key in self.customer_index[ws]:
                merged += 1
            else:
                imported += 1

            # 构建多键索引
            if norm_domain:
                self.customer_index[ws].setdefault(norm_domain, []).append(entry)
            if norm_name:
                self.customer_index[ws].setdefault(norm_name, []).append(entry)
            if norm_email_domain:
                self.customer_index[ws].setdefault(norm_email_domain, []).append(entry)

            self.raw_records[ws].append(entry)

        # 生成快照元数据
        now = datetime.datetime.now(datetime.timezone.utc)
        valid_until = now + datetime.timedelta(days=self.SNAPSHOT_TTL_DAYS)
        content_hash = hashlib.sha256(
            f"{ws}:{len(request.records)}:{now.isoformat()}".encode()
        ).hexdigest()[:16]

        metadata = SnapshotMetadata(
            snapshot_id=f"SNAP-{content_hash}",
            file_name=f"okki_export_{now.strftime('%Y%m%d')}.xlsx",
            imported_at=now.isoformat(),
            record_count=imported + merged,
            valid_until=valid_until.isoformat(),
            freshness=SnapshotFreshness.FRESH,
            file_hash=content_hash
        )
        self.snapshot_metadata[ws] = metadata

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return SnapshotImportResponse(
            status="SNAPSHOT_IMPORTED",
            snapshot_metadata=metadata,
            records_imported=imported,
            records_merged=merged,
            records_skipped=skipped,
            index_build_time_ms=round(elapsed_ms, 2),
            credits_deducted=0  # 快照导入本身不收费
        )

    def get_snapshot_freshness(self, workspace_id: str) -> Tuple[SnapshotFreshness, Optional[str]]:
        """检查快照新鲜度"""
        meta = self.snapshot_metadata.get(workspace_id)
        if not meta:
            return SnapshotFreshness.EXPIRED, None

        now = datetime.datetime.now(datetime.timezone.utc)
        imported_at = datetime.datetime.fromisoformat(meta.imported_at)
        age_days = (now - imported_at).days

        if age_days <= 7:
            return SnapshotFreshness.FRESH, meta.imported_at
        elif age_days <= 14:
            return SnapshotFreshness.EXPIRING_SOON, meta.imported_at
        else:
            return SnapshotFreshness.EXPIRED, meta.imported_at

    def get_index(self, workspace_id: str) -> Dict[str, List[Dict]]:
        """获取本地索引"""
        return self.customer_index.get(workspace_id, {})

    def get_raw_records(self, workspace_id: str) -> List[Dict]:
        """获取所有原始标准化记录"""
        return self.raw_records.get(workspace_id, [])


# 全局单例
snapshot_service = SnapshotImportService()
