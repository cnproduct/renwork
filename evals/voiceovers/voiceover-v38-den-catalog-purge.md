# Voiceover V38 — Den-only catalog and package recovery

V38 removes every ordinary-user path that can bypass the RenCredit boundary.

1. Public, cloud, enterprise, and Server 2016 packages are cloud-workspace clients and do not ship an OpenCode executable sidecar.
2. The member model picker does not offer API-key setup or personal-subscription OAuth.
3. The authoritative catalog contains only server-secret providers and official Den routes.
4. A one-time migration permanently removes dormant local, BYOK, device-OAuth providers and routes, removes free-plan grants, and preserves valid administrator-owned Den routes.
5. Publishing fails if any model targets a free/unknown plan, any client credential remains, or any route can execute outside Den.
6. `renwork-code-kimi-k3` is the stable Kimi K3 product SKU and routes through the server-held OpenCode Go credential.
7. Den API rejects any upstream catalog that contains a client credential, free plan, local/BYOK route, or non-Den provider, even if the catalog service is misconfigured.
8. Existing and newly-created Automations fail closed on the legacy OpenCode Zen model and default to `renwork/renwork-auto`.
9. Source, CI, package, installed-client, deployment, and production RenCredit acceptance remain separate gates. Production test spend is capped at 0.05 RenCredit.
