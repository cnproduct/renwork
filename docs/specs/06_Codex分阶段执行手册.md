# Codex 分阶段执行手册

## 1. 使用方式

本文件不是让 Codex 一次性“大改全部”。每一阶段使用独立任务、工作树/分支、验收和 PR。官网和 RenWork 必须分开会话或至少分开工作树，避免把部署文件写进桌面端仓库。

推荐会话：

- Session A：`rrenn-website`；
- Session B：`renwork`；
- Session C（后期）：TeamAI 治理仓库；
- 云端部署只在代码和 staging 验收后进行，并需明确授权。

Codex 官方行为依据：[AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md)、[Skills](https://developers.openai.com/codex/build-skills) 和 [Best practices](https://developers.openai.com/codex/learn/best-practices)。

## 2. 全局执行规则

1. 先读本包 README、目标章节、仓库 `AGENTS.md`、README 和 package scripts。
2. 先 `git status --short`，用户已有改动不得覆盖。
3. 不使用已暴露密码；部署只能用新 SSH key 和 port 2222。
4. 不创建未授权的远程 repo、DNS、云资源、外发邮件或 LinkedIn 操作。
5. 先写/更新测试，再实现最小代码；每阶段留下可运行证据。
6. 所有事实声明、价格、客户案例、Logo 需要内容/品牌审批。
7. 出现平台权限、条款、验证码、未知 DNS、敏感凭证时停止并请求用户处理，不绕过。
8. 结束时列出：改动文件、测试、未完成项、部署影响、回滚方法。

## 3. P0：发现、安全和资产确认

### 目标

建立不会误覆盖现网、误用 Logo、误泄密的工作基础。

### 官网任务

- 检查建议官网仓库是否实际存在；不存在时仅在获授权后创建远端，否则本地 scaffold；
- 审计现有 rrenn.com 的 DNS、HTTP/HTTPS、Nginx、页面、robots、sitemap；
- 备份现有站点与相关配置；
- 建立内容事实清单：价格、客户、数字、认证、合作方；
- 获取正式 Logo SVG、favicon 和品牌批准；
- 轮换暴露密码，验证 SSH key port 2222。

### RenWork 任务

- 读取所有适用 `AGENTS.md`；
- 运行基线 lint/test/build（按仓库脚本）；
- 盘点 app shell、导航、design tokens、现有品牌标记、MCP/Den/runtime；
- 给计划修改点建立截图和组件清单；
- 确认 RenWork 正式产品 Logo。

### 验收

- 没有生产写操作；
- 现状和拟变更形成报告；
- 秘密扫描无新增；
- 明确 repo、branch、部署和回滚责任人；
- Logo 与价格未确认项被阻塞而非猜测。

### 可直接给 Codex 的任务提示

```text
你在执行 P0，只做只读审计和本地文档/测试基线，不部署、不修改 DNS、不创建远程仓库。
先阅读 README.md、00、02、04、06 文档以及仓库所有适用 AGENTS.md。
检查 git status 并保护现有修改。输出：现状架构、风险、需要用户确认的资产/权限、基线测试、下一阶段最小补丁计划。
任何密码都不得输出或保存；SSH 只记录 host、user、port 2222 和待配置的 secret 名称。
```

## 4. P1：官网工程骨架和设计系统

### 目标

建立可本地运行、可测试、可容器构建的官网骨架。

### 实现

- Next.js App Router + TypeScript + Tailwind，选择实施时稳定版本并锁定 lockfile；
- pnpm、ESLint、Prettier、Vitest、Playwright、axe、Lighthouse CI；
- `output: standalone`、多阶段 Dockerfile、health routes；
- Header/Footer、Button、Typography、Container、Section、Card、Form、Badge；
- 自托管字体、品牌 token、light theme 为主；
- content/MDX 模型、route metadata、robots、sitemap、404/500；
- `.env.example` 只包含占位变量；
- 根 `AGENTS.md` 写入仓库边界、命令、测试和安全规则。

### 验收

- `pnpm lint/typecheck/test/build` 全绿；
- Docker 本地 healthcheck；
- 360/768/1440 基础响应；
- axe 无严重问题；
- Logo 只使用批准资产；
- 无 Google Fonts、无密钥、无远程生产写入。

### Codex 提示

```text
实现 rrenn.com P1 工程骨架。严格依据 00、01、04、05、06；先检查仓库和 AGENTS.md。
创建 Next.js App Router + TypeScript + Tailwind 的最小生产骨架，使用 pnpm 和当前稳定版本并提交 lockfile。
实现 token、字体、Header/Footer、基础组件、metadata、robots、sitemap、错误页、health、standalone Docker 与 CI。
不要创建生产 DNS/服务器变更；不要自行重画 Logo；用批准资产，否则放明确占位并阻塞发布。
完成后运行全部检查并报告结果。
```

## 5. P2：官网核心页面与获客闭环

### 目标

上线可信官网 MVP。

### 实现顺序

1. 首页；
2. 产品总览与六个能力页；
3. Solutions 与前三个行业页；
4. Pricing 单一数据源；
5. Diagnosis/Contact 表单；
6. 法律页面；
7. Cases/Insights 初始内容；
8. SEO/GEO 和 analytics consent。

### 验收旅程

- 访客从首页理解产品并进入 Buyer Intent；
- 从行业页进入诊断，提交后生成一条线索与同意记录；
- 重复提交使用幂等键；外部 CRM 故障不丢主记录；
- 未同意隐私不能提交，营销同意可不勾；
- 页面没有 `alert()` 占位和假实时数据；
- sitemap、canonical、structured data、404、内链通过。

### Codex 提示

```text
实现 rrenn.com P2。以 01 的页面模块和 04 的视觉规范为验收依据。
先完成首页、产品页、solutions、pricing、diagnosis/contact、法律页；内容使用 MDX/结构化配置。
实现线索 API：Zod、Captcha、rate limit、honeypot、idempotency、同意版本、审计 id；CRM/通知用可重试 adapter，不影响主记录。
所有价格/客户/数字标记审批状态，未批准不得进入 production content。
加入 Playwright、axe、Lighthouse、structured data 和表单错误/重试测试。
```

## 6. P3：下载、文档、内容运营与 staging

### 实现

- 下载页、签名 Release manifest、GitHub Release 规范源、COS 镜像；
- Docs 目录/搜索/版本；
- Cases、Insights、Training 模型；
- staging 域名与腾讯云 Docker 部署；
- 备份、监控、告警和回滚演练。

### 验收

- 每个安装包显示版本、大小、SHA-256 和来源；
- COS 镜像 hash 与 GitHub artifact 一致；
- staging 从镜像 digest 发布，不在服务器构建；
- 表单和下载端到端可用；
- 回滚到前一个镜像在目标时间内完成；
- robots 对 staging noindex，生产切换后解除。

### Codex 提示

```text
实现官网 P3，先阅读 02 和 05。不要改 RenWork 构建逻辑，只消费经过签名/校验的 GitHub Release manifest。
增加 downloads/docs/cases/insights/training；实现 COS 镜像状态和 GitHub fallback。
补齐 Docker/GitHub Actions/staging 部署，Action 权限最小且第三方 action 固定 SHA。
部署只用 SSH key、known_hosts 和 port 2222；不使用会话里出现过的密码。
先在 staging 完成健康、表单、下载、SEO、备份和回滚验收，再提出生产切换清单。
```

## 7. P4：RenWork Shell 与企业产品理解

### 目标

在不破坏现有 Workspace 的前提下加入外贸主导航、Onboarding、Company/Product Profile。

### 实现

- feature flag 包住新导航；
- Company/Product schema 与来源/确认状态；
- 导入官网/手册/图片的任务状态；
- 连接器健康页；
- 复用现有 component/query/store/runtime；
- runtime tape 与 app slow tests。

### 验收

- 现有功能基线不回归；
- 断网可查看本地 Profile；
- HS Code/认证候选需用户确认；
- 文件和凭证去向清晰；
- 重启后 Onboarding/任务可恢复。

### Codex 提示

```text
在 cnproduct/renwork 中实现 P4。先完整读取所有适用 AGENTS.md 和 03/04/05/06。
保留现有 Workspace/Chat；用 feature flag 添加新导航、Onboarding、CompanyProfile、ProductProfile 和连接器状态。
复用现有 Tailwind/Base UI/TanStack Query/Zustand/Zod/OpenCode SDK，不引入第二套 UI 或平行 server。
Runtime 行为用 @openwork/testkit tape，应用联调用 .slow.test.ts；按仓库 dev/PR 流程交付。
```

## 8. P5：买家与联系人闭环

### 实现

- Product Graph、Customs Query Builder、Buyer Table/Detail、可解释评分；
- OKKI Local Adapter 可见流程、导入预览、清洗/去重；
- Contacts/Buying Committee、来源与验证；
- 长任务、取消、恢复、错误码和 Credits 预估。

### 验收

- 使用合成 fixture 完成产品→海关→A/A+买家→3–8 联系人；
- 每个评分/联系人可回到证据；
- OKKI Cookie 不上传，验证码时暂停；
- 去重可审查、可撤销；
- 无无限列表/无限请求或外部副作用。

## 9. P6：LinkedIn 360 与 Outreach

### 实现

- 公司/联系人匹配、冲突、置信度；
- 信号时间线和 Next Best Action；
- Composer、Sequence、Approval Queue、Zoho/SMTP adapter；
- 退订、抑制、频率、时区、幂等、回复停止；
- Hooks 门禁与审计。

### 验收

- Unverified 联系人不能默认外发；
- LinkedIn 点赞/评论/连接/InMail 默认人工确认；
- payload 改变后审批失效；
- 退订/回复后停止；
- provider 超时重试不重复发送；
- 日志不含邮箱正文、token、Cookie。

### Codex 提示

```text
实现 RenWork P6，依据 03 的 LinkedIn 360/Outreach 和 05 的审批、事件、安全契约。
所有 LinkedIn 动作和邮件发送默认先生成建议/草稿并等待用户确认；不实现绕过验证码、限流或平台限制。
实现来源、置信度、抑制、频率、时区、审批 payload hash、幂等与审计。
先使用 mock provider 和合成联系人跑通 runtime tape；未经明确授权不要连接真实账号或发送真实消息。
```

## 10. P7：社媒矩阵与 TeamAI 进化闭环

### 实现

- 6 语种 Brand Profile、Content Calendar、审批、平台状态；
- TeamAI repo sync、manifest 校验、Recall Inspector；
- Learning Candidate、隐私扫描、PR 草稿；
- Hooks 来源和冲突 UI。

### 验收

- 未连接平台显示 export_ready；
- 多语种有本地化检查；
- TeamAI secret 只引用名称；
- Recall 可见来源和版本；
- Learning 只创建候选，用户确认才产生 PR；
- 组织 blocking Hook 不能被个人覆盖。

## 11. P8：生产切换

前置条件：P0–P3 官网验收；P4–P7 可按产品节奏独立发布，官网不等待所有桌面功能。

### 切换清单

- 生产域名和备案/法律页确认；
- 正式 Logo、价格、案例、联系方式确认；
- DNS TTL 300，旧站备份；
- production GitHub Environment 审批；
- 数据库备份与恢复演练；
- HTTPS、CSP、监控、告警、Captcha；
- 国内/海外检查；
- 30 分钟和 24 小时观测；
- 回滚 owner 在线。

任何 DNS 归属不明、证书失败、备份不可恢复、秘密未轮换或表单丢失均为 stop-ship。

## 12. PR 模板

```markdown
## 目标

## 范围
- In scope:
- Out of scope:

## 依据
- 文档章节：
- AGENTS.md：
- 设计/接口版本：

## 变更

## 测试
- [ ] lint/typecheck
- [ ] unit
- [ ] runtime tape / app slow / Playwright
- [ ] accessibility
- [ ] security/secret scan

## 数据与迁移

## 安全/隐私/外部副作用

## 截图或录屏

## 发布与回滚

## 待确认
```

## 13. Codex 最终交付格式

每个阶段最终回答必须包含：

1. 结果：已实现什么；
2. 关键文件：可点击路径；
3. 验证：实际运行命令与结果；
4. 未验证：需要真实账号/云权限/内容批准的部分；
5. 风险：数据迁移、平台条款、兼容性；
6. 部署：是否已部署，部署版本/环境；
7. 回滚：明确方法；
8. 下一步：一个最小可执行批次。

不得只说“完成”，不得用截图代替运行时测试，不得声称执行了未实际执行的部署或外部动作。

## 14. 最终系统验收场景

使用合成数据和测试账号完成：

1. 网站访客阅读行业页并提交诊断；
2. 线索入 `rrenn_web`，通知/CRM 可重试；
3. 用户下载签名的 RenWork 安装包；
4. RenWork 导入企业与产品，确认候选知识；
5. 海关查询得到带证据买家并分级；
6. OKKI Local 导入联系人，去重并建立采购委员会；
7. LinkedIn 公司/人员匹配，未确认项不进入外联；
8. 系统建议互动和个性化邮件；
9. 用户审批后由 mock/测试 provider 执行，回复/退订停止序列；
10. 人工修改形成 Learning Candidate，经审查成为 TeamAI PR；
11. 官网和 RenWork 分别回滚，不互相影响。

该场景全部可追溯、可解释、可取消、可恢复、无秘密泄漏，才可称为“企业级外贸增长操作系统”的技术闭环。

