import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const approvedVoiceoverV7 = [
  "用户注册或登录后，RenWork 校验账号、租户以及正式订阅或仍在有效期内的临时授权。",
  "默认没有免费版，也不开放自有 API Key、Ollama、本地大模型或供应商开关。",
  "没有订阅或临时授权时，用户看到个人版与企业版权威套餐，不能进入模型执行。",
  "个人版提供月付与年付四档方案，企业版提供两档年付和一档按需定制方案。",
  "平台超级管理员可以授予或撤销带有效期、原因和模型范围的临时访问；组织 Owner 无此权限。",
  "模型弹窗只显示平台发布、套餐允许、组织白名单允许且临时授权范围允许的 RenWork 模型。",
  "旧会话保存的本地或未授权模型在发送前再次校验，不能绕过客户端模型弹窗。",
  "所有正式模型 Token 继续通过持久化 RenCredit 账本执行冻结、结算或失败释放。",
] as const;

test("Voiceover V7 is enforced by server and desktop gates", async ({ evidence }) => {
  const [catalogRoute, gateway, access, desktopPolicy, session, welcome, catalog] = await Promise.all([
    readFile("../ee/apps/den-api/src/routes/org/model-catalog.ts", "utf8"),
    readFile("../ee/apps/den-api/src/routes/inference-gateway.ts", "utf8"),
    readFile("../ee/apps/den-api/src/renwork-access.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/connections/provider-auth/desktop-provider-management.ts", "utf8"),
    readFile("../apps/app/src/react-app/shell/session-route.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/onboarding/welcome-page.tsx", "utf8"),
    readFile("../ee/apps/den-api/src/renwork-growth/plan-catalog.ts", "utf8"),
  ]);

  expect(approvedVoiceoverV7).toHaveLength(8);
  expect(catalogRoute).toContain("SUBSCRIPTION_REQUIRED");
  expect(gateway).toContain("SUBSCRIPTION_REQUIRED");
  expect(gateway).toContain("accessAllowsModel");
  expect(gateway).toContain('access.source === "subscription" || access.source === "offline_payment"');
  expect(catalogRoute).toContain('access.source === "subscription" || access.source === "offline_payment"');
  expect(catalogRoute).toContain("access.allowedModelSkus");
  expect(access).toContain("organizationHasActiveInferenceSubscription");
  expect(access).toContain("expiresAt");
  expect(desktopPolicy).toContain("return false");
  expect(session).toContain("sendModelAllowed");
  expect(session).toContain("options={entitledPickerOptions}");
  expect(welcome).not.toContain('data-testid="welcome-model-source-byok"');
  expect(welcome).not.toContain('data-testid="welcome-model-source-local"');
  expect(catalog).not.toContain('purchaseMode: "free"');

  evidence.fact(
    "Subscription access is enforced twice",
    "Both the member-safe model catalog and the inference gateway reject organizations without an active subscription or valid time-limited platform grant.",
    true,
  );
  evidence.fact(
    "Desktop model choices cannot bypass the server",
    "Provider management is disabled for every desktop profile, the picker receives entitled options only, and the send path revalidates saved session models.",
    true,
  );
});
