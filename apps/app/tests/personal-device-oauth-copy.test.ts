import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dir, "..", "src", "react-app", "domains", "connections", "provider-auth", "provider-auth-modal.tsx"),
  "utf8",
);

describe("personal device OAuth guidance", () => {
  test("requires every computer to connect separately and keeps credentials off Den", () => {
    expect(source).toContain("Connect this device");
    expect(source).toContain("Connect each of your computers separately");
    expect(source).toContain("never uploaded to RenWork Cloud");
    expect(source).toContain("reserve and settle RenCredit");
  });
});
