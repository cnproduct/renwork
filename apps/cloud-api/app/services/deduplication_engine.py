"""
RenWork × OKKI V2.0 - 多因子混合查重引擎 (CRM Deduplication & Conflict Resolution Engine)
Skill 02: CRM Duplicate Check & Conflict Resolution Skill
"""
import time
import math
import datetime
from typing import List, Dict, Optional, Tuple

from app.models.okki_schemas import (
    DeduplicationRequest, DeduplicationResponse, MatchCandidate,
    MatchStatus, MatchFactorDetail, SnapshotFreshness
)
from app.services.snapshot_import import (
    snapshot_service, normalize_company_name, normalize_domain,
    normalize_country, extract_email_domain, normalize_phone
)


def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """计算 Jaro-Winkler 字符串相似度 (0.0 ~ 1.0)"""
    if s1 == s2:
        return 1.0
    if not s1 or not s2:
        return 0.0

    len1, len2 = len(s1), len(s2)
    max_dist = max(len1, len2) // 2 - 1
    if max_dist < 0:
        max_dist = 0

    s1_matches = [False] * len1
    s2_matches = [False] * len2

    matches = 0
    for i in range(len1):
        start = max(0, i - max_dist)
        end = min(i + max_dist + 1, len2)
        for j in range(start, end):
            if s2_matches[j] or s1[i] != s2[j]:
                continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    transpositions = 0
    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions /= 2
    jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0

    # Winkler prefix bonus (up to 4 chars)
    prefix = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix += 1
        else:
            break

    return round(jaro + prefix * 0.1 * (1.0 - jaro), 4)


