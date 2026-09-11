# Voiceover V40 — private desktop recovery candidates

V40 produces private test candidates without publishing a GitHub Release,
updater manifest, or public download link.

1. Distributed RenWork desktops remain Den-only and never start or ship a local OpenCode sidecar.
2. A one-time upgrade migration removes legacy local, BYOK and device-OAuth model selections from client storage while preserving Den-managed RenWork selections.
3. A deleted or revoked global model automatically recovers to the entitled `renwork-auto` SKU when available.
4. A conversation that remembers an unavailable SKU is reconciled before display and again immediately before send; it cannot keep retrying the stale SKU.
5. If RenWork Auto is unavailable, recovery selects another entitled managed RenWork model. If the organization has no entitlement, sending fails closed.
6. macOS arm64, macOS x64, Windows x64 and Windows Server 2016 cloud-only candidates are built as private CI artifacts for version 0.18.66.
7. The Windows Server 2016 candidate contains no `opencode*.exe` file and cannot enter a local-runtime startup path that produces exit code 3221225785.
8. Source, CI, package structure, signatures, installed-client behavior, organization catalog, and production RenCredit settlement are reported as separate acceptance gates.
9. Production model calls are not made in V40 without a separately approved maximum RenCredit spend.

