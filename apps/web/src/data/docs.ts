export interface DocSection {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
}

export const DOC_SECTIONS: DocSection[] = [
  {
    slug: "quickstart",
    title: "5 分钟快速上手指南",
    category: "起步入门",
    description: "从安装 RenWork 到完成首批 20 家真实海关买家挖掘与联系人解析的极速教程",
    content: `## 1. 下载并安装客户端
根据您的操作系统从 [下载中心](/downloads) 下载对应安装包并双击完成安装。首次启动 RenWork 时，客户端将在本地建立沙箱运行环境。

## 2. 建立首个企业 Workspace
1. 点击左上角 **新建工作区 (New Workspace)**。
2. 填入企业官网域名及公司主营产品关键词。
3. 上传企业主打产品的 PDF 手册或规格说明书，系统将自动解构生成标准化的 \`ProductProfile\` 与 \`CompanyProfile\`。

## 3. 运行首个海关意图挖掘任务
在 **Buyer Discovery** 面板中，输入目标市场（如德国、美国）与 HS Code，点击 **开始海关穿透**。RenWork 将在 60 秒内输出带有真实提单号与采购量评分的买家候选池。`
  },
  {
    slug: "product-dna",
    title: "构建企业产品 DNA 事实库",
    category: "企业建模",
    description: "如何提取产品参数、认证资质与 MOQ 政策，为所有 AI 生成内容提供不可动摇的事实基底",
    content: `## 为什么需要产品事实库？
传统 AI 营销最致命的缺陷是“虚构幻觉”——随意承诺交期或虚构认证。RenWork 通过强类型产品事实库（Product DNA）确保所有输出均有权威依据。

### 核心包含要素：
- **物料与参数**：主要原材料、技术公差、测试标准。
- **强制认证**：FDA, CE, WRAS, LFGB 等证书编号与生效期。
- **商务条款**：梯队阶梯定价、最小起订量 (MOQ)、标准交货周期与付款信用支持。
- **宣传红线**：严禁对外宣传的专利限制或非成熟功能。`
  },
  {
    slug: "customs-intent-engine",
    title: "海关买家穿透与意图评分 (Intent Score)",
    category: "核心能力",
    description: "深度解析全球真实海关提单，剔除国际货代并计算多维度 Intent Score",
    content: `## 海关穿透三层架构
1. **通用引擎层**：标准化解析全球 30+ 贸易大国报关单与提单结构。
2. **行业知识包**：专精行业 HS 编码矩阵、上下游供需关联与高频同义词库。
3. **企业配置层**：用户特定 SKU、目标国家与特定供货商排除名单。

### Intent Score 评分因子
- **产品匹配度 (40%)**：品名、HS Code 与技术规格重合度。
- **采购活跃度 (30%)**：近 90/180 天进口频次与柜量增长率。
- **供应链异动 (20%)**：主要供货商交期异动或断供真空期。
- **实体真实性 (10%)**：企业存续状态、官方域名与信用评级。`
  },
  {
    slug: "okki-local-adapter",
    title: "OKKI 本地可见适配器与采购委员会解析",
    category: "核心能力",
    description: "在业务员本地环境安全运行 OKKI 穿透，解析采购决策人与可信联系方式",
    content: `## 本地优先安全原则
RenWork 的 OKKI 适配器完全运行在业务员本地的可见浏览器沙箱中：
- **零密码云端存储**：用户在本地完成正常登录，Cookie 绝不上传。
- **智能职位匹配**：自动识别 \`VP Sourcing\`、\`Chief Buyer\`、\`Component Engineer\` 等核心采购委员会角色。
- **去重与清洗**：自动合并同一企业跨部门联系人，标明信息来源与验证等级 (Verified / Probable / Unverified)。`
  },
  {
    slug: "outreach-and-approval",
    title: "高转化外联序列与审批流门禁",
    category: "核心能力",
    description: "多轮开发信序列编排、风险逆转 CTA 注入与外发人工确认机制",
    content: `## 人在回路 (Human-in-the-Loop)
在 RenWork 中，任何对外发出的邮件或社交互动都遵循严格的审批状态机：
\`draft → awaiting_approval → approved → executing → succeeded\`

### 关键合规门禁：
1. **敏感词检查**：自动过滤易引发 Spam 的夸张促销词汇。
2. **域名健康防护**：单域名每日发信上限与随机时间间隔延迟。
3. **退订与抑制名单**：客户一旦回复或点击退订，后续序列立即自动停止。`
  },
  {
    slug: "teamai-governance",
    title: "TeamAI 团队知识治理与自进化机制",
    category: "团队协同",
    description: "基于 Git 原生管理的知识库沉淀、Recall 召回与 Learning PR 审查机制",
    content: `## 团队智慧的持续进化
外贸团队中最宝贵的资产是销冠的实战经验。TeamAI 实现了经验的自动化萃取：
1. **纠偏捕获**：当业务员多次修改 AI 建议文案时，系统自动提炼差异。
2. **Learning PR**：生成标准 Pull Request，由外贸主管在审查无误后一键合并至团队知识库 (\`teamwiki/\`)。
3. **Recall 机制**：新业务员在起草针对同类客户的外联内容时，系统将自动召回团队沉淀的最佳话术与破冰策略。`
  }
];
