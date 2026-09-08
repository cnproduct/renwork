# Voiceover V25 — Server 2016 production release hardening

1. Automation runner identities are scoped to both the signed-in user and organization, so one desktop installation can switch accounts without triggering `automation_runner_identity_conflict`.
2. The Windows Server 2016 cloud-only client exposes a one-click, read-only diagnostic covering sign-in, cloud workspace, worker availability, the authorized model catalog, and the RenCredit wallet.
3. Diagnostics never display worker URLs, access tokens, provider credentials, or server-side secret references.
4. The Server 2016 package remains a separate cloud-only distribution and does not bundle or start an OpenCode sidecar.
5. Release gates remain separate: source tests, GitHub CI, artifact checksums, installation on Windows Server 2016, real model execution, RenCredit settlement, and rollback each require their own evidence.
