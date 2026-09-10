# Voiceover V33 — RenCredit runtime readiness and OAuth lease self-healing

1. A signed-in member changes organization. RenWork keeps **Run task** unavailable while the Den session, provider catalog, and trusted receipt signer are converging.
2. The local host exposes a content-free RenCredit runtime status. It never exposes a bearer token, inference key, OAuth credential, provider base URL, or upstream model identifier.
3. Once the first provider sync completes, the composer becomes ready without requiring a restart or a manual retry.
4. A personal OAuth task reserves RenCredit and starts a short execution lease. The desktop renews the lease while OpenCode is still working.
5. Completion captures reported token usage exactly once. Failure, cancellation, an engine rejection, or an abandoned lease releases the reservation exactly once.
6. If a previous desktop disappeared, Den reconciles its expired reservation before the next concurrency decision. The next task can proceed instead of waiting thirty minutes.
7. A genuine concurrent run returns `DEVICE_OAUTH_CONCURRENCY_EXCEEDED` with `retryAfterSeconds`. RenWork explains that another task is settling and retries only after the indicated delay; raw JSON is not shown to the member.
8. The same fail-closed rules apply to every existing and newly created organization. No reservation means no execution, and no provider or OAuth secret crosses the Den boundary.

