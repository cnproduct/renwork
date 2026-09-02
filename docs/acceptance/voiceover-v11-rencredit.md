# Voiceover V11 RenCredit acceptance

Date: 2026-09-01 (US/Pacific)

## Environment

- Isolated Tencent Cloud compose project: `renwork-inference-v11`
- Dedicated database: `renwork_inference_v11`
- Den and catalog listeners: loopback only (`127.0.0.1:8792`, `127.0.0.1:8892`)
- Source baseline: `dev@7798d61b7`
- Formal migration: completed before Den startup
- Production compose project and production database: unchanged

## Durable ledger acceptance

Two independently authenticated tenants received separate test wallets. Real OpenCode Go calls proved:

- tenant A success: reserve then capture;
- tenant B success: a different wallet and receipt;
- tenant A failure/abort: full release;
- duplicate idempotency key: one accepted request and one HTTP 409 replay rejection;
- concurrent duplicate: one durable reservation only;
- tenant spoof header: ignored; the inference key's tenant remained authoritative.

## Actual ChatGPT OAuth / Codex CLI acceptance

The local Codex CLI reported `Logged in using ChatGPT`. No OAuth file, access token or refresh token was read or uploaded.

One real `codex exec --json` run emitted the authoritative `turn.completed` usage event:

| Token class | Actual |
| --- | ---: |
| Input | 22,480 |
| Output | 7 |
| Reasoning | 0 |
| Cache read | 8,960 |
| Cache write | 0 |

The approved Ed25519 device signed a content-free receipt. The durable tenant ledger recorded:

| Ledger result | Micro RenCredit |
| --- | ---: |
| Frozen | 61,136 |
| Captured | 24,293 |
| Released | 36,843 |

The device was then revoked. A new reservation returned `LOCAL_RUNTIME_DEVICE_NOT_APPROVED`, proving that cloud revocation stops later local OAuth billing runs.

## Safety boundary

- Codex uses only its structured JSONL Token event for settlement.
- Prompt, completion, file content and OAuth credentials are absent from the signed ledger receipt.
- Antigravity remains fail-closed until its CLI provides an authoritative structured usage event.
- Production deployment is intentionally deferred because production currently contains direct hotfix image revisions not yet reconciled with Git. Replacing it from this branch would risk regression and would not be an honest source-to-production promotion.

## Verification commands

- `pnpm --filter @openwork/rencredit-metering test`
- `pnpm --filter openwork-server typecheck`
- `pnpm --filter @openwork/app typecheck`
- `pnpm --filter openwork-server exec bun --conditions=development test src/renwork-cli-runtime.test.ts src/rencredit-oauth-proxy.e2e.test.ts`
- `pnpm --dir evals exec vitest run --config vitest.config.ts --project pr specs/renwork-codex-oauth-live-v11.test.ts`
