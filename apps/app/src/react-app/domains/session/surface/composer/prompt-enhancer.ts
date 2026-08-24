/**
 * RenWork Intelligent Prompt Enhancer
 * 探索用户真实意图，调用大模型与行业知识图谱，将简单输入完善成专业化、结构化、完整化的 Prompt。
 */

export interface PromptEnhanceResult {
  enhancedPrompt: string;
  inferredIntent: string;
  source: "cloud_llm" | "local_intent_engine";
}

/**
 * 意图分类与特征字典
 */
interface IntentPattern {
  name: string;
  keywords: RegExp;
  builder: (raw: string) => string;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    name: "海外买家定制开发信与破冰触达",
    keywords: /(开发信|发邮件|email|inmail|触达|破冰|写信|联系客户|联系买家|outreach|pitch)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【目标买家画像与决策场景】
1. 目标受众：海外企业采购委员会关键决策人（优先锁定经济决策人 CEO/采购总监、技术评估人 工程主管）；
2. 沟通语调：地道商务英文（Native B2B Business Tone），客观专业，杜绝廉价推销感；
3. 攻坚切入点：基于买家近期海关采购异动或供应链痛点（Why-Now 信号），建立破冰信任。

【开发序列与专业结构要求】
- 邮件主题（Subject Line）：3~5个极具吸引力、打开率高且低垃圾邮件分的主题备选；
- 正文三段式递进（3-Touch Sequence）：
  · 第1轮（Pain-Point Hook）：点明行业痛点与我们经权威认证的核心优势（如材质公差、交期稳定）；
  · 第2轮（Value & Proof）：提供具体的测试报告、出货实绩与差异化规格对比；
  · 第3轮（Risk Reversal CTA）：提供零风险试单政策（极速打样/低MOQ门槛/付款信用保障），附带清晰行动指引。

【交付输出标准】
- 输出中英双语对照版；
- 标注各轮次推荐发送时间间隔与注意事项。`
  },
  {
    name: "阶梯报价方案与商务谈判策略",
    keywords: /(报价|价格|让步|moq|fob|cif|付款方式|折扣|涨价|降价|谈判|利润|pi|形式发票|quotation)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【商业边界与测算约束】
1. 成本与利润底线：守住企业合理毛利空间，严禁无底线降价；
2. 贸易条款与交期：明确指定 Incoterms（如 FOB 宁波/深圳 或 CIF 目标港）、标准交货周期与加急交付溢价；
3. 阶梯起订量（MOQ）：设计 Good / Better / Best 三级阶梯起订方案。

【专业结构与博弈策略】
- 阶梯报价明细表（Quantity vs Unit Price vs Lead Time）；
- 谈判让步矩阵（Concession Matrix）：若客户要求降价 5%~10%，必须绑定等价交换条件（如扩大订单量、缩短账期、非核心配件改款等）；
- 风险锁价说明：包含原材料价格波动条款与报价有效期限（Validity Period）。

【交付输出标准】
- 标准英文形式发票/报价单文本摘要；
- 业务员在与客户博弈时可直接复制的 3 套应对异议话术。`
  },
  {
    name: "目标国市场准入与海关买家深度背调",
    keywords: /(海关|提单|准入|认证|ce|fda|rohs|背调|调研|市场分析|关税|hs编码|买家画像|谁在采购)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【多维度事实穿透要求】
1. 海关提单数据透视：分析目标市场近 90/180 天的真实采购频次、总柜量 (TEU)、主要供货商出口走势；
2. 实体消歧与货代清洗：剔除无船承运人 (NVOCC) 与报关行干扰，锁定真实企业买家实体与官方域名；
3. 市场准入与法规合规：严格对照目标国家强制认证标准（如欧盟 CE/RoHS、美国 FDA/CPSC、中东 SASO）与关税税率 (HS Code)。

【结构化分析框架】
- 目标市场容量与竞争定价带（Low / Mid / High Tier）；
- 采购委员会 5 大角色分工（CEO、采购、工程、质检、仓储）；
- 存量供货商替代时机分析与针对性攻坚切入点。

【交付输出标准】
- 结构化 Markdown 调研报告与数据可视化清单。`
  },
  {
    name: "产品打样送测与质检技术跟进",
    keywords: /(样品|打样|测试|质检|公差|图纸|检验|spec|sample|test report|质量)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【技术规格与交付标准】
1. 技术参数锁定：明确核心材质等级、关键尺寸公差要求、表面处理工艺与环保认证；
2. 打样周期与物流 SLA：承诺打样完成天数、国际快递单号追踪与样品保护包装标准；
3. 测试评估协议：明确客户测试周期（7~14天）、测试项目（耐用度/耐压/拉力等）与反馈对接人。

【专业跟进序列】
- 样品寄出通知函（附带发货照片、实测参数表与快递单号）；
- 样品签收后第 3 天：使用指南与测试要点提示；
- 样品签收后第 7 天：技术评估结果催办与小批量试产（Trial Order）转换方案。

【交付输出标准】
- 标准样品跟进协议文档与专业商务跟进邮件模板。`
  },
  {
    name: "海外社媒矩阵与营销短视频脚本",
    keywords: /(社媒|facebook|instagram|linkedin|tiktok|短视频|脚本|文案|视频号|发帖|post|video)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【传播定位与受众偏好】
1. 目标渠道：海外主流 B2B 社交平台（LinkedIn / Facebook / TikTok / YouTube Shorts）；
2. 视觉与节奏：前 3 秒黄金抓人 Hook、中间 15 秒展示产品解决的核心痛点、结尾 5 秒强力引导转化；
3. 真实性底线：基于工厂真实实拍、生产线质检或实际使用场景，杜绝虚假特效。

【分镜脚本与内容结构】
- 镜头号（Shot #）+ 画面景别（镜头机位与动作）+ 画面描述（B-roll 细节）；
- 口播旁白（中英双语台词）+ 屏幕字幕重点；
- 背景音乐（BGM 情绪节奏）与音效设计（SFX）；
- 多语言社交发帖文案（Post Copy）+ 高转化行业 Hashtag 标签矩阵。

【交付输出标准】
- 出版级分镜脚本表格 + 社交平台一键发布文案。`
  },
  {
    name: "老客复购激活与睡眠客户召回",
    keywords: /(老客户|复购|唤醒|召回|返单|再次采购|睡眠|流失|跟进老客)/i,
    builder: (raw: string) => `【核心任务目标】
${raw}

【客户全生命周期背景】
1. 历史交易分析：基于客户历史采购品类、采购周期（如每季度/半年）与合作满意度；
2. 唤醒触发由头（Why-Now）：新一季产品升级、上游原材料短期成本优势、专属产能排期预留；
3. 专属优惠组合：老客专属折扣、免费升级增值配件或更宽松的账期支持。

【分阶段唤醒策略】
- 第一轮（温情回顾）：感谢长期合作，分享近期行业趋势与我们最新通过的技术认证；
- 第二轮（价值诱因）：提供符合其主营方向的新品测试样品或专享预定优惠；
- 第三轮（最后确认）：锁定产能排期有效期的温馨催告。

【交付输出标准】
- 结构化老客维护跟进计划与定制化邮件序列。`
  }
];

/**
 * 增强 Prompt 主执行函数
 */
export async function enhancePrompt(rawPrompt: string): Promise<PromptEnhanceResult> {
  const trimmed = rawPrompt.trim();
  if (!trimmed) {
    return {
      enhancedPrompt: `【核心任务目标】
请作为资深外贸数字化增长专家，为我深入分析海外目标市场的准入特征与买家画像，并输出结构化的高转化实操攻坚方案。

【专业要求与执行标准】
1. 结合外贸真实业务闭环与全生命周期协同，严格杜绝虚构编造；
2. 突出核心竞争优势、合规认证与差异化价值主张；
3. 输出逻辑清晰、可直接落地执行的步骤、话术或结构化数据清单。`,
      inferredIntent: "通用外贸增长与市场分析",
      source: "local_intent_engine"
    };
  }

  // 1. 尝试调用云端 LLM 深度意图探索服务 (Cloud AI Brain)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

    const response = await fetch("https://rrenn.com/api/v1/intent/enhance-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_prompt: trimmed }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.enhanced_prompt) {
        return {
          enhancedPrompt: data.enhanced_prompt,
          inferredIntent: data.inferred_intent || "云端大模型意图提炼",
          source: "cloud_llm"
        };
      }
    }
  } catch {
    // Graceful fallback to local intent engine
  }

  // 2. 本地智能意图图谱探索与结构化推导 (Local Deterministic Engine)
  for (const pattern of INTENT_PATTERNS) {
    if (pattern.keywords.test(trimmed)) {
      return {
        enhancedPrompt: pattern.builder(trimmed),
        inferredIntent: pattern.name,
        source: "local_intent_engine"
      };
    }
  }

  // 3. 通用复杂任务结构化增强
  const defaultEnhanced = `【核心任务目标】
${trimmed}

【执行标准与上下文要求】
1. 目标明确：深入探索该任务背后的商业意图与最终落地场景；
2. 事实为基：严格结合真实业务事实、技术规范与行业标准，拒绝泛泛而谈；
3. 结构完整：输出条理清晰、步骤完整、可直接执行的交付结果（含关键注意点与备选方案）。

【输出格式】
- 按照优先级清晰排版，使用结构化列表与加粗重点呈现。`;

  return {
    enhancedPrompt: defaultEnhanced,
    inferredIntent: "通用任务深度结构化解析",
    source: "local_intent_engine"
  };
}
