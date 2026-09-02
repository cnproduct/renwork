# RenWork H3 视频 Phase 1 运维 SOP

Phase 1 是单路由灰度：仅开放文生视频与首帧生视频、768P、4–8 秒、每位成员一个并发任务。供应商凭据只存在于 Den 服务端；桌面端、成员响应、日志和 Skill 都不得包含凭据。

## 上线前硬门槛

1. 取得供应商针对 RenWork 多租户商业使用、转售或 OEM 场景的书面授权。在此之前，`RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED` 必须保持 `false`。
   当前 MetaSO 用户协议限制个人服务的转售/出租，并要求保留 H3 归属或 AI 生成标识；未取得覆盖 RenWork 商业场景的书面授权不得开启。系统不得移除、篡改供应商返回成片中的法定、平台或 AI 来源标识。
2. 在非生产环境完成 migration、mock provider、RenCredit reserve/capture/release 和租户隔离测试。
3. 本阶段代码合并不等于生产上线。迁移生产数据库、配置生产密钥、开启组织灰度和部署服务都需要独立变更审批。

## 服务端环境变量

只配置名称对应的秘密管理项，不把真实值写入仓库、客户端或工单截图。

- `RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED`：只有书面商业授权核验完成后才能设为 `true`。
- `RENWORK_METASO_H3_API_KEY`：Den 服务端凭据。
- `RENWORK_METASO_H3_BASE_URL`：可选；未配置时使用集成默认地址。
- `RENWORK_METASO_H3_RESULT_HOSTS`：逗号分隔的结果下载域名精确 allowlist，不支持通配符。
- `RENWORK_H3_RENCREDIT_MICROCREDITS_PER_SECOND`：每秒 RenCredit 微单位，必须是正整数。
- `RENWORK_H3_PRICE_VERSION`：不可变价格版本；改价时生成新版本，不能覆盖旧任务收据。

任一商业授权、服务端凭据、结果域 allowlist 或价格配置缺失时，成员 capability 会 fail closed。

## 数据库与灰度顺序

1. 备份并检查目标数据库状态。
2. 在非生产环境运行 `pnpm --dir ee/packages/den-db db:migrate`，应用 `0070_sturdy_the_liberteens.sql`。
3. 部署 Den 与桌面端候选版本，但保持全局商业授权 gate 为 `false`。
4. 平台管理员使用 `PUT /v1/admin/organizations/:organizationId/capabilities` 写入：

   ```json
   { "capabilities": { "minimaxH3Video": true } }
   ```

   只有平台 admin API 可以修改该字段；普通组织管理员不能自助开启。
5. 商业授权、价格版本、结果域和密钥全部复核后，才可在批准的环境中开启全局 gate，并仅选择一个测试组织灰度。
6. 用测试组织验证：报价不冻结、确认只冻结一次、刷新恢复同一任务、有效容器与哈希落库后才 capture、拒绝/失败/空交付 release、管理员审计不含密钥。

## 回滚

- 单组织回滚：平台管理员将 `minimaxH3Video` 设为 `false` 或 `null`。
- 全局紧急停止：将 `RENWORK_METASO_H3_COMMERCIAL_LICENSE_CONFIRMED=false` 并滚动重启 Den。
- 对 claim 已超过 5 分钟、仍无供应商任务号且仍为 reserved 的孤立任务，具备目标组织 admin 身份的运维管理员调用 `POST /v1/video-generation/admin/jobs/:jobId/release`；有供应商任务号、claim 未超时或已经结算的任务会返回 409，不得再次提交供应商任务，以避免重复计费。
- 已成功交付并 capture 的任务不能通过回滚接口 release；需要单独走审核退款流程。

## 本地 mock 验证

这些命令不调用真实付费接口：

```bash
pnpm --filter @openwork/minimax-h3-video test
pnpm --dir ee/apps/den-api exec bun test test/minimax-h3-provider.test.ts test/minimax-h3-video-rollout.test.ts test/organization-capabilities.test.ts
pnpm exec tsc -p ee/apps/den-api/tsconfig.json --noEmit
pnpm exec tsc -p apps/app/tsconfig.json --noEmit
```

持久化账本测试需要专用 MySQL 测试库；未提供变量时会明确 skip：

```bash
RENCREDIT_LEDGER_TEST_DATABASE_URL=mysql://... pnpm --dir ee/apps/den-api exec bun test test/minimax-h3-product-ledger-mysql.test.ts
```

真实供应商调用与生产部署不属于 Phase 1 本地验证，未经书面授权和部署审批不得执行。
