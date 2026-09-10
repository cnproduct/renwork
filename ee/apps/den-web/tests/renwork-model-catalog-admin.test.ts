import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const component = readFileSync(
  join(import.meta.dir, "..", "components", "renwork-model-catalog-admin.tsx"),
  "utf8",
);
const adminPage = readFileSync(join(import.meta.dir, "..", "app", "admin", "page.tsx"), "utf8");
const catalogPage = readFileSync(join(import.meta.dir, "..", "app", "admin", "model-catalog", "page.tsx"), "utf8");
const rootLayout = readFileSync(join(import.meta.dir, "..", "app", "layout.tsx"), "utf8");
const dockerfile = readFileSync(join(import.meta.dir, "..", "..", "..", "..", "packaging", "docker", "Dockerfile.den-web"), "utf8");

describe("RenWork platform model catalog admin", () => {
  test("adds a branded platform-admin entry and a dedicated catalog page", () => {
    expect(adminPage).toContain("模型与 RenCredit");
    expect(adminPage).toContain('href="/admin/model-catalog"');
    expect(adminPage).not.toContain(">OpenWork<");
    expect(catalogPage).toContain("RenWork Control Center");
    expect(rootLayout).toContain('title: "RenWork Cloud"');
    expect(rootLayout).not.toContain('title: "OpenWork Cloud"');
  });

  test("covers policy, provider, model, routing, preview, and publish controls", () => {
    for (const label of [
      "统一 Token 计费策略",
      "供应商网关",
      "服务端密钥引用",
      "连接测试",
      "历史本地设备清理",
      "禁止重新启用",
      "五类 Token 单价",
      "私有路由",
      "运行监控",
      "组织运行与计费健康",
      "过期冻结",
      "客户端版本",
      "普通用户模型选择器预览",
      "发布目录",
    ]) {
      expect(component).toContain(label);
    }
  });

  test("loads the super-admin-only sanitized runtime health endpoint", () => {
    expect(component).toContain("/v1/admin/rencredit/runtime-health?limit=200");
    expect(component).toContain("不显示密钥、提示词或回复内容");
    expect(component).toContain('data-testid="rencredit-runtime-monitoring"');
  });

  test("never asks the browser to store or reveal a raw provider secret", () => {
    expect(component).toContain("真实 Key 或由超级管理员托管的 OAuth 凭据必须注入服务端");
    expect(component).toContain("env://OPENROUTER_API_KEY");
    expect(component).not.toContain('type="password"');
    expect(component).not.toContain("apiKey:");
    expect(component).not.toContain("批准设备");
    expect(component).not.toContain('value="device_oauth"');
  });

  test("includes the RenCredit workspace package in the pruned Den Web image", () => {
    expect(dockerfile).toContain("COPY packages/rencredit-metering/package.json");
    expect(dockerfile).toContain("COPY packages/rencredit-metering /app/packages/rencredit-metering");
    expect(dockerfile).toContain("pnpm --dir /app/packages/rencredit-metering run build");
  });
});
