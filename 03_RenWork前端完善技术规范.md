# RenWork 前端完善技术规范

## 1. 基线与不可破坏约束

目标仓库：[`cnproduct/renwork`](https://github.com/cnproduct/renwork)。本文审计基线为 2026-08-22 拉取的 commit `8cf8c63e938e7c5c3302b2bdad0e328ba8dab403`（版本 0.18.43）；实施时以最新仓库和 `AGENTS.md` 为准。

RenWork 是已有成熟 OpenWork monorepo，不是空白 React 项目。Codex MUST：

- 读取根及目标目录 `AGENTS.md`；
- 使用 pnpm，不生成 npm/yarn lockfile；
- 复用 React、Vite、Tailwind 4、现有 shadcn/Base UI、TanStack Query、Zustand、Zod 和 OpenCode SDK；
- 不引入 MUI、Ant Design 或第二套图标/组件系统；
- 不创建绕过现有 server/runtime 的平行后端；
- 保留桌面端、headless web、MCP gateway 和 Den 控制面的既有边界；
- 最小差异实现，避免“顺手重构”无关模块；
- Runtime 行为用 `evals/specs/**/*.test.ts` 和 `@openwork/testkit` 验证；需要应用联调的用 `.slow.test.ts`；
- 按仓库要求围绕 `dev` 分支、spec/tape/PR 流程交付。

## 2. 产品目标

把现有通用 AI 工作台扩展为“企业级外贸增长操作系统”的一体化前端，但不破坏现有 workspace/chat 核心。

关键体验：

1. 用户从企业/产品资料开始，不从空白 prompt 开始；
2. 任一买家结论都能追溯海关证据和来源；
3. 任一联系人都能看到身份匹配与联系方式置信度；
4. 社交互动和邮件由系统建议、用户审批、执行器记录；
5. 团队策略可同步，个人纠偏可成为 Learning PR 候选；
6. 长任务可暂停、取消、重试、解释失败。

## 3. 导航与路由

建议主导航：

| 导航 | 核心对象 | 说明 |
|---|---|---|
| Workspace | 会话/任务 | 保留现有入口与通用工作流 |
| Buyer Discovery | 公司/交易 | 产品图谱、海关查询、买家评分 |
| Contacts | 人/采购委员会 | OKKI/多源导入、去重、验证 |
| LinkedIn 360 | 公司页/个人页/信号 | 匹配、动态、互动任务 |
| Outreach | 线程/序列 | InMail、Zoho、SMTP、回复 |
| Content & Social | 主题/帖子/日历 | 6 语种内容与审批发布 |
| Automations | 工作流/运行 | 触发器、门禁、状态、重试 |
| Assets | 文件/品牌 | 产品手册、图像、模板、证据 |
| Team Intelligence | Skill/Wiki/Learning | 同步、Recall、经验 PR |
| Credits | 用量/账本 | 余额、预估、账单 |
| Settings | 连接器/模型/权限 | Workspace、MCP、账号和安全 |

桌面窄宽度使用可折叠侧栏；移动不是首要运行形态，但窗口最小宽度必须有降级方案，禁止控件被截断。

## 4. 首次使用与 Onboarding

### 4.1 步骤

1. 创建/选择 Workspace；
2. 导入公司官网、公司简介、产品手册和产品图片；
3. 确认产品、市场、语言、HS Code 候选；
4. 配置模型供应商和数据隐私选择；
5. 检查海关、OKKI Local、邮箱、CRM、社媒连接；
6. 选择 TeamAI 团队仓库或“稍后设置”；
7. 运行第一个示例：生成 20 家带证据买家，而不是直接群发。

### 4.2 UX 规则

- 每步可跳过且写清影响；
- 凭证只进入 OS Keychain/既有安全存储；
- 测试连接显示权限、数据范围、响应时间和可修复错误；
- 导入前说明文件去向；
- 用户确认模型生成的 HS Code、认证和市场判断；
- 完成后生成可编辑的 `CompanyProfile` 与 `ProductProfile`。

## 5. Buyer Discovery

### 5.1 页面组成

- `DiscoveryDashboard`：查询配额、活跃项目、近期采购信号、数据覆盖和任务状态；
- `ProductGraphEditor`：产品、材料、应用、HS Code、关键词、认证、竞品；
- `CustomsQueryBuilder`：国家、时间、HS Code、描述、供应商、重量/金额等条件；
- `BuyerTable`：虚拟化表格、保存视图、筛选、排序、批量入池；
- `BuyerDetailDrawer/Page`：公司实体、交易趋势、供应商、证据、评分解释、联系人和下一步。

### 5.2 BuyerTable 必备字段

公司、国家、网站、最近交易、6 个月频率、产品匹配、供应商变化、买家类型、Intent Score、证据数、联系人覆盖、负责人、阶段。

### 5.3 评分可解释性

`Intent Score` 必须展开显示：

- 产品匹配；
- 时间新鲜度；
- 采购频率/增长；
- 供应商变化；
- 买家实体可信度；
- 数据完整性；
- 负向因素（货代、低匹配、证据冲突）。

不得只显示一个神秘数字。证据冲突时状态降为 `Needs review`。

### 5.4 状态

`draft → queued → searching → normalizing → scored → review → accepted/rejected`。每个状态有进度、取消、重试和错误详情；刷新/重启后任务可恢复。

## 6. Contacts 与 OKKI 穿透

### 6.1 双入口

1. 海关买家公司向下找采购委员会；
2. 依据 ICP 使用 OKKI 批量发现新公司/联系人，再由 RenWork 评分。

### 6.2 Local Adapter 流程

- 明确显示“打开可见浏览器”；
- 用户在本地登录 OKKI；
- RenWork 提供搜索条件、字段映射、批次进度；
- 导入前预览，导入后清洗/去重；
- 会话 Cookie 不上传；
- 遇到验证码、条款或权限限制时暂停并交给用户，不规避。

### 6.3 联系人卡片

姓名、当前职位、部门、公司、地区、邮箱/电话/WhatsApp（按权限遮罩）、LinkedIn 候选、来源、采集时间、验证时间、决策角色、置信度、数据主体请求状态。

状态：`Verified`、`Probable`、`Unverified`、`Outdated`、`Suppressed`。

### 6.4 去重

显示合并建议和证据，不静默覆盖。主键策略：provider id > verified email hash > name+company domain+title+location。合并操作进入审计，可撤销。

## 7. LinkedIn 360

### 7.1 公司匹配页

并排显示海关/官网公司与 LinkedIn 候选：公司名、域名、品牌、地点、规模、行业、母子公司和证据。用户可确认或拒绝。

### 7.2 联系人匹配页

姓名、公司、当前职位、任期、地区、职责关键词、共同关系、公开活动；给出理由与冲突点。不能只凭姓名匹配。

### 7.3 信号时间线

公司新品、展会、扩张、招聘、联系人升职/换岗、专业内容、双方互动、采购变化和邮件回复统一时间线。每条保留来源、时间、抓取时间、置信度。

### 7.4 Next Best Action

系统可建议：观察、点赞、评论、连接、InMail、邮件、提醒。界面必须展示：建议理由、使用的信息、草稿、风险、节奏冲突和审批按钮。

LinkedIn 外部动作默认 `draft → awaiting_approval → approved → executing → succeeded/failed`。不得默认批量自动通过。

## 8. Outreach

### 8.1 页面

- Inbox/Replies：统一回复和意图分类；
- Sequences：步骤、间隔、渠道、停止条件；
- Composer：研究侧栏、变量、引用、语言、合规提示；
- Approval Queue：批量审查但逐条可见；
- Deliverability：域名、退信、退订、抑制名单；
- Analytics：按真实发送/回复/会议口径，不用打开率作为唯一成功指标。

### 8.2 Composer

三栏布局：客户情报、编辑器、序列/检查。引用事实可点击回到来源；未经证实事实标黄，禁止自动转为确定语气。

### 8.3 发送门禁

发送前 MUST 检查：收件人、目的、同意/合法依据、抑制名单、退订、频率、工作时间、变量缺失、敏感数据、附件、发件域、审批状态。

回复或退订出现后自动停止序列；外部发送操作使用幂等键，避免重试重复发信。

## 9. Content & Social

### 9.1 Brand Profile

品牌语气、产品事实、禁用表述、目标人群、6 语种、视觉资产和平台规则。品牌资产显示来源版本。

### 9.2 Content Calendar

月/周视图、平台、语言、主题、资产、负责人、审批、预定时间、发布状态。拖拽改期需要撤销；时区明确。

### 9.3 内容编辑器

一个主事实包派生多平台版本；语言版并排审核；图片生成/上传、alt text、裁剪安全区、字符限制、链接 UTM 预览。

### 9.4 发布状态

`idea → drafting → localized → review → approved → scheduled → publishing → published/failed`。未连接 API 的平台使用 `export_ready`，不能标记为 `published`。

## 10. Automations

- 模板化工作流而非无约束画布优先；
- 展示触发器、输入、Skills、MCP、Hooks、审批点、费用预估和输出；
- 每次运行有 trace、步骤状态、输入输出摘要、重试/取消；
- 高成本、外发、删除、CRM 覆盖等步骤必须审批；
- 干运行模式不产生外部副作用；
- 幂等和恢复由运行时保证，前端不能只靠禁用按钮。

## 11. Team Intelligence

### 11.1 Repo Sync

显示团队仓库、分支、最近同步、待更新文件、签名/来源、冲突和回滚。默认只拉取批准分支；禁止执行未信任脚本。

### 11.2 Recall Inspector

任务前展示召回条目、来源文件、匹配理由、版本和敏感级别；用户可排除错误知识。不要把 Recall 隐藏成不可解释的系统提示。

### 11.3 Learning Candidates

从人工改写、失败、反复重试和成功转化中生成候选：原始输出、人工修改、推断规则、适用范围、隐私扫描、建议目标文件。用户确认后才创建 branch/PR。

### 11.4 冲突

团队规则与本地偏好冲突时显示两者来源和优先级；组织安全 Hook 不能被个人静默绕过。

## 12. Credits

- 余额、免费额度、预留、已结算、失败退回、交易明细；
- 任务执行前展示范围与预估，不承诺不可控的精确费用；
- 账本由云端作为事实源，前端 optimistic UI 不得改变余额事实；
- 扣费使用 idempotency key；失败/取消按策略释放预留；
- 导出账单和用量口径。

## 13. Settings

分组：Workspace、Company/Product、Models、Data Sources、OKKI Local、LinkedIn、Email/Zoho/SMTP、CRM、Social、MCP、TeamAI、Privacy & Retention、Notifications、Advanced。

每个连接器统一状态：`not_configured`、`testing`、`connected`、`degraded`、`expired`、`disabled`。显示权限范围、最近成功、最近错误、重新授权和删除连接。

## 14. 前端技术结构建议

先适配现有目录和路由，不为符合本文强行大搬迁。新业务可按 feature vertical slice：

```text
features/
  buyer-discovery/
    components/
    queries/
    schemas/
    state/
    routes/
    __tests__/
  contacts/
  linkedin-360/
  outreach/
  social/
  team-intelligence/
```

### 14.1 状态规则

- 服务端/异步数据：TanStack Query；
- 跨页面 UI 状态：现有 Zustand store；
- 表单：现有表单模式 + Zod；
- URL 保存筛选、分页和 tab，便于深链；
- 不把大列表和服务器事实复制进全局 store；
- IPC/SDK 返回值先做 schema 校验。

### 14.2 组件规则

先搜索并复用现有 Button、Dialog、Drawer、Table、Toast、Command、Form、EmptyState、ErrorBoundary。新增组件提供：默认/hover/focus/disabled/loading/error/empty/dense/dark 状态。

### 14.3 长任务体验

- 立即返回 task id；
- 状态机而非无限 spinner；
- 步骤和已完成数量；
- 可取消/重试；
- 应用重启后恢复；
- 错误提供 code、可修复动作和日志复制，但不泄密。

## 15. 性能要求

- 买家/联系人表格虚拟化；
- 详情抽屉按需加载；
- 图表聚合在 worker/后端，不在渲染循环计算；
- 避免整棵应用订阅高频任务进度；
- 图片生成缩略图和懒加载；
- 大型产品目录解析显示后台进度；
- 为搜索输入 debounce，为昂贵请求取消旧请求；
- 用现有 profiler/bundle 工具确认新增依赖影响。

## 16. 安全与合规 UX

- PII 字段按角色遮罩，复制/导出可审计；
- 密钥输入后不回显完整值；
- 删除/覆盖/群发/社媒互动需要清晰确认；
- 提供抑制、删除、纠错和数据来源入口；
- Hook 拦截显示规则来源、原因和整改方法，不能只报“失败”；
- 所有演示数据显式标识 Demo；
- 高风险功能默认关闭，通过 feature flag/企业策略开启。

## 17. 测试矩阵

| 层 | 范围 | 通过标准 |
|---|---|---|
| Unit | schema、评分展示、状态机、去重策略 | 边界与错误分支覆盖 |
| Component | 表格、Drawer、Composer、审批 | 键盘、loading/error/empty |
| Runtime tape | Skill/MCP/任务行为 | `@openwork/testkit` 断言结果 |
| Slow app | IPC、持久化、重启恢复、真实界面 | `.slow.test.ts` 按仓库规范 |
| E2E | 产品导入→买家→联系人→草稿 | 无未授权外部副作用 |
| Accessibility | 键盘、焦点、对比度、语义 | 无关键违规 |
| Security | 凭证、日志、权限、外发门禁 | 无明文密钥/越权 |

## 18. RenWork 完成定义

- 现有 Workspace/Chat 无回归；
- 新导航和功能支持浅色/深色、常见桌面尺寸和键盘；
- 买家、联系人、信号、外联均有来源/状态/置信度；
- OKKI 与 LinkedIn 流程保留本地、可见、人在回路；
- 邮件/社媒外发有审批、抑制、幂等和审计；
- TeamAI 同步、Recall 与 Learning PR 可解释、可撤销；
- 无第二套 UI/运行时/后端；
- 相关 unit、runtime tape、slow app test 通过；
- 生成 GitHub Release 的现有流程未被网站部署逻辑污染。

