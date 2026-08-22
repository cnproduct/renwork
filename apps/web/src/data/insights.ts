export interface InsightArticle {
  slug: string;
  title: string;
  category: string;
  author: string;
  publishedAt: string;
  readTime: string;
  summary: string;
  content: string;
}

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    slug: "customs-lead-generation-guide-2026",
    title: "2026 外贸出海新范式：如何穿透真实海关提单捕获‘隐形大买家’？",
    category: "获客方法论",
    author: "人人易出海研究院",
    publishedAt: "2026-08-20",
    readTime: "8 分钟",
    summary: "为什么买来的海关数据 90% 都是货代？本文详解基于 NVOCC 剔除与供应链异动信号的全新海关穿透逻辑。",
    content: `## 传统海关数据的“三座大山”
绝大部分外贸业务员在使用传统海关数据工具时都会遇到三大痛点：
1. **货代占满列表**：提单抬头全是中转货代与报关行，无法确认真实采购商；
2. **缺乏时效与动态**：数据往往滞后半年以上，客户早已锁定供货商；
3. **找不到具体决策人**：只有公司名，不知道该联系谁。

## 现代外贸增长操作系统的解法
RenWork 引入‘三层穿透’模型：
- **第一层：NVOCC 模式识别**，通过自动化规则与企业名称实体消歧，将国际货代过滤率提升至 95% 以上；
- **第二层：Double Signal 意图计算**，结合采购频次与原供货商断供/交期异动信号，精准把握客户最需要新供应商的‘黄金窗口期’；
- **第三层：采购委员会 (Buying Committee) 穿透**，不仅锁定采购经理，更同时触达产品工程师与合规主管，实现多点协同攻坚。`
  },
  {
    slug: "ai-outreach-best-practices",
    title: "拒绝群发垃圾邮件：用 10 维背调原子证据打造 30%+ 高回复率开发信",
    category: "外贸实操",
    author: "RenWork 增长实验室",
    publishedAt: "2026-08-18",
    readTime: "6 分钟",
    summary: "海外采购商每天收到上百封开发信，如何用原子证据 + 风险逆转 CTA 瞬间吸引买家眼球？",
    content: `## 为什么模版化群发早已失效？
海外企业采购邮箱普遍部署了高强度的企业级垃圾邮件过滤网关。通用模板不仅进垃圾箱率极高，还会导致企业域名被列入全球黑名单 (RBL)。

## 高转化开发信的四步公式
1. **Why You (为什么是你)**：引用买家近期的提单交易或其官网痛点（如特定认证需求）；
2. **Why Us (为什么选我们)**：出具经权威检测的产品 DNA 数据（如光谱测试结果或 ASTM 证书）；
3. **Why Now (为什么是现在)**：指出买家目前供应链潜在交期风险或行业改款趋势；
4. **Risk-Reversal CTA (风险逆转行动呼吁)**：提供‘免费极速空运样品’或‘免模具费试产’，将买家的尝试成本降至零。`
  },
  {
    slug: "teamai-knowledge-flywheel",
    title: "告别销冠离职带走客户：外贸企业如何用 TeamAI 打造团队自进化知识飞轮？",
    category: "企业管理",
    author: "人人易架构师团队",
    publishedAt: "2026-08-15",
    readTime: "7 分钟",
    summary: "如何将优秀业务员的拓客经验、谈判让步底线与破冰话术沉淀为企业数字资产？",
    content: `## 外贸团队知识断层的世纪难题
很多外贸企业严重依赖一两名金牌销冠。一旦人员流动，积累多年的海外沟通话术、客户心理洞察与供应商谈判技巧便荡然无存。

## TeamAI 的 Git 原生知识飞轮
TeamAI 将软件工程的协作机制引入外贸团队管理：
- **版本化技能 (\`.teamai/skills/\`)**：标准化的海关穿透策略与行业词库；
- **自进化学习 (Learning Candidate)**：业务员在日常工作中改写的优秀邮件，被系统自动提炼并提交为审查候选项；
- **知识召回 (Recall)**：在面对同类型买家时，新员工的工作台将自动展示经过团队验证的最佳话术，实现‘新人入职即销冠’。`
  }
];
