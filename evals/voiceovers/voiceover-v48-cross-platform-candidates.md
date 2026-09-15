# Voiceover V48 — cross-platform desktop test candidates

V48 produces reviewable desktop test candidates from one exact `dev` commit. It does not publish a GitHub Release, updater manifest, or production download pointer.

1. Build macOS Apple Silicon, macOS Intel, Windows x64, Windows Server 2016 cloud-only, Linux x64, and Linux arm64 candidates from the same source version.
2. Every distributed candidate remains Den-only, contains the production RenWork cloud base configuration, and cannot fall back to a local OpenCode provider or a personal provider credential.
3. The Windows Server 2016 candidate contains no OpenCode sidecar and starts only through the cloud-workspace path.
4. If a provider reports Token usage but returns no visible assistant answer, the task leaves a recovery action and clearly explains that reported Token usage is still settled in RenCredit and can be checked in the usage receipt.
5. Candidate artifacts include SHA-256 checksums. Source checks, CI builds, package structure, signatures, installed-client behavior, organization catalog refresh, and production RenCredit receipts remain separate gates.
6. macOS candidates without Developer ID signing and notarization and Windows candidates without production Authenticode signing are test-only. They must not replace public updater metadata or production download links.
7. Formal publication is allowed only after exact-platform installation, launch, sign-in recovery, organization load, model catalog refresh, a successful managed-model response, and a correlated RenCredit reservation/capture receipt pass on every claimed platform.
