import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

const approvedVoiceoverV9 = [
  "环境变量列表只显示名称、更新时间和已配置状态，不把原始密钥返回给渲染进程。",
  "已保存密钥不可查看；编辑只能输入新值覆盖，平台内部密钥同样不可导出。",
  "macOS 修改密钥前使用 Touch ID；没有系统生物认证时使用本机保险库密码。",
  "保险库密码只保存加盐后的 scrypt 校验值，不保存原始密码。",
  "桌面端使用操作系统安全存储托管的 32 字节密钥，以 AES-256-GCM 加密环境变量。",
  "旧版 JSON 明文在桌面端首次读取后自动迁移为密文，运行时仍可受控注入子进程。",
] as const;

test("Voiceover V9 protects local environment secrets from casual disclosure", async ({ evidence }) => {
  const [routes, envStore, environmentView, table, settingsPage, desktopMain, fallbackAuth] = await Promise.all([
    readFile("../apps/server/src/routes/core.ts", "utf8"),
    readFile("../apps/server/src/env-file.ts", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/pages/environment-view.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/pages/environment-variable-table.tsx", "utf8"),
    readFile("../apps/app/src/react-app/domains/settings/shell/settings-page.tsx", "utf8"),
    readFile("../apps/desktop/electron/main.mjs", "utf8"),
    readFile("../apps/desktop/electron/secret-vault-auth.mjs", "utf8"),
  ]);

  expect(approvedVoiceoverV9).toHaveLength(6);
  expect(routes).toContain("env_value_export_disabled");
  expect(routes).not.toContain("...(includeValues ? { value: item.value } : {})");
  expect(environmentView).not.toContain("getUserEnv(item.key)");
  expect(environmentView).not.toContain("window.prompt");
  expect(environmentView).toContain('value: ""');
  expect(environmentView).toContain('type="password"');
  expect(environmentView).toContain("canViewEnvironment");
  expect(settingsPage).toContain('tab !== "environment"');
  expect(table).not.toContain("EnvironmentVariableTableRevealButton");
  expect(envStore).toContain('"aes-256-gcm"');
  expect(envStore).toContain("hasLegacyPlaintext");
  expect(desktopMain).toContain("promptTouchID");
  expect(desktopMain).toContain("secretVaultPasswordAuth.verify");
  expect(fallbackAuth).toContain("scryptSync");
  expect(fallbackAuth).not.toContain("console.log");

  evidence.fact(
    "Renderer cannot export saved secrets",
    "Both list and single-value routes omit or reject raw values, and the settings editor only accepts a replacement.",
    true,
  );
  evidence.fact(
    "Desktop values are encrypted and legacy plaintext is migrated",
    "RenWork uses the OS-protected desktop vault key with AES-256-GCM; the legacy schema is rewritten after successful load.",
    true,
  );
});
