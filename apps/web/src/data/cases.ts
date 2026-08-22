export interface CaseStudy {
  id: string;
  slug: string;
  clientType: string;
  industry: string;
  region: string;
  title: string;
  challenge: string;
  workflow: string;
  results: {
    leadsDiscovered: number;
    contactsVerified: number;
    responseRate: string;
    sampleRequests: number;
    closedDeals: string;
    roi: string;
  };
  evidenceSummary: string;
  quote: string;
  authorTitle: string;
}

export const CASE_STUDIES: CaseStudy[] = [
  {
    id: "case-01",
    slug: "semiconductor-ems-penetration",
    clientType: "工贸一体型电子元器件制造商 (深圳)",
    industry: "半导体与电子元器件",
    region: "北美与东南亚 (美、德、越、马)",
    title: "从 0 突破海外 EMS 代工巨头：45 天斩获 3 笔千万级 MPN 替代订单",
    challenge: "传统依赖华强北贸易商分销，海外直销渠道几乎为零；多次盲目参展但海外工程师客户决策链路深，传统邮件发信打开率不足 3%。",
    workflow: "1. 导入 12 款核心功率器件规格书，由 RenWork 生成产品 DNA 与跨型号兼容矩阵 (Cross-Reference Matrix)。\n2. 海关意图引擎穿透近 180 天 142 家北美及东南亚代工厂提单，剔除货代锁定 48 家高活跃采购商。\n3. OKKI Local 穿透采购委员会 (Sourcing VP + Component Engineer)。\n4. 针对买家现供货商交期延误信号，自动生成带 AEC-Q101 报告与免费样品包的 3 轮开发序列，人工审批后发出。",
    results: {
      leadsDiscovered: 142,
      contactsVerified: 86,
      responseRate: "28.4%",
      sampleRequests: 24,
      closedDeals: "¥1,850 万",
      roi: "18.5x"
    },
    evidenceSummary: "提单数据显示目标买家原德国供应商出货周期由 4 周拉长至 14 周，RenWork 精准抓住现货替代痛点破冰。",
    quote: "“RenWork 让我们的业务员告别了盲目搜邮箱。每一家找出来的客户都有真实提单和具体工程师对接，转化效率令人震撼。”",
    authorTitle: "海外营销副总经理 · 李总"
  },
  {
    id: "case-02",
    slug: "stone-building-materials-us",
    clientType: "大型文化石建材外贸出口集团 (厦门)",
    industry: "建筑材料与人造文化石",
    region: "北美地区 (美加全境港口)",
    title: "穿透美国前五大建材连锁分销商：单季新增 180 个高柜采购协议",
    challenge: "美国反倾销与关税壁垒下，老客户下单趋于保守；急需拓展抗冻融高端工程客户，但传统海关数据充斥着大量物流货代，真实买家难以辨识。",
    workflow: "1. 调取全美建材提单，应用 RenWork 独家 NVOCC 货代过滤算法，过滤 96% 的代理行，提取 35 家年采购 50+ TEU 的真实工程分销商。\n2. LinkedIn 360 匹配各州分销商的 Category Manager 与采购总监。\n3. 结合 ASTM C1364 测试报告与空运色板直邮策略，由业务员一键审批个性化 InMail 与开发信。",
    results: {
      leadsDiscovered: 210,
      contactsVerified: 124,
      responseRate: "34.2%",
      sampleRequests: 38,
      closedDeals: "180 TEU (约 $360 万)",
      roi: "22.3x"
    },
    evidenceSummary: "核验真实提单包含纽约、洛杉矶及休斯顿港口的清关 Consignee，剔除 Expeditors、Kuehne+Nagel 等中间货代。",
    quote: "“以前买的海关数据 90% 是货代根本没法用。RenWork 的买家穿透和采购委员会解析直接帮我们切入到了核心买家高管。”",
    authorTitle: "外贸总监 · 张总"
  },
  {
    id: "case-03",
    slug: "hygiene-valves-europe",
    clientType: "五金阀门与卫浴出口制造龙头 (台州/宁波)",
    industry: "卫浴洁具与工业阀门",
    region: "欧洲 (德、意、英、法、荷)",
    title: "打破欧洲本土品牌壁垒：借供应链异动信号成功打入 4 家欧洲卫浴 OEM 供应链",
    challenge: "欧洲对 CE 与 WRAS 水效环保认证要求极高，市场长期被本土品牌及意大利老牌代工厂垄断，普通开发信几乎全部石沉大海。",
    workflow: "1. 建立包含 CE/WRAS/NSF 认证和 100% 气密出厂检测的企业产品事实档案。\n2. 实时监控欧洲重点买家的海关提单与到港批次，捕捉到一家核心买家其原波兰代工厂连续 2 个月无到港提单的供应链真空期。\n3. 智能拟定‘欧洲保税仓极速备货 + 试单 100 支免模具费’的低风险 Offer 序列，业务员 10 秒审批发出。",
    results: {
      leadsDiscovered: 98,
      contactsVerified: 62,
      responseRate: "31.8%",
      sampleRequests: 19,
      closedDeals: "€210 万",
      roi: "15.8x"
    },
    evidenceSummary: "通过比对近 2 年欧洲航线提单频次，精准抓取其原供应商断供信号，形成不可抗拒的切入时机 (Why-Now Trigger)。",
    quote: "“抓准买家供应链出问题的窗口期进场，比盲目发 1000 封垃圾邮件管用 100 倍。这是外贸 AI 真正具备智慧的体现。”",
    authorTitle: "国际事业部部长 · 陈部长"
  }
];
