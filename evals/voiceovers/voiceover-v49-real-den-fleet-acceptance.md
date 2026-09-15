# Voiceover V49 — Real Den and six-device release acceptance

1. Retire the local `admission-no-result-mock` reproduction. The replacement
   signs an isolated desktop profile into an explicitly configured Den test
   tenant, waits for the authoritative organization catalog, and selects the
   dedicated no-visible-result model SKU supplied by the test environment.
2. Before the prompt, record the durable organization wallet and the current
   member receipt cursor. Send one bounded prompt through the installed RenWork
   application. The test is successful only when Den creates a new reservation
   and an immutable terminal receipt correlated to that run.
3. A provider-reported Token total with no visible assistant result must settle
   as `captured`; an upstream failure or a response with no reported Token
   consumption must settle as `released`. The wallet must have no abandoned
   frozen balance after either terminal path.
4. Keep the real-Den test opt-in and fail closed when its URL, test-tenant
   credentials, organization, model SKU, or maximum permitted RenCredit spend
   is absent. A skipped or simulated result never counts as release evidence.
5. Install the exact candidate artifacts on six real targets: macOS Apple
   Silicon, macOS Intel, Windows x64, Windows Server 2016 cloud-only, Linux x64,
   and Linux arm64. Hosted build VMs prove packaging only and cannot satisfy
   this gate.
6. On every target, record the artifact SHA-256, source commit, exact OS and
   architecture, install result, organization login, authoritative model load,
   one model call, reservation ID, settlement receipt ID, provider-reported
   Token totals, wallet deltas, and the absence of leftover frozen balance.
7. Validate all six evidence records as one set. Evidence is rejected when it
   is missing, stale, duplicated, from a different commit or artifact, lacks
   correlated Den identifiers, exceeds the approved spend cap, or reports a
   non-terminal reservation.
8. PR #80 remains open until both the real-Den no-result gate and all six exact
   device records pass. Only then may the PR be merged.
9. A signed prerelease is a separate final gate. It must be built from the
   merged commit, verify Apple Developer ID signing and notarization for both
   macOS architectures, verify the configured Windows signature, publish only
   as a GitHub prerelease, and leave production updater and rrenn.com download
   pointers unchanged until a later explicitly approved release.

