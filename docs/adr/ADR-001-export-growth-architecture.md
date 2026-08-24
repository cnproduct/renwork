# ADR-001: RenWork 外贸企业增长操作系统混合运行时与数据主权架构决策

## 1. 状态 (Status)
**已采纳 (Accepted)** - 2026-08-24

## 2. 架构上下文与设计原则 (Context & Principles)
RenWork 采用“本地确定性数据底座 + 声明式业务技能编排 + 单一 Stdio 协议网关 + 官方扩展生态 + 增值云能力协同 + 独立业务价值账本”的混合架构。

### 核心解耦决策：
1. **确定性逻辑与概率生成的解耦**：客户主记录、评分衰减、8大队列准入、账务变更等关键业务状态由强类型领域模型 (`@openwork/export-growth-domain`) 确定性处理，大模型仅用于意图理解与交互编排，严禁直接覆写真实账本。
2. **本地主权数据与增值云服务的解耦 (D0-D3 四级出域边界)**：
   - **D0（本地受限原始数据）**：客户主记录、联系人 PII、邮件正文、报价单底牌成本，存储于本地独立 SQLite，**绝对禁止出域**；
   - **D1（明示任务最小载荷）**：单次显式授权，仅在用户发起特定付费增值任务时发送最小必要字段；
   - **D2（去标识学习特征）**：Opt-in 机制，经哈希去标识与分桶裁剪后异步上传结构化特征；
   - **D3（同群组聚合基准）**：仅在满足同群组最小样本阈值（$\ge 20$ 家独立企业且 $\ge 100$ 次事件）时全网单向下发。
3. **模型推理算力与业务增值价值的解耦**：
   - 用户自带模型密钥 (BYOK) 与 Token 计划直接由底层模型计算；
   - 官方增值能力统一通过业务价值单位 **RenCredit** 双轨复式记账，两者物理隔离。
4. **云端 2C4G 敏捷部署与内存硬隔离**：
   - 针对腾讯云 2C4G (2 vCPU, 4GB RAM, 60~80GB NVMe SSD) 环境，配置 4GB NVMe Swap 分区、`vm.swappiness=10`、`vm.overcommit_memory=1`；
   - Nginx (128M), Den API (800M, `--max-old-space-size=640`), Async Worker (400M, `--max-old-space-size=320`), MySQL 8.0 (1300M, `innodb_buffer_pool_size=1024M`), Redis 7 (280M)。

## 3. 领域核心纯函数与数学模型
- **指数半衰期时间衰减算法**：$W_{\text{effective}}(t) = W_{\text{base}} \times \exp\left(-\ln(2) \cdot \frac{t - t_{\text{event}}}{\tau_{\text{half\_life}}}\right)$
- **多维优先级模型**：
  $$S_{\text{base}} = 0.20 S_{\text{value}} + 0.25 S_{\text{intent}} + 0.15 S_{\text{timing}} + 0.15 S_{\text{stage}} + 0.10 S_{\text{reachability}} + 0.15 S_{\text{history}}$$
  $$B_{\text{interaction}} = \min\left(10, 10 \times \frac{S_{\text{value}}}{100} \times \frac{S_{\text{timing}}}{100}\right)$$
  $$P_{\text{risk}} = \min(100, S_{\text{risk}} \times 1.2)$$
  $$P_{\text{raw}} = \text{clamp}(S_{\text{base}} + B_{\text{interaction}} - P_{\text{risk}}, 0, 100)$$
  $$P_{\text{dynamic}} = P_{\text{raw}} \times (0.70 + 0.30 \times C_{\text{evidence}})$$
- **八大动态工作队列**：`TODAY_MUST_FOLLOW`, `QUOTE_STALLED`, `SAMPLE_FEEDBACK_DUE`, `REPURCHASE_WINDOW`, `HIGH_ENGAGEMENT_NO_INQUIRY`, `SUPPLY_SHIFT`, `REACTIVATED_DORMANT`, `HIGH_SCORE_LEAK`。
- **Hard Stop 风险熔断**：合规退订、出口管制黑名单、90天严重逾期、主联系人硬退信，100% 阻断自动化营销。
