export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "product" | "customs" | "security" | "pricing";
}

export const FAQS: FAQItem[] = [
  {
    id: "what-is-renwork",
    question: "人人易 AI 与 RenWork 到底是什么关系？",
    answer: "人人易智能科技有限公司 (rrenn.com) 是企业级外贸增长操作系统的品牌与云端服务提供方；RenWork 是旗下本地优先的外贸 B2B AI 数字员工桌面客户端。两者分工明确：rrenn.com 承担官网展示、合规线索、版本分发与云端轻量算力；RenWork 承担用户本地的可见浏览器操作、海关数据分析、OKKI 穿透、邮件起草与人工审批闭环。",
    category: "product"
  },
  {
    id: "customs-data-accuracy",
    question: "海关买家穿透数据来源是什么？如何保证真实性与杜绝假名单？",
    answer: "我们的海关数据直连全球官方提单 (Bill of Lading) 与报关单库，覆盖近 180 天至 3 年的真实交易记录。RenWork 采用独家‘通用引擎+行业知识包+企业配置’三层架构，自动剔除 NVOCC 国际货代、报关行与拼箱代理，仅锁定真实采购商 (Consignee) 企业，并提供具体提单号、柜量 (TEU)、采购频次与主要供货商份额作为佐证，杜绝虚构。",
    category: "customs"
  },
  {
    id: "okki-integration",
    question: "如何与 OKKI / 小满 CRM 结合？会泄露账号密码或 Cookie 吗？",
    answer: "绝对不会！RenWork 严格遵循‘本地优先’与‘最小权限’安全原则。OKKI 穿透采用本地可见浏览器适配器 (Local Adapter) 运行在业务员电脑上，所有登录态和 Session Cookie 仅保存在用户本地操作系统沙箱中，绝不上传到任何云端服务器。系统仅在业务员授权下辅助进行职位筛选与联系人去重导出。",
    category: "security"
  },
  {
    id: "linkedin-safety",
    question: "LinkedIn 拓客会自动点赞、群发导致封号吗？",
    answer: "不会。人人易坚决反对未经授权的违规暴力群发。RenWork 坚持‘人在回路 (Human-in-the-Loop)’机制：AI 负责深度背调目标买家与决策人背景，拟定最契合业务场景的专业互动建议、InMail 草稿或个性化连接备注，所有外部动作必须由业务员在客户端界面亲自点击确认审批后才会触发执行，确保符合平台官方规范。",
    category: "product"
  },
  {
    id: "email-deliverability",
    question: "邮件开发信支持哪些发信渠道？如何防进垃圾箱？",
    answer: "支持接入 Zoho Mail、企业级域名 SMTP (465/587 端口) 以及主流企业邮箱服务。系统内置发信频率平滑控制、时区自动匹配、Spam 关键词合规检查、退信熔断机制、黑名单抑制及退订声明注入，全面保障企业发件域名的健康度与高送达率。",
    category: "product"
  },
  {
    id: "teamai-governance",
    question: "TeamAI 团队智能层是如何帮助外贸团队沉淀经验的？",
    answer: "TeamAI 采用 Git 原生的知识治理机制。当优秀业务员对 AI 起草的开发信或买家评分进行了针对性修改，系统会自动捕获并提炼为‘学习候选规则 (Learning Candidate)’；经过团队主管在 GitHub/TeamAI 平台审查批准后，即同步更新至团队专属知识库 (`teamwiki/`)，让新业务员瞬间掌握销冠的获客技能。",
    category: "product"
  },
  {
    id: "credits-consumption",
    question: "Credits 算力额度是如何计算与扣除的？",
    answer: "Credits 用于衡量高价值 AI 分析与外部数据穿透的算力消耗（例如深度解析一份海关全量提单、执行买家采购委员会消歧或生成多语种营销视频）。每个套餐均附带充裕的年度基础额度，超出部分可随时按需加购。所有扣费均有清晰的本地账本明细与幂等保障，失败任务自动全额退还预留额度。",
    category: "pricing"
  },
  {
    id: "on-premise-and-data-security",
    question: "企业私有数据和客户信息是否会被用于训练公共大模型？",
    answer: "绝不！我们在法律合同与服务契约中承诺：您的企业产品资料、报价单、客户通讯录、交易记录与外联历史属于企业核心资产，仅在您本地工作区和独立隔离的租户环境内处理，绝不用于任何公共大模型的训练，且遵循严格的数据加密与定期清除策略。",
    category: "security"
  },
  {
    id: "system-requirements",
    question: "RenWork 客户端支持哪些操作系统？配置要求如何？",
    answer: "RenWork 支持 Windows 10/11 (64位)、macOS (Apple Silicon M系列及 Intel 芯片) 以及主流 64 位 Linux 发行版。建议电脑配置为 8GB 内存及以上、至少 2GB 可用硬盘空间，能够平稳运行现代主流网页浏览器即可流畅使用。",
    category: "product"
  },
  {
    id: "implementation-service",
    question: "购买后如何开展上线实施与团队培训？",
    answer: "购买增长版及以上套餐后，人人易将为您分配专属实施顾问，提供 1v1 远程实操辅导：协助搭建企业产品 DNA 事实库、调优海关 HS 编码矩阵、配置 OKKI/邮箱/LinkedIn 本地连接，并开展销冠级外贸 AI 拓客实战培训，确保外贸团队在 3 个工作日内跑通首批真实买家开发流程。",
    category: "pricing"
  }
];
