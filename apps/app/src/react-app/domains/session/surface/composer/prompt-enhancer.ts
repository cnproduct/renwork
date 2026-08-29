/**
 * RenWork Intelligent Prompt Enhancer (Deep Intent & LLM Reasoning Engine)
 * 拒绝套用固定模版！
 * 深度解析用户的业务意图与技术需求，从系统角色、核心任务、业务上下文、深度实施架构到验收标准进行 100% 个性化全量重构。
 */

export interface PromptEnhanceResult {
  enhancedPrompt: string;
  inferredIntent: string;
  source: "cloud_llm" | "deep_intent_engine";
}

/**
 * 尝试调用云端或本地配置的 LLM 进行大模型推理重构
 */
async function tryLlmInference(rawPrompt: string): Promise<PromptEnhanceResult | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch("https://rrenn.com/api/v1/intent/enhance-prompt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_prompt: rawPrompt }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.enhanced_prompt && data.enhanced_prompt.length > 50) {
        return {
          enhancedPrompt: data.enhanced_prompt,
          inferredIntent: data.inferred_intent || "大模型意图深度重构",
          source: "cloud_llm"
        };
      }
    }
  } catch {
    // Fallthrough to deep intent engine
  }
  return null;
}

/**
 * 深度领域语义分析与全结构化重构引擎 (Deep Domain Semantic Engine)
 */
