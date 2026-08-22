export interface PricingTier {
  id: string;
  name: string;
  tagline: string;
  price: string;
  billingPeriod: string;
  originalPrice?: string;
  targetAudience: string;
  seats: string;
  credits: string;
  isPopular?: boolean;
  features: string[];
  ctaText: string;
  ctaLink: string;
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "startup",
    name: "起步版 (Startup)",
    tagline: "适合 1-3 人外贸初创团队或独立 SOHO，建立精准买家拓客标准流程",
    price: "¥19,800",
    billingPeriod: "/ 年",
    targetAudience: "外贸 SOHO / 初创外贸工作室",
    seats: "1 个业务主账号",
    credits: "每年赠送 20,000 Credits 算力",
    features: [
      "全球海关提单真实买家穿透 (近180天数据)",
      "OKKI 本地联系人解析与清洗 (本地回路)",
      "LinkedIn 360 基础实体匹配与动态监控",
      "单轮高转化 Email 开发信草稿与人工审批",
      "企业产品 DNA 事实档案 (支持 10 个主推 SKU)",
      "标准工单支持与社群交流"
    ],
    ctaText: "立即开始起步版",
    ctaLink: "/diagnosis?tier=startup"
  },
  {
    id: "growth",
    name: "增长版 (Growth)",
    tagline: "最受欢迎！适合 3-8 人外贸团队，实现海关穿透与多轮邮件/社媒自动化开发",
    price: "¥29,800",
    billingPeriod: "/ 年",
    originalPrice: "¥39,800",
    targetAudience: "快速成长期外贸企业 / 工贸一体工厂",
    seats: "3 个业务协作账号",
    credits: "每年赠送 50,000 Credits 算力",
    isPopular: true,
    features: [
      "包含起步版全部核心功能",
      "全维度 Intent Score 采购意图评分 (包含供应异动分析)",
      "采购委员会 (Buying Committee) 决策链深度穿透",
      "3 轮带风险逆转 CTA 的 Email 开发序列与退信熔断",
      "6 语种社媒矩阵排期与品牌声量助手",
      "企业私有知识库挂载与产品事实库 (50 个 SKU)",
      "1v1 专属实施顾问在线指导"
    ],
    ctaText: "开启增长版体验",
    ctaLink: "/diagnosis?tier=growth"
  },
  {
    id: "scale",
    name: "规模版 (Scale)",
    tagline: "适合 8-20 人成熟外贸部门，实现团队协同、知识沉淀与多渠道全自动流转",
    price: "¥59,800",
    billingPeriod: "/ 年",
    targetAudience: "规模化外贸企业 / 跨国供应链贸易商",
    seats: "10 个业务席位 + 管理员驾驶舱",
    credits: "每年赠送 150,000 Credits 算力",
    features: [
      "包含增长版全部功能",
      "海关提单近 3 年全周期深度历史追踪与供货份额透视",
      "LinkedIn 360 团队协同与 InMail/专业评论策略库",
      "Zoho / 企业级 SMTP 专属发信网关与域名健康监控",
      "TeamAI 团队知识治理：经验沉淀、Recall 与 Learning PR",
      "企业多源产品库与图谱无上限导入",
      "季度增长复盘与专属技术 SLA 保障"
    ],
    ctaText: "申请规模版演示",
    ctaLink: "/diagnosis?tier=scale"
  },
  {
    id: "enterprise",
    name: "旗舰企业版 (Enterprise)",
    tagline: "大型外贸集团或行业龙头，专属私有部署/混合云、深度定制流程与全链路安全治理",
    price: "¥128,000",
    billingPeriod: "/ 年起",
    targetAudience: "规模型出口集团 / 产业带龙头龙头企业",
    seats: "30+ 席位 (支持弹性扩展)",
    credits: "500,000 Credits 专属算力池",
    features: [
      "包含规模版全部功能",
      "专属私有数据库与租户完全物理隔离",
      "ERP / CRM 深度双向打通 (OKKI、Salesforce、用友等)",
      "企业定制外发合规门禁 (Pre-tool / Post-tool Blocking Hooks)",
      "本地可见浏览器与 RPA 专属优化集群",
      "专属架构师团队驻场/远程联合实施",
      "7x24 小时顶级响应保障与数据主权协议"
    ],
    ctaText: "预约企业架构咨询",
    ctaLink: "/diagnosis?tier=enterprise"
  },
  {
    id: "strategic",
    name: "集团定制与产业带专案 (Strategic)",
    tagline: "针对区域商会、产业集群与外贸综合服务平台，打造区域级外贸 AI 基础设施",
    price: "¥380,000 起",
    billingPeriod: "/ 专案",
    targetAudience: "外贸综合服务平台 / 区域外贸产业带园区",
    seats: "定制无限量席位",
    credits: "定制企业级算力专网",
    features: [
      "区域外贸产业带数字员工集群整体交付",
      "全定制行业海关知识图谱与产品特征库",
      "混合云与本地服务器高可用集群部署",
      "定制本地 LLM 模型微调与算力适配",
      "全面定制培训营与区域外贸数字化认证体系",
      "战略级项目经理全程护航"
    ],
    ctaText: "联系战略合作专员",
    ctaLink: "/contact?type=strategic"
  }
];

export const CREDITS_PACKAGES = [
  { amount: "10,000 Credits", price: "¥1,000", desc: "约可完成 1,000 次海关穿透或 500 次采购委员会解析" },
  { amount: "50,000 Credits", price: "¥4,500", desc: "赠送 10% 算力，满足日常规模化外联需求" },
  { amount: "200,000 Credits", price: "¥16,000", desc: "赠送 20% 算力，适合高频多渠道多项目运作" }
];
