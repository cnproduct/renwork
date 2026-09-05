# Voiceover V21 — Windows Server 2016 cloud-only desktop

1. An administrator downloads `RenWork-v0.18.58-Windows-Server-2016-Cloud-x64.exe`, installs it on Windows Server 2016, and launches RenWork without an OpenCode process or missing-entry-point crash.

2. The package identifies itself as **RenWork Server 2016 Cloud** and uses its own application identifier, protocol, artifact directory, and `server2016-cloud` updater channel, so it cannot silently replace or downgrade a normal RenWork installation.

3. The user signs in and selects an organization. RenWork asks Den for that user's organization cloud instance; Den creates or wakes it under the organization's current subscription and worker policy.

4. While the worker is provisioning or waking, RenWork shows bounded progress. If the organization has no entitlement, Den is unavailable, provisioning fails, or tokens cannot be issued, RenWork shows a specific retryable error instead of loading forever.

5. When the worker is ready, RenWork selects the current user's worker, obtains short-lived connection credentials, stores or refreshes an organization-scoped remote workspace, and opens it automatically.

6. Model choices come from the organization's published RenWork catalog and whitelist, including platform-enabled OpenCode Go, Agnes, OpenRouter, OpenAI, and Google routes. The package cannot create a local workspace, install or launch local OpenCode, use Ollama, or bypass the platform with a personal API key.

7. Messages, tools, and file attachments execute through the remote OpenWork worker. Official inference continues through the authoritative Den gateway and persistent RenCredit ledger: reserve before execution, settle measured tokens, issue a receipt, and release reservations on failure.

8. Switching organizations connects to that organization's own remote workspace and model policy. Repeated connection attempts update the same organization workspace rather than creating duplicates, and one tenant's tokens cannot select another tenant's worker.

9. The release candidate passes install, launch, sign-in, organization load, catalog load, a real `renwork-code-kimi-k3` conversation, RenCredit balance/receipt verification, duplicate request, failed release, tenant switch, reinstall, checksum, and artifact evidence checks on Windows Server 2016.
