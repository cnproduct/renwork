export interface EntityMatchCandidate {
  id?: string;
  name: string;
  normalizedDomain?: string | null;
  registrationNumber?: string | null;
  dunsNumber?: string | null;
  verifiedEmail?: string | null;
  country?: string | null;
  city?: string | null;
  phone?: string | null;
  contactName?: string | null;
  hsCodes?: string[];
  isSubsidiary?: boolean;
}

export interface EntityMatchScoreBreakdown {
  totalScore: number; // M in [0, 1]
  hasConflict: boolean;
  conflictReason?: string;
  matchedFeatures: Array<{ feature: string; weight: number; detail: string }>;
  decision: "auto_merge" | "review_required" | "create_new";
}

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "163.com",
  "126.com",
  "qq.com",
  "foxmail.com",
  "sina.com",
  "aliyun.com",
  "icloud.com",
]);

/**
 * 字符串 Levenshtein 相似度 [0, 1]
 */
export function stringSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  if (longer.length === 0) return 1.0;
  const costs: number[] = [];
  for (let i = 0; i <= longer.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= shorter.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1]!;
        if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]!) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[shorter.length] = lastValue;
  }
  return (longer.length - costs[shorter.length]!) / longer.length;
}

/**
 * 多源实体解析与置信度匹配矩阵 (规范 4.2)
 */
export function computeEntityMergeScore(
  source: EntityMatchCandidate,
  target: EntityMatchCandidate,
): EntityMatchScoreBreakdown {
  const matchedFeatures: Array<{ feature: string; weight: number; detail: string }> = [];
  let score = 0;

  // 1. 冲突特征检查：母子公司关系禁止合并
  if (source.isSubsidiary || target.isSubsidiary) {
    return {
      totalScore: 0,
      hasConflict: true,
      conflictReason: "实体间存在明确母子公司/分支机构组织关系，禁止合并，建立关联图谱",
      matchedFeatures: [],
      decision: "create_new",
    };
  }

  // 2. 冲突特征检查：国家代码相悖阻断自动合并
  let countryConflict = false;
  if (source.country && target.country && source.country.trim().toUpperCase() !== target.country.trim().toUpperCase()) {
    countryConflict = true;
  }

  // 3. 强特征：法人注册号/DUNS (+0.80)
  const reg1 = source.registrationNumber?.replace(/[\s-]/g, "") || source.dunsNumber?.replace(/[\s-]/g, "");
  const reg2 = target.registrationNumber?.replace(/[\s-]/g, "") || target.dunsNumber?.replace(/[\s-]/g, "");
  if (reg1 && reg2 && reg1 === reg2) {
    matchedFeatures.push({ feature: "registration_or_duns", weight: 0.80, detail: `注册号/DUNS 完全一致 (${reg1})` });
    score += 0.80;
  }

  // 4. 强特征：根域名一致 (+0.60, 排除公共邮箱)
  const d1 = source.normalizedDomain?.trim().toLowerCase();
  const d2 = target.normalizedDomain?.trim().toLowerCase();
  if (d1 && d2 && d1 === d2 && !PUBLIC_EMAIL_DOMAINS.has(d1)) {
    matchedFeatures.push({ feature: "root_domain", weight: 0.60, detail: `企业官方根域名一致 (${d1})` });
    score += 0.60;
  }

  // 5. 强特征：验证企业邮箱一致 (+0.50)
  const e1 = source.verifiedEmail?.trim().toLowerCase();
  const e2 = target.verifiedEmail?.trim().toLowerCase();
  if (e1 && e2 && e1 === e2) {
    const domain = e1.split("@")[1];
    if (domain && !PUBLIC_EMAIL_DOMAINS.has(domain)) {
      matchedFeatures.push({ feature: "verified_email", weight: 0.50, detail: `企业验证主邮箱一致 (${e1})` });
      score += 0.50;
    }
  }

  // 6. 中特征：企业名称相似度 (+0.30)
  const cleanName1 = source.name.toLowerCase().replace(/(inc|corp|ltd|co|llc|gmbh|sa|srl|pty|\.|\,)/g, "").trim();
  const cleanName2 = target.name.toLowerCase().replace(/(inc|corp|ltd|co|llc|gmbh|sa|srl|pty|\.|\,)/g, "").trim();
  const nameSim = stringSimilarity(cleanName1, cleanName2);
  if (nameSim >= 0.92) {
    matchedFeatures.push({ feature: "normalized_name", weight: 0.30, detail: `规范化企业名称相似度 ${(nameSim * 100).toFixed(1)}%` });
    score += 0.30;
  }

  // 7. 中特征：电话 E.164 一致 (+0.20)
  const p1 = source.phone?.replace(/[\s\-\(\)\+]/g, "");
  const p2 = target.phone?.replace(/[\s\-\(\)\+]/g, "");
  if (p1 && p2 && p1.length >= 7 && p1 === p2) {
    matchedFeatures.push({ feature: "phone_e164", weight: 0.20, detail: `标准化电话号码完全一致 (${p1})` });
    score += 0.20;
  }

  // 8. 弱特征：联系人姓名相似度 (+0.10)
  if (source.contactName && target.contactName) {
    const contactSim = stringSimilarity(source.contactName.toLowerCase(), target.contactName.toLowerCase());
    if (contactSim >= 0.90) {
      matchedFeatures.push({ feature: "contact_name", weight: 0.10, detail: `采购关键联系人姓名相似度 ${(contactSim * 100).toFixed(1)}%` });
      score += 0.10;
    }
  }

  // 9. 弱特征：采购品类/HS 编码重合 (+0.05)
  if (source.hsCodes && target.hsCodes) {
    const set1 = new Set(source.hsCodes.map((c) => c.slice(0, 4)));
    const overlap = target.hsCodes.filter((c) => set1.has(c.slice(0, 4)));
    if (overlap.length > 0) {
      matchedFeatures.push({ feature: "hs_code_overlap", weight: 0.05, detail: `目标 HS 编码前4位重合: ${overlap.join(", ")}` });
      score += 0.05;
    }
  }

  const finalScore = Math.min(1.0, Number(score.toFixed(4)));

  if (countryConflict) {
    return {
      totalScore: finalScore,
      hasConflict: true,
      conflictReason: `国家代码相悖 (${source.country} vs ${target.country})，阻断自动合并，转人工审核`,
      matchedFeatures,
      decision: "review_required",
    };
  }

  let decision: "auto_merge" | "review_required" | "create_new" = "create_new";
  if (finalScore >= 0.98) {
    decision = "auto_merge";
  } else if (finalScore >= 0.80) {
    decision = "review_required";
  }

  return {
    totalScore: finalScore,
    hasConflict: false,
    matchedFeatures,
    decision,
  };
}
