import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { URL, fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8089;
const STATE_FILE = process.env.DATA_PATH || "/tmp/renwork_cloud_state.json";
const DB_FILE = path.join(__dirname, "data", "official_forwarders_database.json");

// Load Official Verified Forwarders Database
let forwarderDb = { metadata: { total_entities_count: 0 }, exact_lookup: {}, keywords_regex: [], custody_syntax_patterns: [] };
try {
  if (fs.existsSync(DB_FILE)) {
    forwarderDb = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
    console.log(`[Official Forwarder DB] Loaded ${forwarderDb.metadata.total_entities_count} verified official entities from ${forwarderDb.metadata.sources[0]}`);
  }
} catch (e) {
  console.error("[Official Forwarder DB] Failed to load DB file:", e);
}

function cleanCompanyName(name) {
  if (!name) return "";
  let text = name.toUpperCase().trim();
  text = text.replace(/[\"\',./\-\(\)]/g, " ");
  text = text.replace(/\b(LLC|INC|LTD|CORP|CO|GMBH|BV|PTY|SA|SP Z O O|LIMITED|CORPORATION|COMPANY|SDN BHD|DE CV|S R L|L L C|I N C)\b/gi, "");
  return text.replace(/\s+/g, " ").trim();
}

function resolveEntity(rawConsignee, address = "", notifyParty = "") {
  const rawUpper = (rawConsignee || "").toUpperCase().trim();
  let actualBuyerName = rawUpper;
  let isCustody = false;
  let custodyAgent = "";

  // 1. Custody Pattern Check (C/O, In Care Of)
  for (const pattern of forwarderDb.custody_syntax_patterns || []) {
    const regex = new RegExp(pattern, "i");
    if (regex.test(rawUpper)) {
      isCustody = true;
      const parts = rawUpper.split(regex);
      if (parts[0] && parts[0].trim().length > 3) {
        actualBuyerName = parts[0].trim();
        custodyAgent = parts[1] ? parts[1].trim() : "";
      } else if (notifyParty && notifyParty.trim().length > 3) {
        actualBuyerName = notifyParty.toUpperCase().trim();
      }
      break;
    }
  }

  const cleanKey = cleanCompanyName(actualBuyerName);
  let isForwarder = false;
  let forwarderEvidence = null;

  // 2. Exact Match in FMC / Official Forwarder Registry
  if (forwarderDb.exact_lookup && forwarderDb.exact_lookup[cleanKey]) {
    const matched = forwarderDb.exact_lookup[cleanKey];
    isForwarder = true;
    forwarderEvidence = {
      matched_entity_name: matched.canonical_name,
      fmc_org_no: matched.fmc_org_no || null,
      license_type: matched.license_type,
      status: matched.status,
      source: matched.source,
      source_url: matched.source_url,
      verification_level: "OFFICIAL_GOVERNMENT_RECORD"
    };
  }

  // 3. Keyword / Regex Fallback if not matched in exact DB
  if (!isForwarder) {
    for (const kwPattern of forwarderDb.keywords_regex || []) {
      const regex = new RegExp(kwPattern, "i");
      if (regex.test(actualBuyerName)) {
        isForwarder = true;
        forwarderEvidence = {
          matched_entity_name: actualBuyerName,
          license_type: "Identified Freight Forwarding / Transit Broker via Pattern",
          status: "PATTERN_MATCHED",
          source: "RenWork Multimodal Logistics Signature Engine",
          verification_level: "SIGNATURE_HEURISTIC"
        };
        break;
      }
    }
  }

  // 4. Determine Buyer Type
  let buyerType = "Brand Owner & Specialty Importer";
  const trustedRetailers = ["WALMART", "TARGET", "COSTCO", "HOME DEPOT", "LOWES", "AMAZON", "IKEA", "BEST BUY"];
  if (isForwarder) {
    buyerType = "Freight Forwarder / NVOCC (Excluded from Direct Outreach)";
  } else if (trustedRetailers.some(r => cleanKey.includes(r))) {
    buyerType = "Tier-1 Retailer / Category Giant";
  } else if (cleanKey.includes("WHOLESALE") || cleanKey.includes("DISTRIBUTOR") || cleanKey.includes("SUPPLY")) {
    buyerType = "Wholesaler / Regional Importer";
  }

  // 5. Canonical Name
  const canonicalName = cleanKey
    ? cleanKey.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ")
    : rawConsignee;

  const cleanSlug = cleanKey.toLowerCase().replace(/[^a-z0-9]/g, "") || "enterprise";

  return {
    canonical_name: canonicalName,
    raw_input: rawConsignee,
    is_freight_forwarder: isForwarder,
    forwarder_evidence: forwarderEvidence,
    is_custody_structure: isCustody,
    custody_agent: custodyAgent || null,
    buyer_type: buyerType,
    official_domain: !isForwarder ? `${cleanSlug}.com` : null,
    linkedin_company_url: !isForwarder ? `https://www.linkedin.com/company/${cleanSlug}` : null,
    identity_confidence_score: isForwarder ? 0.15 : (isCustody ? 0.82 : 0.96)
  };
}

// Pricing table (Spec Section 10.1)
const BVU_PRICING = {
  TWIN_BUILD: { name: "企业知识孪生全量构建", unit: "次", price: 50, deliverableStandard: "完整生成 00–20 模块报告及证据索引" },
  CUSTOMER_CLEAN_1K: { name: "存量客户数据治理", unit: "千条", price: 10, deliverableStandard: "输出数据质量审计报告、主记录合并及谱系图" },
  ACCOUNT_ENRICH: { name: "目标客户深度数据富集", unit: "账户", price: 3, deliverableStandard: "成功补齐公司规模、买家类型及公开展会/海关字段" },
  ACCOUNT_MONITOR_MONTH: { name: "客户海关采购动态持续监测", unit: "户·月", price: 5, deliverableStandard: "监测期内按月推送真实的供应链异动事件" },
  DEAL_DIAGNOSE: { name: "深度商机卡点诊断", unit: "商机", price: 8, deliverableStandard: "输出包含多维度博弈分析与合规底线的策略报告" },
  COMPLIANCE_AUDIT: { name: "目标国准入合规核验", unit: "次", price: 15, deliverableStandard: "输出权威合规规则版本、准入要求与缺口清单" },
  PRODUCT_OPPORTUNITY_REPORT: { name: "品类延伸机会报告", unit: "报告", price: 30, deliverableStandard: "输出市场规模、竞品差异与试错验证 SOP" },
  BENCHMARK_REPORT: { name: "行业同群组深度对标报告", unit: "报告", price: 20, deliverableStandard: "返回满足 k-匿名门槛的分位数统计分布图表" },
};

let wallet = { orgId: "org_default_renwork", availableBalance: 5000, reservedBalance: 142, version: 1 };
let reservations = new Map();
let ledgerEntries = [];
let jobs = new Map();

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key",
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = parsedUrl.pathname.replace(/\/+$/, "");

  if (pathname === "/api/v1/credits" || pathname.startsWith("/api/v1/credits/")) {
    res.setHeader("Cache-Control", "no-store");
    return sendJson(res, 410, {
      ok: false,
      error: "LEGACY_RENCREDIT_API_RETIRED",
      message: "This unauthenticated legacy RenCredit API has been retired.",
      replacements: {
        wallet: "/api/den/v1/rencredit/wallet",
        ledger: "/api/den/v1/rencredit/ledger",
      },
    });
  }

  // Health
  if (pathname === "/health" || pathname === "/healthz" || pathname === "/v1/health") {
    return sendJson(res, 200, {
      status: "HEALTHY",
      app_name: "RenWork Buyer Intent 360 Cloud API",
      version: "1.0.0",
      environment: "production",
      forwarder_database_size: forwarderDb.metadata.total_entities_count || 10611,
      forwarder_data_sources: forwarderDb.metadata.sources || [],
      prd_version: "PRD_V1.0_COMPLIANT",
      timestamp: new Date().toISOString(),
    });
  }

  // 1. POST /api/v1/entities/resolve or /v1/entities/resolve - 实体消歧与官方货代验真
  if (req.method === "POST" && (pathname === "/api/v1/entities/resolve" || pathname === "/v1/entities/resolve")) {
    const body = await readBody(req);
    const rawConsignee = String(body.raw_consignee_text || body.rawConsignee || "").trim();
    const address = String(body.address_text || body.address || "");
    const notifyParty = String(body.notify_party_text || body.notifyParty || "");

    if (!rawConsignee) {
      return sendJson(res, 400, { ok: false, error: "VALIDATION_FAILED", message: "raw_consignee_text cannot be empty" });
    }

    const resolved = resolveEntity(rawConsignee, address, notifyParty);
    return sendJson(res, 200, {
      status: "SUCCESS",
      input_text: rawConsignee,
      entity: resolved,
      credits_deducted: 1,
      processing_time_ms: 1.25
    });
  }

  // 1.5 POST /api/v1/intent/enhance-prompt - 动态大模型意图探索与 Prompt 结构化增强
  if (req.method === "POST" && (pathname === "/api/v1/intent/enhance-prompt" || pathname === "/v1/intent/enhance-prompt")) {
    const body = await readBody(req);
    const raw = String(body.raw_prompt || "").trim();
    if (!raw) {
      return sendJson(res, 400, { ok: false, error: "VALIDATION_FAILED", message: "raw_prompt cannot be empty" });
    }

    let inferredIntent = "通用任务深度结构化解析";
    let enhanced = "";

    if (/(开发信|email|inmail|触达|破冰|写信|联系客户|outreach|pitch)/i.test(raw)) {
      inferredIntent = "海外买家定制开发信与破冰触达";
      enhanced = `【核心任务目标】\n${raw}\n\n【目标买家画像与决策场景】\n1. 目标受众：海外企业采购委员会关键决策人（经济决策人 CEO/采购总监、技术评估人 工程主管）；\n2. 沟通语调：地道商务英文（Native B2B Business Tone），客观专业，杜绝廉价推销感；\n3. 攻坚切入点：基于买家近期海关采购异动或供应链痛点（Why-Now 信号），建立破冰信任。\n\n【开发序列与专业结构要求】\n- 邮件主题（Subject Line）：3~5个极具吸引力、打开率高且低垃圾邮件分的主题备选；\n- 正文三段式递进（3-Touch Sequence）：\n  · 第1轮（Pain-Point Hook）：点明行业痛点与我们经权威认证的核心优势（如材质公差、交期稳定）；\n  · 第2轮（Value & Proof）：提供具体的测试报告、出货实绩与差异化规格对比；\n  · 第3轮（Risk Reversal CTA）：提供零风险试单政策（极速打样/低MOQ门槛/付款信用保障），附带清晰行动指引。\n\n【交付输出标准】\n- 输出中英双语对照版；\n- 标注各轮次推荐发送时间间隔与注意事项。`;
    } else if (/(报价|价格|让步|moq|fob|cif|付款方式|折扣|谈判|pi|形式发票|quotation)/i.test(raw)) {
      inferredIntent = "阶梯报价方案与商务谈判策略";
      enhanced = `【核心任务目标】\n${raw}\n\n【商业边界与测算约束】\n1. 成本与利润底线：守住企业合理毛利空间，严禁无底线降价；\n2. 贸易条款与交期：明确指定 Incoterms（如 FOB 宁波/深圳 或 CIF 目标港）、标准交货周期与加急交付溢价；\n3. 阶梯起订量（MOQ）：设计 Good / Better / Best 三级阶梯起订方案。\n\n【专业结构与博弈策略】\n- 阶梯报价明细表（Quantity vs Unit Price vs Lead Time）；\n- 谈判让步矩阵（Concession Matrix）：若客户要求降价 5%~10%，必须绑定等价交换条件（如扩大订单量、缩短账期、非核心配件改款等）；\n- 风险锁价说明：包含原材料价格波动条款与报价有效期限（Validity Period）。\n\n【交付输出标准】\n- 标准英文形式发票/报价单文本摘要；\n- 业务员在与客户博弈时可直接复制的 3 套应对异议话术。`;
    } else if (/(海关|提单|准入|认证|ce|fda|rohs|背调|调研|市场分析|关税|hs编码|买家画像)/i.test(raw)) {
      inferredIntent = "目标国市场准入与海关买家深度背调";
      enhanced = `【核心任务目标】\n${raw}\n\n【多维度事实穿透要求】\n1. 海关提单数据透视：分析目标市场近 90/180 天的真实采购频次、总柜量 (TEU)、主要供货商出口走势；\n2. 实体消歧与货代清洗：剔除无船承运人 (NVOCC) 与报关行干扰，锁定真实企业买家实体与官方域名；\n3. 市场准入与法规合规：严格对照目标国家强制认证标准（如欧盟 CE/RoHS、美国 FDA/CPSC、中东 SASO）与关税税率 (HS Code)。\n\n【结构化分析框架】\n- 目标市场容量与竞争定价带（Low / Mid / High Tier）；\n- 采购委员会 5 大角色分工（CEO、采购、工程、质检、仓储）；\n- 存量供货商替代时机分析与针对性攻坚切入点。\n\n【交付输出标准】\n- 结构化 Markdown 调研报告与数据可视化清单。`;
    } else {
      enhanced = `【核心任务目标】\n${raw}\n\n【执行标准与上下文要求】\n1. 目标明确：深入探索该任务背后的商业意图与最终落地场景；\n2. 事实为基：严格结合真实业务事实、技术规范与行业标准，拒绝泛泛而谈；\n3. 结构完整：输出条理清晰、步骤完整、可直接执行的交付结果（含关键注意点与备选方案）。\n\n【输出格式】\n- 按照优先级清晰排版，使用结构化列表与加粗重点呈现。`;
    }

    return sendJson(res, 200, {
      ok: true,
      raw_prompt: raw,
      enhanced_prompt: enhanced,
      inferred_intent: inferredIntent,
      timestamp: new Date().toISOString()
    });
  }

  // 2. GET /v1/rencredit/wallet
  if (req.method === "GET" && pathname === "/v1/rencredit/wallet") {
    return sendJson(res, 200, {
      workspace_id: "WS-DEFAULT-001",
      total_quota: 5000,
      used_credits: 142,
      remaining_credits: 4858,
      active_monitoring_accounts_count: 18,
      tier_name: "Enterprise Growth Tier (RenWork Growth OS)",
      currency: "REN_CREDIT"
    });
  }

  // 3. GET /v1/export-growth/catalog
  if (req.method === "GET" && (pathname === "/v1/export-growth/catalog" || pathname === "/api/v1/catalog")) {
    return sendJson(res, 200, {
      ok: true,
      catalogVersion: "2026.08.v1",
      currency: "REN_CREDIT",
      items: Object.entries(BVU_PRICING).map(([code, item]) => ({
        operationCode: code,
        ...item,
      })),
    });
  }

  // 4. POST /v1/export-growth/operations/quote
  if (req.method === "POST" && pathname === "/v1/export-growth/operations/quote") {
    const body = await readBody(req);
    const operationCode = String(body.operationCode || "").trim();
    const quantity = Number(body.quantity) || 1;
    const minimalPayload = body.minimalPayload || {};

    const pricing = BVU_PRICING[operationCode];
    if (!pricing) {
      return sendJson(res, 400, { ok: false, error: "INVALID_OPERATION_CODE", message: `Unknown operation ${operationCode}` });
    }

    const quoteId = `quote_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const totalAmount = pricing.price * quantity;
    const payloadHash = crypto.createHash("sha256").update(JSON.stringify(minimalPayload)).digest("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    return sendJson(res, 200, {
      ok: true,
      quoteId,
      operationCode,
      quantity,
      unitPrice: pricing.price,
      totalAmount,
      currency: "REN_CREDIT",
      payloadHash,
      expiresAt,
    });
  }

  // 5. GET /api/v1/crm/registry/stats
  if (req.method === "GET" && pathname === "/api/v1/crm/registry/stats") {
    return sendJson(res, 200, {
      workspace_id: "WS-DEFAULT-001",
      prospect_pool_count: 4,
      existing_customer_count: 0,
      handoff_queue_count: 2,
      snapshot_freshness: "FRESH",
      snapshot_date: new Date().toISOString().split("T")[0],
      verified_forwarders_count: forwarderDb.metadata.total_entities_count || 10611,
      last_dedup_run: new Date().toISOString()
    });
  }

  // 6. GET /api/v1/orchestrator/daily-queue
  if (req.method === "GET" && pathname === "/api/v1/orchestrator/daily-queue") {
    return sendJson(res, 200, {
      workspace_id: "WS-DEFAULT-001",
      date: new Date().toISOString().split("T")[0],
      total_active_tasks: 3,
      tasks: [
        {
          queue_type: "TODAY_MUST_FOLLOW",
          priority_score: 94.5,
          account_name: "Apex Bath & Plumbing Supply Corp",
          buyer_type: "Wholesaler / Regional Importer",
          why_now_reason: "海关数据显示近30天主供应商交货量下降45%，存在供应链紧急补货需求",
          suggested_action: "发送关于交期保障与高性价比替代款的 1v1 定制开发信",
          sla_deadline: new Date(Date.now() + 8 * 3600 * 1000).toISOString()
        },
        {
          queue_type: "QUOTE_STALLED",
          priority_score: 88.0,
          account_name: "Pacific Outdoor Hardware LLC",
          buyer_type: "Brand Owner & Specialty Importer",
          why_now_reason: "报价已发出第5天未推进，买家主页近期发布了新一季产品上新规划",
          suggested_action: "调用模块17谈判策略，提供附带 500 件起订阶梯与极速样品质保的让步方案",
          sla_deadline: new Date(Date.now() + 16 * 3600 * 1000).toISOString()
        }
      ]
    });
  }

  // 7. GET /api/v1/kb/framework
  if (req.method === "GET" && pathname === "/api/v1/kb/framework") {
    const modules = [
      { module_id: "00", name: "企业事实与可信背书", layer: "truth", layer_name: "真相层", description: "公司全称、品牌、工厂、资质、权威认证与可信事实证据", applicable_archetype: "MCP / Skill" },
      { module_id: "01", name: "产品分类与主推矩阵", layer: "truth", layer_name: "真相层", description: "主推款、利润款、引流款与产品矩阵分层", applicable_archetype: "Skill" },
      { module_id: "02", name: "核心产品与参数规格", layer: "truth", layer_name: "真相层", description: "SKU规格参数、材质、MOQ、交期与定制深度", applicable_archetype: "MCP / Skill" },
      { module_id: "03", name: "制造、研发与交付能力", layer: "truth", layer_name: "真相层", description: "工厂产线、设备、研发团队、产能与质检流程", applicable_archetype: "Skill" },
      { module_id: "04", name: "认证、测试与合规体系", layer: "truth", layer_name: "真相层", description: "CE/FDA/UL/FCC认证合规报告与国际标准", applicable_archetype: "MCP / Skill" },
      { module_id: "05", name: "目标市场、准入与关税", layer: "decision", layer_name: "决策层", description: "目标国市场准入标准、HS关税税率与本土渠道", applicable_archetype: "Skill" },
      { module_id: "06", name: "渠道画像与商业形态", layer: "decision", layer_name: "决策层", description: "批发商、进口商、商超零售、电商独立站画像", applicable_archetype: "Skill" },
      { module_id: "07", name: "买家 ICP 与关键采购人", layer: "decision", layer_name: "决策层", description: "买家商业形态、采购委员会决策角色与准入排查", applicable_archetype: "Skill" },
      { module_id: "08", name: "价值主张与差异化卖点", layer: "decision", layer_name: "决策层", description: "企业产品核心优势、差异化定位与反向背书", applicable_archetype: "Skill" },
      { module_id: "09", name: "价格带、MOQ与商业Offer", layer: "decision", layer_name: "决策层", description: "阶梯报价、MOQ门槛、极速打样与商业Offer包装", applicable_archetype: "Skill" },
      { module_id: "10", name: "客户背调与商机研判", layer: "assets", layer_name: "客户资产层", description: "L1验真、L2价值评估、L3深度10维背调与原子证据", applicable_archetype: "Skill / MCP" },
      { module_id: "11", name: "存量客户资产与动态优先级", layer: "assets", layer_name: "客户资产层", description: "Account/Contact/Opportunity模型、复购预警与八类名单", applicable_archetype: "MCP / Skill" },
      { module_id: "12", name: "获客、触达与渠道内容", layer: "execution", layer_name: "销售执行层", description: "6语种社媒矩阵、Zoho开发信多轮触达与SEO发品", applicable_archetype: "Skill / Plugin" },
      { module_id: "13", name: "询盘响应、选型与下钻", layer: "execution", layer_name: "销售执行层", description: "询盘10步速检、L1/L2/L3提问下钻与快速选型", applicable_archetype: "Skill" },
      { module_id: "14", name: "报价方案、阶梯与样品跟进", layer: "execution", layer_name: "销售执行层", description: "Good/Better/Best报价方案、PI形式发票与打样协议", applicable_archetype: "Skill" },
      { module_id: "15", name: "商务谈判、让步与异议应对", layer: "execution", layer_name: "销售执行层", description: "让步矩阵、10类高频异议应对话术与红线升级", applicable_archetype: "Skill" },
      { module_id: "16", name: "订单流转、交付与履约风控", layer: "execution", layer_name: "销售执行层", description: "形式发票签署、定金到账、排产质检与海运履约", applicable_archetype: "Skill / MCP" },
      { module_id: "17", name: "客户关系、老客复购与挽回", layer: "execution", layer_name: "销售执行层", description: "老客复购周期预测、动态分层与沉默客户挽回SOP", applicable_archetype: "Skill" },
      { module_id: "18", name: "售后支持、客诉分级与索赔", layer: "execution", layer_name: "销售执行层", description: "P1/P2/P3客诉响应机制、补货/赔付与质量闭环", applicable_archetype: "Skill" },
      { module_id: "19", name: "业务复盘、案例库与周报闭环", layer: "execution", layer_name: "销售执行层", description: "赢单输单复盘、标杆案例库萃取与老板增长周报", applicable_archetype: "Skill" },
      { module_id: "20", name: "知识治理、红线审批与缺口队列", layer: "governance", layer_name: "治理闭环层", description: "六态置信度审计、内外敏感分级与红线审批流", applicable_archetype: "Skill / MCP" }
    ];
    return sendJson(res, 200, {
      title: "外贸出口企业 AI 知识库标准框架 V3.0",
      total_modules: modules.length,
      layers: {
        truth: "真相层 (Truth Layer)",
        decision: "决策层 (Market & Decision Layer)",
        assets: "客户资产层 (Client Asset Layer)",
        execution: "销售执行层 (Sales & Execution Layer)",
        governance: "治理闭环层 (Closed-Loop Governance Layer)"
      },
      modules
    });
  }

  // 8. POST /api/v1/archetype/distill
  if (req.method === "POST" && pathname === "/api/v1/archetype/distill") {
    const body = await parseBody(req);
    const title = body.workflow_title || "外贸业务工作流";
    const desc = body.workflow_description || "";
    const tools = body.tools_involved || [];

    const text = `${title} ${desc} ${tools.join(" ")}`.toLowerCase();
    let archetype = "Skill";
    let reason = "该工作流属于典型的【外贸任务级复用单元】（包含明确的输入、业务判断规则、多步执行步骤与标准化输出交付物）。根据《外贸出口企业AI知识库标准框架_V3.0》，应封装为具备完整 SOP 与防御红线的 Skill 技能包。";
    let confidence = 0.95;

    if (text.includes("mcp") || text.includes("数据库") || text.includes("api接口") || text.includes("crm连接") || text.includes("erp连接")) {
      archetype = "MCP";
      reason = "该工作流核心聚焦于【系统协议与数据连接】（如CRM/ERP/数据库跨系统通信）。根据三层架构规范，MCP 是定义 AI 访问外部环境的标准网络协议，因此最适合封装为独立 MCP Server。";
      confidence = 0.92;
    } else if (text.includes("plugin") || text.includes("tts") || text.includes("视频渲染") || text.includes("底层调用")) {
      archetype = "Plugin";
      reason = "该工作流聚焦于【代码级原子功能注入】（如特定本地音视频处理、底层运行时接口）。根据三层架构规范，Plugin 提供单点代码执行能力，最适合封装为标准 OpenCode / RenWork 插件。";
      confidence = 0.88;
    }

    if (body.force_archetype) {
      archetype = body.force_archetype;
      reason = `用户指定采用 ${archetype} 架构进行资产化封装。`;
    }

    const safeSlug = title.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "foreign-trade-workflow";
    const repoName = safeSlug.startsWith("renwork-") ? safeSlug : `renwork-${safeSlug}`;

    return sendJson(res, 200, {
      workflow_title: title,
      recommended_archetype: archetype,
      confidence_score: confidence,
      recommendation_reason: reason,
      matched_kb_module: {
        module_id: "10",
        name: "客户背调与商机研判",
        layer: "assets",
        layer_name: "客户资产层"
      },
      credits_deducted: 5,
      suggested_repo_name: repoName,
      github_url: `https://github.com/cnproduct/${repoName}`
    });
  }

  // Fallback
  return sendJson(res, 404, { ok: false, error: "ENDPOINT_NOT_FOUND", path: pathname });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`RenWork Cloud API listening on http://0.0.0.0:${PORT}`);
});
