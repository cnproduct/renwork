# Voiceover V31 — Server-exclusive credentials and mandatory RenCredit metering

1. A platform super administrator opens the RenWork model catalog and records
   each service credential only as a server-side secret reference. OpenCode Go,
   OpenRouter, Agnes, and custom provider keys never enter an organization
   Owner's browser, a member's desktop, an install package, or a model response.

2. The super administrator publishes a stable RenWork model SKU, binds its
   provider route, RenCredit rate card, eligible plans or organization grant,
   and validity window. Organization Owners may narrow the published-model
   whitelist, choose a default model, set budgets, and set member quotas; they
   cannot create, test, update, connect, or revoke provider credentials.

3. The desktop synchronizes only the per-member `RenWork Models` gateway. The
   gateway payload contains stable RenWork SKUs and a revocable Den inference
   key; it never contains an upstream provider URL, upstream model identifier,
   or service credential. Direct organization providers are rejected even when
   an older client knows their database identifier.

4. Upgrading or signing out removes legacy cloud-imported provider blocks,
   environment variables, and engine authentication entries. Local BYOK,
   Ollama, custom Base URL, and direct provider mutation endpoints are disabled
   in a RenWork metered distribution.

5. An OpenAI Plus or Pro personal OAuth route is available only when the
   platform catalog and organization entitlement include its RenWork SKU and a
   platform super administrator approves the user's device. The account owner
   completes OAuth on that device; the credential stays in the device vault and
   is never shared with teammates or uploaded to RenWork Cloud.

6. Every accepted cloud or approved personal-device model run first creates a
   Den reservation. No reservation means no execution. Successful runs capture
   catalog-priced input, output, reasoning, and cache tokens and release unused
   funds; failures and cancellations release the full unused reservation.

7. A revoked device, expired grant, unentitled SKU, cross-tenant key, direct
   provider request, missing session binding, replayed settlement, mismatched
   receipt, or invalid device signature is rejected without delivering a model
   result or creating an extra charge.

8. Acceptance reports local source and tests, CI and pull request, package,
   deployment, installed-client behavior, and production ledger evidence as
   separate gates. Passing code tests does not claim a production deployment or
   real RenCredit settlement.
