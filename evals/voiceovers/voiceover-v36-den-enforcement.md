# Voiceover V36 — Den-only execution and explainable RenCredit settlement

## Confirmed outcome

RenWork's branded desktop and cloud clients expose only models that have an enabled, organization-scoped Den route. Personal device OAuth, BYOK, local model execution and client-side provider fallback are not valid production execution paths.

## Security and billing rules

1. A production provider must use a server-side `env://` or `secret://` reference, `cloud_gateway` execution and organization sharing.
2. A selectable route must be `official`, healthy, enabled and backed by a supported Den protocol.
3. Every accepted request reserves RenCredit before upstream egress. There is no free billing switch in production.
4. Provider-reported Token usage remains authoritative. If the final charge exceeds the estimate, capture the frozen amount and append a separate `INFERENCE_TOKEN_OVERAGE_ADJUSTMENT` ledger row for the remainder.
5. A failed, cancelled or result-less request releases its reservation. Settlement and release remain idempotent.
6. Historical device records remain visible only for audit and revocation. New local device registration, reservation, heartbeat and signed-receipt settlement fail closed with `LOCAL_RUNTIME_DISABLED`.

## Release gates

- Source gate: package, Den API, desktop distribution and coded evals pass.
- CI/package gate: Apple Silicon, Intel, ordinary Windows and Server 2016 artifacts build successfully.
- Installed gate: each target machine reports the exact candidate version and completes one real Den request.
- Billing gate: every installed request is correlated to reserve plus capture, or reserve plus full release for a fresh upstream failure.
- Revocation gate: historical devices can be revoked and cannot be reactivated or re-registered.
- Public release gate: GitHub Release, updater manifests and rrenn.com links are changed only after all installed gates pass. macOS remains a test artifact until Developer ID signing and notarization are available.

## Spend boundary

Production acceptance may consume at most 0.05 RenCredit in total. Stop before exceeding the cap.
