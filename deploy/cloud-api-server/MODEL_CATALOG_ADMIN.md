# RenWork 模型与 RenCredit 管理面

## 权限边界

- 普通成员只调用 `GET /v1/models/catalog`，响应不包含供应商、Base URL、路由或密钥引用。
- 超级管理员通过服务端管理通道调用 `GET/PUT /v1/admin/models/catalog`。
- `RENWORK_SUPER_ADMIN_TOKEN` 只能注入云端服务，禁止写入桌面端、网页包、仓库或管理目录 JSON。
- 供应商配置里的 `credentialRef` 只允许 `env://...` 或 `secret://...`，不接受原始 API Key。

## 临时环境变量注入

```bash
export RENWORK_SUPER_ADMIN_TOKEN='替换为独立生成的长随机令牌'
export OPENROUTER_API_KEY='替换为供应商 API Key'
export DATA_PATH='/var/lib/renwork/cloud-state.json'
pnpm --filter renwork-cloud-api build
pnpm --filter renwork-cloud-api start
```

生产环境应把以上值放入腾讯云 Secret/服务进程环境，不写入 shell profile。更换供应商时新增独立的 Secret 名称，并在目录中保存 `env://SECRET_NAME` 引用。

## 更新目录

1. 使用管理员接口读取当前目录和 `version`。
2. 修改供应商、模型、倍率、促销期、路由优先级及启停状态。
3. 调用 `PUT /v1/admin/models/catalog`，请求体包含 `expectedVersion` 和完整 `catalog`。
4. 若返回 `409 MODEL_CATALOG_VERSION_CONFLICT`，重新读取后合并，禁止盲目覆盖。
5. 用普通成员接口复查，确认响应中不存在 `providers`、`baseUrl`、`credentialRef` 或 `secret://`。

目录更新只改变模型展示与路由配置；真实调用仍须由 RenWork 服务端供应商网关解析 Secret 并上报准确 Token 用量。
