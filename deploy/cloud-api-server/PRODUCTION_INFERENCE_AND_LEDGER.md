# RenWork 生产推理网关与多租户账本 SOP

## 架构边界

- RenWork Den API 的 `POST /api/v1/chat/completions` 是用户推理入口，兼容 OpenAI Chat Completions。
- 租户和成员身份只能由 `rw_inf_*` 推理密钥的哈希反查获得；请求体和自定义组织 Header 均不参与租户判定。
- 8089 模型目录服务保存超级管理员发布的模型、费率和路由；普通用户响应不含供应商、Base URL 或 Secret 引用。
- MySQL/PlanetScale 保存组织钱包、冻结单、供应商用量事件和不可变账本流水。金额统一使用 RenCredit 微单位，`1 RenCredit = 1,000,000 microcredits`。

## 上线前门禁

1. 备份生产数据库，并确认 Den API 与目录服务当前健康版本及回滚镜像。
2. 通过正式 migration job 执行 RenCredit 迁移。独立 RenWork `dev` 线使用 `0067_adorable_leper_queen.sql`；与腾讯云正式认证库的 `0067_moaning_human_fly.sql` 合并发布时，必须按时间顺序改为 `0068_adorable_leper_queen.sql`。不要在应用启动命令中自动迁移。
3. 在目录服务注入 `RENWORK_SUPER_ADMIN_TOKEN`，在 Den API 注入同值的 `RENWORK_MODEL_CATALOG_ADMIN_TOKEN` 与目录服务 HTTPS 地址。
4. 将目录中每个 `env://NAME` 对应的 `NAME` 注入 Den API；`secret://path/name` 对应运行时变量 `RENWORK_SECRET_PATH_NAME`。Secret 不得写入仓库、网页构建变量或桌面端。
5. 发布并复查 active 目录；至少保留一个 `openai_compatible` 或 `opencode` 的健康路由。当前首版生产转发支持这两种 OpenAI 兼容协议。
6. 完成灰度测试后，才把 `INFERENCE_PROXY_BASE_URL` 设置为 Den API 自身的公网 HTTPS Origin，使新签发的 RenWork Models 配置进入正式网关。

## 初始化组织余额

平台管理员登录 Den 后调用：

```bash
curl -X POST "$DEN_API_ORIGIN/v1/admin/rencredit/grants" \
  -H "Authorization: Bearer $DEN_ADMIN_SESSION" \
  -H "Content-Type: application/json" \
  --data '{
    "organizationId":"org_...",
    "amountMicroCredits":100000000,
    "idempotencyKey":"initial-grant-org-...-v1",
    "reasonCode":"INITIAL_SUBSCRIPTION_GRANT"
  }'
```

同一组织和 `idempotencyKey` 重试不会重复入账。正式运营应由支付/订阅 webhook 生成稳定的幂等键，不允许前端直接调用 grant。

## 灰度验收

每次推理必须使用稳定且唯一的 `Idempotency-Key`：

```bash
curl -N -X POST "$DEN_API_ORIGIN/api/v1/chat/completions" \
  -H "Authorization: Bearer $RENWORK_INFERENCE_KEY" \
  -H "Idempotency-Key: acceptance-run-001" \
  -H "X-RenWork-Run-Id: acceptance-run-001" \
  -H "Content-Type: application/json" \
  --data '{"model":"renwork-standard","messages":[{"role":"user","content":"Reply with OK"}],"max_tokens":16,"stream":true}'
```

验收必须同时检查：

- 返回模型名仍为 RenWork SKU，不出现上游模型名或供应商 Secret。
- 成功且有结果：冻结单为 `captured`，以供应商上报 Token 结算，多余冻结自动释放。
- 上游失败、空响应、流中断或用户取消：冻结单为 `released`，不扣费。
- 相同幂等键重试：只存在一个 reservation 和一组结算流水。
- A 租户密钥无法读取或影响 B 租户的钱包、冻结单、用量事件和账本。
- `GET /v1/rencredit/wallet` 返回当前组织余额；管理员可用 `GET /v1/rencredit/ledger?limit=50` 核对流水。

## 回滚

应用回滚时把 `INFERENCE_PROXY_BASE_URL` 切回上一版已验证网关并恢复上一镜像。保留 0067 表和所有账本数据，不做向下迁移、不删除流水。停止新请求后，对遗留 `reserved` 记录执行审计和人工释放，再恢复流量。
