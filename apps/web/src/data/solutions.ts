export interface IndustrySolution {
  slug: string;
  name: string;
  nameEn: string;
  tagline: string;
  painPoints: string[];
  hsCodesSample: string[];
  keyRoles: string[];
  customsCoverage: string;
  outreachStrategy: string;
  metricResult: string;
  evidenceSummary: string;
}

export const INDUSTRY_SOLUTIONS: IndustrySolution[] = [
  {
    slug: "semiconductor",
    name: "芯片与电子元器件",
    nameEn: "Semiconductors & Electronic Components",
    tagline: "穿透全球 EMS 代工厂、汽车电子 Tier-1 与工控终端采购商，锁定物料编码 (MPN) 替代商机",
    painPoints: [
      "国际分销商层层阻隔，难以直达终端工厂采购委员会",
      "型号替代与兼容性验证周期长，传统邮件回复率低",
      "海关提单品名笼统，普通搜索无法匹配精准 MPN/HS Code"
    ],
    hsCodesSample: ["8541.10", "8542.31", "8542.39", "8534.00"],
    keyRoles: ["VP Procurement", "Component Engineering Lead", "Sourcing Manager", "Hardware Architect"],
    customsCoverage: "北美、欧洲、东南亚主要电子保税区与 EMS 代工集群",
    outreachStrategy: "以 MPN 跨厂兼容测试报告 (Cross-Reference Matrix) 与交期现货库存为破冰切入点",
    metricResult: "首月获取 38 家海外 EMS 终端询价，意向样品送测率提升 340%",
    evidenceSummary: "提取近 90 天提单中的真实 Consignee 与发货重量，结合 LinkedIn 锁定硬件物料工程师。"
  },
  {
    slug: "stone",
    name: "建筑文化石与新型建材",
    nameEn: "Architectural Stone & Veneer Building Materials",
    tagline: "直击欧美大型建材分销商、景观工程承包商与连锁家居卖场 (Home Depot / Lowe's 采购链)",
    painPoints: [
      "传统参展成本高昂，获客周期动辄 6-12 个月",
      "买家更关注抗冻融测试认证、色差控制与整柜破损率",
      "海关提单多被国际货代隐匿真实买家公司"
    ],
    hsCodesSample: ["6802.93", "6802.99", "6810.19", "2516.12"],
    keyRoles: ["Category Manager Building Materials", "Chief Estimator", "Procurement Director", "Architectural Specifier"],
    customsCoverage: "美国、加拿大、澳洲及中东大宗建材进口港口全量提单",
    outreachStrategy: "出具 ASTM C1364/ASTM C1670 权威测试报告对比 + 免费极速空运样板包",
    metricResult: "成功锁定 12 家北美区域前三建材进口分销商，签单周期由 180 天压缩至 45 天",
    evidenceSummary: "通过提单柜量 (TEU) 识别出年采购 50 柜以上的真实分销商，剔除货代占比 94%。"
  },
  {
    slug: "hygiene",
    name: "卫浴洁具与工业五金阀门",
    nameEn: "Sanitary Ware & Industrial Valves",
    tagline: "穿透欧美暖通工程承包商、水务集团与卫浴品牌 OEM/ODM 采购链，突破水效认证壁垒",
    painPoints: [
      "WaterSense, CE, WRAS, CUPC 等国际强制认证门槛高",
      "传统客户多为代理商，价格透明度极高，毛利被压榨",
      "缺乏对海外买家现有供应商异动情况的实时监控"
    ],
    hsCodesSample: ["8481.80", "8481.90", "6910.10", "6910.90"],
    keyRoles: ["Supply Chain Director", "Global Sourcing VP", "Quality Assurance Manager", "OEM Project Buyer"],
    customsCoverage: "欧洲（德、意、英、法）、北美及中东重点工程项目海关数据",
    outreachStrategy: "针对其老供应商交期延误信号，以‘双重材质光谱检测 + 零铅环保标准 + 试单保价’介入",
    metricResult: "开拓 7 家欧洲中高端卫浴品牌代工订单，年采购柜量累计超 160 TEU",
    evidenceSummary: "从海关提单中捕获其主要供应商交货频次下降 40% 的异动信号，精准实施逆向开发。"
  },
  {
    slug: "baby-silicone",
    name: "婴童用品与硅胶日用品",
    nameEn: "Baby Products & Food-Grade Silicone",
    tagline: "快速穿透 Amazon 头部品牌商、DTC 独立站大卖家与母婴连锁商超采购委员会",
    painPoints: [
      "FDA, LFGB, BPA-Free 食品级安全检测与环保认证要求极高",
      "产品改款迭代极快，模具开发周期决定订单归属",
      "买家主要为海外年轻电商创业品牌，传统参展难以触达"
    ],
    hsCodesSample: ["3924.10", "3924.90", "9503.00", "9018.90"],
    keyRoles: ["Head of Product", "DTC Brand Founder", "Amazon Brand Manager", "Quality Compliance Officer"],
    customsCoverage: "北美、日韩、西欧海关与跨境电商清关货源数据",
    outreachStrategy: "提供 3D 开模 48 小时极速出样方案 + 完整 FDA/LFGB 检测证书链",
    metricResult: "成功签约 15 家欧美 Amazon 头部母婴品牌独家代工，年销售额突破 4,200 万元",
    evidenceSummary: "结合海关提单重量与电商热销榜单，定位具有高增长采购潜力的活跃买家。"
  },
  {
    slug: "gifts",
    name: "工艺礼品与文创定制",
    nameEn: "Gifts, Crafts & Cultural Merchandising",
    tagline: "锁定跨国企业年度采购季、国际主题乐园、赛事衍生品与大型连锁礼品采购商",
    painPoints: [
      "节日季节性极强（圣诞/复活节），错过采购窗口即失去全年机会",
      "买家极其注重打样速度与知识产权 (IP) 保护",
      "小单快反与柔性定制要求高"
    ],
    hsCodesSample: ["3926.40", "4420.10", "8306.29", "9505.10"],
    keyRoles: ["Corporate Gifting Director", "Licensing Manager", "Marketing VP", "Event Sourcing Lead"],
    customsCoverage: "全球主要消费品进口市场与节日大宗采购关口数据",
    outreachStrategy: "按海外节日倒排生产时间表 + 免费 3D 渲染图与环保包装定制方案",
    metricResult: "单季度拿下 3 个海外知名 IP 授权周边大单，打样确认率高达 91%",
    evidenceSummary: "海关采购周期精准推演，提前 4 个月精准触达买家采购决策人。"
  },
  {
    slug: "pharma",
    name: "生物医药原料与健康产品",
    nameEn: "Pharma Raw Materials & Nutritional Ingredients",
    tagline: "穿透欧美及拉美药企、保健品品牌、功能性食品与宠物营养巨头研发与采购团队",
    painPoints: [
      "GMP, FDA DMF, ISO, Halal, Kosher 等药用与食品级认证极其严格",
      "研发 (R&D) 科学家与采购部双重决策，门槛极高",
      "大宗原料价格波动剧烈，供应链稳定性为核心考核指标"
    ],
    hsCodesSample: ["2922.49", "2936.21", "2918.15", "2923.90"],
    keyRoles: ["Head of R&D Formulation", "API Sourcing Director", "Regulatory Affairs Specialist", "VP Global Procurement"],
    customsCoverage: "美国、欧洲、印度、巴西等全球主要原料药与营养品海关提单",
    outreachStrategy: "提供完整批次 COA 质检单、重金属与杂质残留检测光谱 + 免费 500g 研发级样品",
    metricResult: "进入 4 家全球前 50 营养补充剂巨头核心合格供方名录 (Approved Vendor List)",
    evidenceSummary: "通过提单穿透海外药企长期供货商的进口批次与港口，制定无缝替代切入方案。"
  }
];
