import { expect } from "vitest";
import { test } from "@openwork/testkit";

import { shouldReloadChunkFailure } from "../../ee/apps/den-web/app/chunk-load-recovery";

test("RenWork Cloud recovers from a stale Next.js chunk without entering a reload loop", async ({ evidence }) => {
  const error = new Error("Failed to load chunk /_next/static/chunks/example.js from module 214265");
  error.name = "ChunkLoadError";

  expect(shouldReloadChunkFailure({ error, previousAttemptAt: null, now: 10_000 })).toBe(true);
  expect(shouldReloadChunkFailure({ error, previousAttemptAt: 9_500, now: 10_000 })).toBe(false);
  evidence.fact(
    "A stale RenWork Cloud chunk receives one bounded recovery reload",
    "The first matching failure reloads, while a repeat inside the cooldown renders the branded recovery action instead of looping.",
    true,
  );
});
