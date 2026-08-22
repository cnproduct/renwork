# rrenn.com × RenWork：Codex 建设文档包

版本：V1.0  
日期：2026-08-22  
用途：作为 Codex 分仓库建设 `rrenn.com` 官网与 `cnproduct/renwork` 桌面端前端的唯一实施入口。

## 1. 先读结论

- `rrenn.com` 是公开官网、产品说明、获客入口、文档与下载中心，部署在腾讯云。
- `RenWork` 是本地优先的外贸 B2B AI 数字员工桌面端，源代码、CI 和桌面安装包继续由 GitHub 仓库管理。
- 官网不得直接复制或引用 RenWork `apps/app` 的源代码；两者只通过版本化 API、JSON 清单、品牌资产和深链接协作。
- GitHub 上目前确认存在的是 [`cnproduct/renwork`](https://github.com/cnproduct/renwork)。本文中的 `cnproduct/rrenn-website` 是**建议新建的仓库名**，不是已存在事实，也不代表已获得创建权限。
- 腾讯云不运行 OKKI、LinkedIn 可见浏览器或 Electron 桌面流程；这些保留在用户本地的 RenWork Local。云端只承担官网、轻量业务 API、线索、内容、更新清单和可审计的后台任务。
- 用户此前在会话中暴露过服务器密码。执行部署前必须先轮换密码，并改用 SSH 密钥；本文不保存或重复任何密码。

## 2. 文档阅读顺序

| 顺序 | 文档 | Codex 使用场景 |
|---:|---|---|
| 1 | [00_总体架构与仓库分工.md](./00_总体架构与仓库分工.md) | 理解边界、部署拓扑、数据归属和阶段目标 |
| 2 | [01_rrenn网站PRD与页面功能规范.md](./01_rrenn网站PRD与页面功能规范.md) | 创建官网路由、页面模块、内容模型和验收用例 |
| 3 | [02_腾讯云部署与运维规范.md](./02_腾讯云部署与运维规范.md) | 配置腾讯云、Nginx、TLS、CI/CD、备份与回滚 |
| 4 | [03_RenWork前端完善技术规范.md](./03_RenWork前端完善技术规范.md) | 在现有 RenWork monorepo 中扩展桌面端产品功能 |
| 5 | [04_品牌设计系统与前端美化规范.md](./04_品牌设计系统与前端美化规范.md) | 统一品牌、颜色、排版、组件、动效与响应式体验 |
| 6 | [05_接口数据与安全契约.md](./05_接口数据与安全契约.md) | 定义官网、云 API、RenWork 和 TeamAI 之间的稳定契约 |
| 7 | [06_Codex分阶段执行手册.md](./06_Codex分阶段执行手册.md) | 按阶段给 Codex 下达任务、测试、审查和发布 |

相关背景文档：`RenWork_Local_TeamAI_生态技术架构与Codex实施规范_V1.1.md`。本包聚焦网站、云端部署、RenWork 前端和二者接口；若与背景文档冲突，以本包更具体的仓库边界、安全要求和验收标准为准。

## 3. 规范词

- **MUST**：不满足即不得合并或发布。
- **SHOULD**：原则上执行；偏离必须在 PR 中说明原因和风险。
- **MAY**：可按工期选择。
- **PROPOSED**：建议项，尚未确认已经存在或获得外部权限。
- **AS-IS**：2026-08-22 的现状观察，不是目标状态。

## 4. Codex 开工前的硬门槛

1. 阅读目标仓库根目录及子目录的 `AGENTS.md`；更深层文件优先。
2. 先检查工作树状态，保护用户已有修改，不进行重置或覆盖。
3. 官网仓库如未创建，Codex 只能给出初始化补丁或在本地创建；没有明确授权时不得创建远程 GitHub 仓库、DNS 记录或云资源。
4. RenWork 必须遵循现有仓库的 `dev` 分支、pnpm、TypeScript、测试带和组件复用规范。
5. 不得把密码、SMTP 授权码、OKKI 凭证、OAuth token、客户 PII 写入 Git、日志、前端包或文档。
6. 每阶段先有可运行验收，再进入下一阶段；不得同时重构官网、RenWork 核心运行时和云端数据层。

## 5. 推荐交付批次

| 批次 | 范围 | 可发布结果 |
|---|---|---|
| P0 | 安全、DNS、品牌资产、现状备份 | 可回滚的部署基础和唯一品牌基线 |
| P1 | 官网骨架、核心页面、线索表单 | 可公开访问的可信官网 MVP |
| P2 | 下载、文档、案例、SEO/GEO | 可持续运营的内容与获客中心 |
| P3 | RenWork 导航与工作台重构 | 可用的一体化精准客户开发工作台 |
| P4 | 海关→OKKI→LinkedIn→邮件闭环 | 人在回路、可审计的客户开发流程 |
| P5 | TeamAI 治理、Recall、学习回流 | 团队级技能与知识进化系统 |

## 6. 全局完成定义

- 官网 `www.rrenn.com` HTTPS 正常，根域 301 到 `www`，无 DNS 分流冲突。
- 核心 Web Vitals、键盘操作、表单、SEO、隐私同意、错误恢复均有自动化验收。
- 官网宣传中的数字、客户名、案例、认证、价格和实时状态均有内容负责人审批；不得制造虚假“实时匹配”数据。
- RenWork 新功能复用现有运行时、状态管理和设计系统；不引入第二套 UI 框架或平行后端。
- LinkedIn 点赞、评论、连接和 InMail 等高风险外部动作必须由用户最终确认。
- GitHub Actions 只使用受限权限、环境审批、密钥和已固定版本的依赖/Action；生产发布可回滚。
- 腾讯云与 RenWork 本地职责可独立扩容、独立停机、独立回滚。

## 7. 权威参考

- [Codex：AGENTS.md](https://developers.openai.com/codex/agent-configuration/agents-md)
- [Codex：Skills](https://developers.openai.com/codex/build-skills)
- [Codex：Best practices](https://developers.openai.com/codex/learn/best-practices)
- [Next.js：Self-hosting](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js：Standalone output](https://nextjs.org/docs/pages/api-reference/config/next-config-js/output)
- [GitHub：发布 Docker 镜像](https://docs.github.com/actions/guides/publishing-docker-images)

