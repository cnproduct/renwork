import { describe, expect, test } from "bun:test";

import { isChunkLoadFailure, shouldReloadChunkFailure } from "../app/chunk-load-recovery";

describe("Den web chunk load recovery", () => {
  test("recognizes the production Next.js chunk failure", () => {
    const error = new Error("Failed to load chunk /_next/static/chunks/example.js from module 214265");
    error.name = "ChunkLoadError";

    expect(isChunkLoadFailure(error)).toBe(true);
    expect(shouldReloadChunkFailure({ error, previousAttemptAt: null, now: 10_000 })).toBe(true);
  });

  test("prevents a reload loop while preserving ordinary errors", () => {
    const chunkError = new Error("Loading chunk example failed");

    expect(shouldReloadChunkFailure({ error: chunkError, previousAttemptAt: 9_000, now: 10_000 })).toBe(false);
    expect(shouldReloadChunkFailure({ error: new Error("API unavailable"), previousAttemptAt: null, now: 10_000 })).toBe(false);
  });
});