class CRMDeduplicationEngine:
    """
    RenWork 多因子加权查重与冲突仲裁引擎
    加权模型：
    - 官网根域名一致性 (40%)
    - 标准化公司名称 Jaro-Winkler 相似度 (25%)
    - 联系人企业邮箱域名 (15%)
    - 国家/地理位置 (10%)
    - 联系人电话/传真 (5%)
    - 核心决策人姓名 (5%)
    """

    # 查重阈值定义
    EXACT_MATCH_THRESHOLD = 0.90
    LIKELY_MATCH_THRESHOLD = 0.70
    MANUAL_CHECK_THRESHOLD = 0.50

    def __init__(self):
        # 排除黑名单（货代/竞争对手/黑名单关键字）
        self.excluded_keywords = [
            "logistics", "freight", "forwarding", "expeditors", "nvocc",
            "dhl", "fedex", "ups", "maersk", "cosco", "kuehne nagel",
            "schenker", "panalpina", "sinotrans", "db schenker"
        ]

    def check_deduplication(self, request: DeduplicationRequest) -> DeduplicationResponse:
        start_time = time.perf_counter()
        ws = request.workspace_id

        # 1. 检查黑名单 (S8_EXCLUDED)
        norm_name = normalize_company_name(request.prospect_name)
        norm_domain = normalize_domain(request.prospect_domain)
        norm_country = normalize_country(request.prospect_country)
        norm_email_domain = extract_email_domain(request.prospect_email)
        norm_phone = normalize_phone(request.prospect_phone)
        norm_contact = (request.prospect_contact_name or "").strip().lower()

        for kw in self.excluded_keywords:
            if kw in norm_name or (norm_domain and kw in norm_domain):
                elapsed_ms = (time.perf_counter() - start_time) * 1000.0
                return DeduplicationResponse(
                    status="COMPLETED",
                    prospect_name=request.prospect_name,
                    normalized_prospect_name=norm_name,
                    normalized_prospect_domain=norm_domain,
                    snapshot_freshness=SnapshotFreshness.FRESH,
                    snapshot_date=datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
                    best_match=None,
                    all_candidates=[],
                    final_verdict=MatchStatus.S8_EXCLUDED,
                    action_recommendation="已命中货代或排除黑名单，停止开发并归档。",
                    credits_deducted=1,
                    processing_time_ms=round(elapsed_ms, 2)
                )

        # 2. 检查快照新鲜度
        freshness, snapshot_date = snapshot_service.get_snapshot_freshness(ws)
        if not snapshot_date:
            snapshot_date = "N/A (未导入快照)"

        raw_records = snapshot_service.get_raw_records(ws)

        # 3. 若无快照数据，返回需要人工核验或未发现
        if not raw_records:
            elapsed_ms = (time.perf_counter() - start_time) * 1000.0
            return DeduplicationResponse(
                status="COMPLETED",
                prospect_name=request.prospect_name,
                normalized_prospect_name=norm_name,
                normalized_prospect_domain=norm_domain,
                snapshot_freshness=SnapshotFreshness.EXPIRED,
                snapshot_date=snapshot_date,
                best_match=None,
                all_candidates=[],
                final_verdict=MatchStatus.S5_MANUAL_CHECK,
                action_recommendation="当前工作区未导入 OKKI 存量客户快照，无法执行自动查重，请先导入客户快照或人工核验。",
                credits_deducted=1,
                processing_time_ms=round(elapsed_ms, 2)
            )

        # 4. 多因子加权比对
        candidates: List[MatchCandidate] = []

        for rec in raw_records:
            factors: List[MatchFactorDetail] = []

            # 4.1 域名因子 (40%)
            domain_sim = 0.0
            rec_domain = rec.get("normalized_domain")
            if norm_domain and rec_domain:
                if norm_domain == rec_domain:
                    domain_sim = 1.0
                elif norm_domain in rec_domain or rec_domain in norm_domain:
                    domain_sim = 0.80

            factors.append(MatchFactorDetail(
                factor_name="Root Domain Match",
                weight=0.40,
                similarity=domain_sim,
                weighted_score=round(domain_sim * 0.40, 4),
                evidence=f"Prospect: '{norm_domain or 'N/A'}' vs Snapshot: '{rec_domain or 'N/A'}'"
            ))

            # 4.2 公司名称因子 (25%)
            name_sim = jaro_winkler_similarity(norm_name, rec.get("normalized_name", ""))
            factors.append(MatchFactorDetail(
                factor_name="Normalized Name Similarity (Jaro-Winkler)",
                weight=0.25,
                similarity=name_sim,
                weighted_score=round(name_sim * 0.25, 4),
                evidence=f"Prospect: '{norm_name}' vs Snapshot: '{rec.get('normalized_name')}' (sim: {name_sim})"
            ))

            # 4.3 邮箱域名因子 (15%)
            email_sim = 0.0
            rec_email_domain = rec.get("email_domain")
            if norm_email_domain and rec_email_domain:
                if norm_email_domain == rec_email_domain:
                    email_sim = 1.0
            elif norm_domain and rec_email_domain:
                if norm_domain == rec_email_domain:
                    email_sim = 0.90
            elif norm_email_domain and rec_domain:
                if norm_email_domain == rec_domain:
                    email_sim = 0.90

            factors.append(MatchFactorDetail(
                factor_name="Corporate Email Domain Match",
                weight=0.15,
                similarity=email_sim,
                weighted_score=round(email_sim * 0.15, 4),
                evidence=f"Prospect Email Domain: '{norm_email_domain or 'N/A'}' vs Snapshot: '{rec_email_domain or 'N/A'}'"
            ))

            # 4.4 国家地理因子 (10%)
            geo_sim = 0.0
            rec_country = rec.get("country")
            if norm_country and rec_country:
                if norm_country == rec_country:
                    geo_sim = 1.0
                else:
                    geo_sim = 0.0
            elif not norm_country or not rec_country:
                geo_sim = 0.50  # 缺省给中立分

            factors.append(MatchFactorDetail(
                factor_name="Country / Geography Alignment",
                weight=0.10,
                similarity=geo_sim,
                weighted_score=round(geo_sim * 0.10, 4),
                evidence=f"Prospect: '{norm_country or 'N/A'}' vs Snapshot: '{rec_country or 'N/A'}'"
            ))

            # 4.5 电话因子 (5%)
            phone_sim = 0.0
            rec_phone = rec.get("phone_suffix")
            if norm_phone and rec_phone:
                if norm_phone == rec_phone:
                    phone_sim = 1.0

            factors.append(MatchFactorDetail(
                factor_name="Phone Number Suffix Match",
                weight=0.05,
                similarity=phone_sim,
                weighted_score=round(phone_sim * 0.05, 4),
                evidence=f"Prospect: '{norm_phone or 'N/A'}' vs Snapshot: '{rec_phone or 'N/A'}'"
            ))

            # 4.6 决策人姓名因子 (5%)
            contact_sim = 0.0
            rec_contact = rec.get("contact_name")
            if norm_contact and rec_contact:
                contact_sim = jaro_winkler_similarity(norm_contact, rec_contact)

            factors.append(MatchFactorDetail(
                factor_name="Contact Name Match",
                weight=0.05,
                similarity=contact_sim,
                weighted_score=round(contact_sim * 0.05, 4),
                evidence=f"Prospect: '{norm_contact or 'N/A'}' vs Snapshot: '{rec_contact or 'N/A'}'"
            ))

            # 综合置信度得分
            # 当根域名完全一致时，天然具备极高确定性 (>=0.92)
            if domain_sim == 1.0:
                is_exact = True
                total_score = round(min(0.99, max(0.92, 0.40 + (name_sim * 0.35) + (geo_sim * 0.15) + (email_sim * 0.10))), 4)
            elif name_sim >= 0.92 and (domain_sim >= 0.80 or geo_sim == 1.0):
                is_exact = True
                total_score = round(min(0.98, max(0.90, sum(f.weighted_score for f in factors) + 0.20)), 4)
            else:
                is_exact = False
                total_score = round(sum(f.weighted_score for f in factors), 4)

            # 计算休眠天数
            dormant_days = None
            last_followup = rec.get("last_followup")
            if last_followup:
                try:
                    followup_dt = datetime.datetime.fromisoformat(last_followup.replace("Z", "+00:00"))
                    now_dt = datetime.datetime.now(datetime.timezone.utc)
                    dormant_days = (now_dt - followup_dt).days
                except Exception:
                    dormant_days = None

            # 判定单记录匹配状态
            if is_exact or total_score >= self.EXACT_MATCH_THRESHOLD:
                if dormant_days and dormant_days > 180:
                    status = MatchStatus.S4_DORMANT_CUSTOMER
                else:
                    status = MatchStatus.S1_EXACT_MATCH
            elif total_score >= self.LIKELY_MATCH_THRESHOLD:
                status = MatchStatus.S2_LIKELY_MATCH
            elif total_score >= self.MANUAL_CHECK_THRESHOLD:
                status = MatchStatus.S5_MANUAL_CHECK
            else:
                status = MatchStatus.S6_NO_MATCH

            if total_score >= 0.30:  # 过滤完全无关记录
                candidates.append(MatchCandidate(
                    okki_customer_id=rec.get("okki_id"),
                    company_name=rec.get("raw_name"),
                    domain=rec.get("normalized_domain"),
                    country=rec.get("country"),
                    owner_name=rec.get("owner"),
                    customer_stage=rec.get("stage"),
                    last_followup_date=last_followup,
                    dormant_days=dormant_days,
                    confidence_score=total_score,
                    match_status=status,
                    factor_breakdown=factors
                ))

        # 按置信度排序
        candidates.sort(key=lambda x: x.confidence_score, reverse=True)
        best_match = candidates[0] if candidates else None

        # 5. 确定最终判定状态 (Final Verdict)
        if best_match and (best_match.match_status in [MatchStatus.S1_EXACT_MATCH, MatchStatus.S4_DORMANT_CUSTOMER] or best_match.confidence_score >= self.EXACT_MATCH_THRESHOLD):
            if best_match.dormant_days and best_match.dormant_days > 180:
                final_verdict = MatchStatus.S4_DORMANT_CUSTOMER
                recommendation = f"已在 OKKI 中存在，为存量沉睡客户 (已超过 {best_match.dormant_days} 天未跟进)，原负责人为【{best_match.owner_name or '未分配'}】，建议触发公海激活战役。"
            else:
                final_verdict = MatchStatus.S1_EXACT_MATCH
                recommendation = f"强行阻断：已在 OKKI 中完全匹配到存量客户【{best_match.company_name}】(ID: {best_match.okki_customer_id or 'N/A'})，负责人【{best_match.owner_name or '未分配'}】，阶段【{best_match.customer_stage or '未指定'}】。已关联档案并通知原跟进人。"
        elif best_match and best_match.confidence_score >= self.LIKELY_MATCH_THRESHOLD:
            final_verdict = MatchStatus.S2_LIKELY_MATCH
            recommendation = f"待决挂起：与 OKKI 客户【{best_match.company_name}】高度相似 (置信度 {int(best_match.confidence_score * 100)}%)，暂停自动触达，请业务员人工确认是否为同一企业。"
        elif freshness == SnapshotFreshness.EXPIRED:
            final_verdict = MatchStatus.S5_MANUAL_CHECK
            recommendation = "OKKI 客户快照已过期 (>14 天)，无法确保排重绝对可靠，建议在 RenWork Local 辅助核验或重新导出最新快照。"
        elif best_match and best_match.confidence_score >= self.MANUAL_CHECK_THRESHOLD:
            final_verdict = MatchStatus.S5_MANUAL_CHECK
            recommendation = f"中度相似 ({int(best_match.confidence_score * 100)}%)，缺少关键域名比对数据，请使用 Local 辅助助手在 OKKI 中手工核查。"
        else:
            final_verdict = MatchStatus.S7_VERIFIED_NEW
            recommendation = f"经与 {len(raw_records)} 条 OKKI 存量快照比对，未发现冲突，确认为全新潜在买家，放行进入采购委员会挖掘与开发序列。"

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return DeduplicationResponse(
            status="COMPLETED",
            prospect_name=request.prospect_name,
            normalized_prospect_name=norm_name,
            normalized_prospect_domain=norm_domain,
            snapshot_freshness=freshness,
            snapshot_date=snapshot_date,
            best_match=best_match,
            all_candidates=candidates[:5],  # 最多返回 Top 5 候选
            final_verdict=final_verdict,
            action_recommendation=recommendation,
            credits_deducted=1,  # 查重消耗 1 Credit
            processing_time_ms=round(elapsed_ms, 2)
        )


# 全局单例
deduplication_engine = CRMDeduplicationEngine()
