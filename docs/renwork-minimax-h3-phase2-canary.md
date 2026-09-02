# RenWork H3 视频 Phase 2 单组织 Canary SOP

> 状态：**INCOMPLETE**。本阶段只实现并验证 canary 控制面，未执行真实 MetaSO 调用、未产生付费任务、未部署，也未证明供应商书面授权或生产可用性。缺少真实环境、授权证据、供应商任务证据、实际成本对账和人工复核证据时，**不得进入生产灰度**。

## 硬门槛

1. 法务或被授权负责人核验 MetaSO 对 RenWork 多租户、商业化及 OEM 接入的书面授权，并给该证据分配不可变 ID。书面授权未核验时，`RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED` 必须保持关闭，`RENWORK_H3_LIVE_CANARY` 必须保持关闭。
2. 只允许一个明确的预生产试点组织。服务端要求当前组织 ID 与 `RENWORK_H3_CANARY_ORGANIZATION_ID` 精确匹配；组织 capability、全局 gate、授权证据、密钥、价格和结果域任一缺失均 fail closed。
3. 供应商返回 bytes 不得修改。成片交付前必须记录 `AI_GENERATED_PROVENANCE_PRESERVED`；不得移除、篡改 H3 归属、AI 生成或法定标识。
4. 技术成功不等于人工验收。有效成片在 capture 后仍为 `pending_review`；管理员附加真实供应商成本证据后才能批准。系统不得推算、默认或伪造供应商实际成本。

## 仅服务端环境变量

真实值只进入预生产秘密管理，不得写入仓库、客户端、审计响应或日志。

- `RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED`
- `RENWORK_METASO_H3_LICENSE_EVIDENCE_ID`
- `RENWORK_METASO_H3_API_KEY`
- `RENWORK_METASO_H3_BASE_URL`
- `RENWORK_METASO_H3_RESULT_HOSTS`
- `RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND`
- `RENWORK_H3_PRICE_VERSION`
- `RENWORK_H3_LIVE_CANARY`
- `RENWORK_H3_CANARY_ORGANIZATION_ID`

真实 canary 证据规格还要求以下测试专用变量；本地 mock 不设置它们：

- `OPENWORK_EVAL_DEN_API_URL`
- `OPENWORK_EVAL_APP_SPECS`
- `OPENWORK_EVAL_H3_LIVE_CANARY`
- `RENWORK_H3_CANARY_T2V_PROMPT`
- `RENWORK_H3_CANARY_I2V_ASSET_ID`
- `RENWORK_H3_CANARY_T2V_PROVIDER_COST_MICROUNITS`
- `RENWORK_H3_CANARY_T2V_COST_EVIDENCE_REFERENCE`
- `RENWORK_H3_CANARY_I2V_PROVIDER_COST_MICROUNITS`
- `RENWORK_H3_CANARY_I2V_COST_EVIDENCE_REFERENCE`
- `RENWORK_H3_CANARY_PROVIDER_COST_CURRENCY`
- `OPENWORK_EVAL_H3_REVIEWER_EMAIL`
- `OPENWORK_EVAL_H3_REVIEWER_PASSWORD`

## 预生产执行顺序

1. 备份并检查目标数据库，在非生产环境应用 `0071_fluffy_talos.sql`。确认 job 已包含授权证据、AI provenance、供应商实际成本和人工复核字段。
2. 保持全局 gate 关闭，由平台管理员只为已批准试点组织设置 `minimaxH3Video=true`。普通组织管理员不能自行开启 capability。
3. 四眼复核授权证据 ID、精确组织 ID、不可变价格版本和 HTTPS 结果域 allowlist 后，才可在预生产将 live canary gate 设为开启。
4. 先验证文生视频，再验证租户自有首帧生视频。每次只运行 4 秒、768P、单任务；重复提交必须恢复同一 job、一次冻结和一个供应商任务。
5. 有效结果必须依次通过：结果域校验、容器 magic 和大小校验、租户资产持久化、字节哈希复核、记录 AI provenance、RenCredit capture。供应商失败或无效交付必须 release，且不得保留结果资产或 capture。
6. 管理员通过 `PUT /v1/video-generation/admin/jobs/:jobId/cost-evidence` 附加供应商账单中的实际微单位成本、ISO 货币和证据引用。只有人工提供的证据可写入这些字段。
7. 第二位管理员核对供应商任务、RenCredit 结算、结果哈希、租户隔离、授权与成本证据，再通过 `PUT /v1/video-generation/admin/jobs/:jobId/review` 作出 `approved` 或 `rejected`。批准前必须已有完整成本证据；记录成本者不能批准同一任务，复核结果为终态。
8. 导出无密钥的证据包并由法务、财务、产品和运维共同签字。即使单组织 canary 通过，在这一步完成前仍不得进入生产灰度。

普通成员的 job 响应只包含结算状态、AI provenance 状态和 review 状态，不包含授权证据、供应商任务号、实际成本或证据引用。管理员审计可以读取这些治理字段，但永远不能读取 API key。

## 安全释放与停止

- 全局停止：关闭 `RENWORK_H3_LIVE_CANARY`；紧急合规停止还应关闭商业授权 gate。历史 job 与资产仍可读取，但不再推进或创建付费任务。
- 单组织停止：平台管理员撤销该组织 `minimaxH3Video` capability。
- 人工释放只允许 reservation 仍为 reserved、供应商任务号为空且 submission claim 已超过 5 分钟的孤立任务。有供应商任务、未超时、已 capture 或已 release 时必须返回冲突。
- 失败释放先完成账本 release，再删除该 job 的结果资产；capture 与 release 的相反终态冲突不得被覆盖。

## 不付费的本地验证

以下命令只运行合同、mock provider、rollout、路由静态行为和类型检查，不配置 live canary 环境变量：

```bash
pnpm --filter @openwork/minimax-h3-video test
pnpm --dir ee/apps/den-api exec bun test test/minimax-h3-provider.test.ts test/minimax-h3-video-rollout.test.ts test/minimax-h3-phase2-route-contract.test.ts
pnpm --dir evals exec vitest run --config vitest.config.ts --project pr specs/renwork-minimax-h3-video-phase2-canary.test.ts
pnpm exec tsc -p ee/apps/den-api/tsconfig.json --noEmit --pretty false
pnpm --filter @openwork/app typecheck
```

`.slow.test.ts` 是真实付费 canary 证据规格。没有全部真实变量与显式 opt-in 时，它的结论只能是 **INCOMPLETE**；本阶段禁止为了让它变绿而添加凭据或执行真实调用。
