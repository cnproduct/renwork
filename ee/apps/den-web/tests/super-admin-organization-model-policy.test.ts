import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const panel = readFileSync(join(import.meta.dir, "..", "components", "den-admin-panel.tsx"), "utf8");
const dialog = readFileSync(join(import.meta.dir, "..", "components", "organization-model-policy-dialog.tsx"), "utf8");
const route = readFileSync(join(import.meta.dir, "..", "..", "den-api", "src", "routes", "admin", "model-policy.ts"), "utf8");

describe("RenWork platform super-admin organization model policy", () => {
  test("opens model and quota governance from every organization row", () => {
    expect(panel).toContain("OrganizationModelPolicyDialog");
    expect(panel).toContain("模型与额度策略");
    expect(dialog).toContain("模型白名单与默认模型");
    expect(dialog).toContain("组织 RenCredit 预算");
    expect(dialog).toContain("成员额度与模型白名单");
    expect(dialog).toContain("超级管理员供应商授权");
    expect(dialog).toContain("没有有效授权时，模型目录与推理接口都会拒绝");
  });

  test("loads and saves only through platform-admin organization policy routes", () => {
    expect(dialog).toContain("/v1/admin/organizations/");
    expect(route.match(/adminRoute\(\)/g)?.length).toBe(2);
    expect(route).toContain("loadActiveMembers");
    expect(route).toContain("loadAvailableCatalog");
    expect(route).toContain("A member policy references an unknown organization member.");
    expect(route).toContain("A provider authorization references an unavailable server provider.");
  });

  test("keeps provider secrets in the separate global model catalog", () => {
    expect(dialog).toContain("供应商密钥仍只在全局模型目录管理");
    expect(dialog).not.toContain("credentialRef");
    expect(dialog).not.toContain("apiKey");
  });
});