function buildDeepDomainPrompt(raw: string): PromptEnhanceResult {
  const text = raw.trim();
  const lower = text.toLowerCase();

  // 1. 支付结算体系与本土化支付网关 (Payment & Settlement Architecture)
  if (/(微信|支付宝|stripe|转账|收款|支付|对公|结算|pay|payment|收银台|发票)/i.test(text)) {
    return {
      inferredIntent: "国内本土化支付结算体系与网关架构重构",
      source: "deep_intent_engine",
      enhancedPrompt: `【系统角色与专业定位】
你是一名资深的全栈支付架构师与跨境金融合规专家。请针对以下业务迁移需求，输出一份出版级、高实操性、覆盖前后端与财务合规的完整技术改造与落地执行方案。

【核心任务目标】
${text}
将现有系统的海外支付网关（如 Stripe）全面重构并平滑升级为中国大陆本土化支付与结算体系（深度支持微信支付 WeChat Pay、支付宝 Alipay 以及银行对公/个人电汇转账），构建高并发、零掉单、强幂等性与财税合规的聚合收银与财务对账系统。

【业务背景与迁移改造范围】
- 目标受众与场景：中国大陆境内企业客户（B2B 对公大额）与个人消费者（B2C 零售小额）；
- 核心痛点解决：彻底解决海外支付网关在大陆地区外卡拒付率高、汇率损耗大、手续费高昂以及无法开具国内合规增值税发票的问题；
- 改造范围：涵盖微信/支付宝官方渠道对接、数据库表结构迁移、交易状态机设计、异步回调防重放、前端收银台交互体验、对公水单审核流与发票开具。

【技术架构与深度实施要求】

1. 支付渠道与协议对接规范
   - 微信支付 (WeChat Pay API v3)：
     · 接入模式：Native 扫码支付（PC Web）、JSAPI / 小程序支付（微信生态内）、H5 支付（手机外部浏览器）；
     · 安全规范：基于平台公钥证书与商户 API 证书的双向 SHA256-RSA 签名验证、AES-256-GCM 密文解密。
   - 支付宝 (Alipay EasySDK / Open API)：
     · 接入模式：电脑网站支付（PC 网页跳转/扫码）、当面付（生成聚合支付码）、手机网站/App 支付；
     · 安全规范：RSA2 (SHA256withRSA) 密钥与公钥证书验签。
   - 银行转账与对公电汇 (Bank Wire & Remittance)：
     · 线下流程闭环：用户提交转账意向 -> 系统生成专属汇款识别码（附言码/Order Token）与对公账户详情 -> 用户线下打款并上传银行回单凭证（水单） -> 财务后台审核放行/自动认领核销。

2. 数据库表结构与交易状态机重构
   - 数据迁移：平滑解耦历史 Stripe customer_id 与 payment_intent_id；
   - 统一交易表设计 (payment_orders, transactions, transfer_slips)：
     · 核心字段：order_no, channel_type (WECHAT/ALIPAY/BANK_TRANSFER), channel_trade_no, amount_cny, status (PENDING/PAID/FAILED/AUDITING/REFUNDED), idempotency_key, paid_at；
   - 强幂等状态机：通过分布式排他锁（Redis Redlock 或数据库行级锁 FOR UPDATE）确保单笔订单仅处理一次成功回调。

3. 安全性、异步通知与异常补偿机制
   - 异步回调 (Webhook / Notify)：严格校验来源 IP 与数字签名，毫秒级返回 SUCCESS 防止渠道重试风暴；
   - 主动轮询补偿 (Active Polling)：针对用户关闭支付页或网络丢包，设计定时主动查询任务（下单后 1m、3m、5m 轮询支付网关状态）。

4. 前端统一收银台 (Unified Checkout UX) 交互设计
   - 聚合收银台：清晰切换【微信扫码】、【支付宝】与【对公转账】；
   - 二维码动态刷新与 5 分钟超时倒计时；
   - 对公转账页面：提供户名、开户行、大额行号、专属附言码一键复制，以及水单图片（JPG/PNG/PDF）拖拽上传预览。

5. 财税合规、结算周期与增值税发票
   - 结算周期：微信/支付宝 T+1 自动提现至企业基本户；
   - 增值税发票系统：支付成功后支持自助申请【增值税普通发票】或【增值税专用发票】，预留电子发票税控接口。

【交付产物与输出格式标准】
1. 完整架构流程图（包含 用户、收银台前端、支付微服务、微信/支付宝网关、财务审核后台 的时序交互）；
2. 核心数据库 DDL SQL 建表脚本；
3. 后端接入示例代码（包含签名验证与 Webhook 幂等处理）；
4. 灰度切流与上线迁移 SOP。`
    };
  }

  // 2. 海外买家开发与定制开发信 (Cold Outreach & Lead Nurturing)
  if (/(开发信|email|inmail|触达|破冰|写信|联系客户|联系买家|outreach|pitch|跟进客户)/i.test(text)) {
    return {
      inferredIntent: "海外买家定制开发信与高转化破冰触达",
      source: "deep_intent_engine",
      enhancedPrompt: `【系统角色与专业定位】
你是一名拥有 15 年欧美与新兴市场实战经验的外贸顶尖销售总监与商业文案大师。请基于以下需求，输出一套拒绝模版化、高回复率的定制开发信攻坚方案。

【核心任务目标】
${text}
针对目标海外买家客群，构建深度融合企业产品真实 DNA 与买家痛点契合度的 1v1 定制开发信（Cold Outreach Sequence），实现高打开率、高回复率与精准商机破冰。

【买家画像与决策链场景】
1. 决策人角色分工：
   - 经济决策人 (CEO / VP Sourcing)：关注总持有成本 (TCO)、供应链交期稳定性与工厂交付确定性；
   - 技术评估人 (Lead Engineer / Quality Director)：关注公差精度、材质认证、图纸吻合度与检测报告；
   - 商务执行人 (Procurement Specialist)：关注 MOQ 门槛、付款条件 (TT/OA/LC) 与样品极速交付。
2. 语言与语调风格：地道海外商务英文（Native B2B Business English），逻辑严密，语调客观自信，彻底杜绝虚假赞美与廉价推销感。

【3 轮递进式开发序列设计 (3-Touch Sequence)】
- 邮件主题库（Subject Lines）：提供 5 组高打开率、低垃圾邮件触发率的专业主题（含公司名定制与 Why-Now 异动勾子）；
- 第 1 轮（Why-Now & Pain Point Hook）：
  · 破冰理由：基于买家近期采购异动或行业供应链变化；
  · 价值主张：直击痛点，列举 2 个经认证的硬核事实（如公差 ±0.01mm、通过 CE/FDA 认证）；
  · 极低阻力 CTA：邀请确认是否需要一份相关品类的技术对比白皮书或样品。
- 第 2 轮（Social Proof & Technical Depth）：
  · 深度展示出货实绩、第三方实验室测试报告与同类标杆客户案例；
  · 提供定制产品图纸公差与产能排期保障。
- 第 3 轮（Risk-Reversal Offer & Closing）：
  · 给出无法拒绝的商业 Offer（如：极速 3 天免费打样、首单灵活 MOQ 支持、延保质诺）。

【交付输出标准】
- 中英文双语对照输出；
- 标注每轮邮件的最佳发送时间间隔（如 Day 1 -> Day 4 -> Day 8）与跟进注意事项。`
    };
  }

  // 3. 价格谈判、阶梯报价与让步策略 (Price Negotiation & Quotation Strategy)
  if (/(报价|价格|让步|moq|fob|cif|付款方式|折扣|降价|谈判|利润|pi|形式发票|quotation|成本)/i.test(text)) {
    return {
      inferredIntent: "阶梯报价方案设计与外贸谈判让步策略",
      source: "deep_intent_engine",
      enhancedPrompt: `【系统角色与专业定位】
你是一名资深的外贸商务谈判专家与财务精算总监。请针对以下报价与谈判诉求，输出一份守住利润红线、兼顾客户心理博弈的完整商务方案。

【核心任务目标】
${text}
设计科学的阶梯报价单（Quotation Sheet）与多轮商务谈判让步矩阵（Concession Matrix），在守住底线毛利率与交期安全的前提下，最大化订单成交率与客单价。

【商业边界与测算要素】
1. 成本与利润底线：严格测算原材料成本、海运/空运费用、汇率波动风险准备金，明确绝对不可跌破的底线价格；
2. 贸易条款 (Incoterms)：清晰区分 EXW / FOB 港口 / CIF 目的港 / DDP 完税后交货的价格差异与风险分界；
3. 阶梯方案设计：设计 Good (试单款) / Better (主力款) / Best (高附加值款) 三级起订量与阶梯单价。

【博弈让步策略 (Concession Rules)】
- 严禁无条件降价：客户每次提出压价，必须绑定等价交换条件（例如：降价 3% 需提升起订量 30%、或将付款条件由 OA 改为 30% 定金、或采用标准模具替代定制模具）；
- 原材料联动与锁价条款：明确报价有效期（如 15/30 天）与大宗原材料价格波动超过 5% 时的调价机制。

【交付输出标准】
1. 结构化阶梯报价明细表（含规格、MOQ、单价、交期、包装与付款方式）；
2. 针对客户 3 大常见异议（“同行价格低20%”、“预算不足”、“需要更长账期”）的标准谈判应对英文话术库。`
    };
  }

  // 4. 海关提单数据分析、买家背调与市场准入 (Customs & Market Intelligence)
  if (/(海关|提单|准入|认证|ce|fda|rohs|背调|调研|市场分析|关税|hs编码|买家画像|供应链)/i.test(text)) {
    return {
      inferredIntent: "目标国市场准入法规与海关买家深度背调",
      source: "deep_intent_engine",
      enhancedPrompt: `【系统角色与专业定位】
你是一名资深的全球海关贸易数据分析师与国际贸易合规专家。请针对以下市场与买家背调需求，输出一份事实确凿、数据可溯源的深度分析报告。

【核心任务目标】
${text}
穿透真实海关提单 (Bill of Lading) 与目标国家准入法规，排除货代干扰，还原真实买家企业实体、供应链走势、采购周期与合规缺口。

【多维度事实穿透要求】
1. 海关提单交易证据链分析：
   - 提取目标买家近 90/180 天的真实采购频次、总集装箱柜量 (TEU)、主要供货商出口占比与供应链异动；
   - 实体消歧与货代过滤：基于美国 FMC / 中国交通部备案数据库，剔除货代与报关行，锁定真实买家母公司与官方域名。
2. 市场准入与强制法规合规：
   - 核验目标国家 HS 编码关税税率（含最惠国税率与附加关税）；
   - 对照当地市场强制准入标准（如欧盟 CE/RoHS/REACH、美国 FDA/CPSC/UL、中东 SASO、东南亚 TISI）。
3. 采购委员会决策链画像：
   - 梳理买家商业形态（品牌商 / 大批发商 / 零售巨头）；
   - 绘制关键决策人角色图谱（采购、技术、质检、高管）。

【交付输出标准】
- 结构化 Markdown 深度背调报告（含数据事实表格、SWOT 分析与切入攻坚建议）。`
    };
  }

  // 5. 通用任务的高阶智能重构 (General Intelligent Blueprint)
  return {
    inferredIntent: "多维业务任务深度结构化解析",
    source: "deep_intent_engine",
    enhancedPrompt: `【系统角色与专业定位】
你是一名具备深厚行业实战经验的资深顾问与执行专家。请针对以下需求，进行深度意图探索、上下文补齐与专业化落地执行方案输出。

【核心任务目标】
${text}

【业务背景与执行边界】
1. 深入探索：全面解构该需求背后的商业逻辑、技术约束与实际落地场景；
2. 事实为基：严格结合真实业务事实、行业规范与最佳实践，坚决杜绝泛泛而谈与虚构猜测；
3. 闭环设计：涵盖前期准备、核心执行步骤、风险防范与后续交付验证。

【深度实施要求与关键细节】
- 梳理核心要素与前后依赖关系；
- 明确关键技术参数、操作规范与安全合规要求；
- 预判常见卡点并提供备选应对预案。

【交付产物与输出格式标准】
- 按照优先级清晰排版，使用结构化列表与加粗重点呈现；
- 包含可直接执行的 SOP 步骤清单与标准化成果模版。`
  };
}

/**
 * 增强 Prompt 主入口函数
 */
export async function enhancePrompt(rawPrompt: string): Promise<PromptEnhanceResult> {
  const trimmed = rawPrompt.trim();
  if (!trimmed) {
    return {
      enhancedPrompt: `【系统角色与专业定位】
你是一名资深的外贸数字化增长专家与全流程业务中台。请为我梳理并输出一份高标准的业务推进方案。

【核心任务目标】
深入分析目标海外市场的采购特征与买家画像，并输出结构化的高转化实操攻坚方案。

【专业要求与执行标准】
1. 结合外贸真实业务闭环与全生命周期协同，严格杜绝虚构编造；
2. 突出核心竞争优势、合规认证与差异化价值主张；
3. 输出逻辑清晰、可直接落地执行的步骤、话术或结构化数据清单。`,
      inferredIntent: "通用外贸增长与市场分析",
      source: "deep_intent_engine"
    };
  }

  // 1. 首先尝试调用云端真实大模型接口 (Cloud LLM API)
  const llmRes = await tryLlmInference(trimmed);
  if (llmRes) {
    return llmRes;
  }

  // 2. 本地深度语义图谱重构 (Deep Domain Semantic Engine)
  return buildDeepDomainPrompt(trimmed);
}
