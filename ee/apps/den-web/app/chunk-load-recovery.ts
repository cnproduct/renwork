export const CHUNK_RELOAD_ATTEMPT_KEY = "renwork.den.chunkReloadAttemptAt";

const CHUNK_RELOAD_COOLDOWN_MS = 60_000;
const CHUNK_LOAD_FAILURE_PATTERN = /chunkloaderror|failed to load chunk|loading chunk .+ failed/i;

export function isChunkLoadFailure(error: Error): boolean {
  return CHUNK_LOAD_FAILURE_PATTERN.test(`${error.name}\n${error.message}`);
}

export function shouldReloadChunkFailure({
  error,
  previousAttemptAt,
  now,
}: {
  error: Error;
  previousAttemptAt: number | null;
  now: number;
}): boolean {
  if (!isChunkLoadFailure(error)) {
    return false;
  }

  return previousAttemptAt === null || now - previousAttemptAt >= CHUNK_RELOAD_COOLDOWN_MS;
}
