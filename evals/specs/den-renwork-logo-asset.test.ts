import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Den bundles the RenWork sidebar mark instead of requesting the landing-site root asset", async ({ evidence }) => {
  const shell = await readFile(
    "../ee/apps/den-web/app/(den)/dashboard/_components/org-dashboard-shell.tsx",
    "utf8",
  );

  expect(shell).toContain('import renworkMark from "../../../../public/renwork-mark.png"');
  expect(shell).toContain("src={renworkMark.src}");
  expect(shell).not.toContain('src="/renwork-mark.png"');

  evidence.fact(
    "RenWork sidebar mark is owned by the Den bundle",
    "The fallback mark is compiled into Den Web static media and no longer requests the conflicting rrenn.com root asset path.",
    true,
  );
});
