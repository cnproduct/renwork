# Voiceover V34 — RenCredit fleet rollout and production observability

1. Platform operators keep `v0.18.62` in prerelease while ordinary Windows, Windows Server 2016 cloud-only, Apple Silicon, and Intel Mac installations are verified on their target computers.
2. Every metered desktop reports only its RenWork client version alongside the existing device identity. OAuth credentials, provider keys, prompts, replies, and upstream identifiers never enter fleet monitoring.
3. The platform super administrator opens **运行监控** to see per-organization wallet readiness, active and online devices, 24-hour captures and releases, failure rate, expired reservations, and client-version adoption.
4. An expired reservation or suspended wallet is critical. A high failure rate, old client, or missing version report is a warning. Inactive organizations remain idle instead of producing a false outage alarm.
5. A controlled task may spend at most `0.05 RenCredit`. Acceptance requires authoritative before/after wallet balances plus the correlated reservation, capture receipt, model SKU, and release evidence for a forced failure.
6. The release remains prerelease until all four installed-platform checks and the real RenCredit reserve/capture/failure-release checks pass. Only then may the same immutable release assets be promoted to formal availability.
