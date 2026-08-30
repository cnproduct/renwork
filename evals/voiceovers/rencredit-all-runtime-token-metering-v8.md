# Voiceover V8 — Every RenWork model token is metered into RenCredit

This user-facing demo follows a RenWork member running ordinary chat, coding,
agent, automation, and locally executed model tasks. Local execution continues
to keep workspace content on the device, but it is no longer an unmetered route:
every permitted model call enters the same cloud-authoritative RenCredit ledger.

1. The member signs in and opens a workspace. Before any model can run, RenWork
   verifies the active organization, subscription or time-limited grant, allowed
   model catalog, member budget, and available RenCredit. Signing in and opening
   files does not consume RenCredit; model execution does.

2. The model picker shows only RenWork models allowed by the platform catalog and
   organization policy. Each entry states its execution location, context limit,
   RenCredit multiplier, and availability. A model may run in RenWork Cloud or,
   when a platform super administrator has explicitly enabled it, on the local
   device. Both locations use the same metering contract.

3. The member starts a coding task. RenWork estimates the maximum charge and
   automatically freezes the required RenCredit before execution. The composer
   and the task header show available balance, frozen balance, and the selected
   model's multiplier without exposing provider keys, upstream routes, or
   internal supplier costs.

4. Every model invocation created by the task passes through the RenWork Metered
   Runtime. This includes the visible answer, planning and reasoning, tool-result
   continuation, agent and subagent calls, automatic retries, title generation,
   context summarization and compaction, and background automation. Plugins,
   OpenCode, old sessions, and direct provider configuration cannot open an
   unmetered model route.

5. For a cloud model, RenWork settles from provider-reported input, output,
   reasoning, cache-read, and cache-write usage. For a permitted local model,
   the controlled local runtime uses the catalog-approved tokenizer and produces
   a device-signed usage receipt. Workspace text, files, prompts, and generated
   content stay local; only identity scope, model SKU, token categories, task and
   idempotency identifiers, timestamps, and the signed settlement receipt are
   sent to the RenCredit service.

6. During execution, the ZCode-style usage panel has two layers. Context Capacity
   explains how much of the model context is occupied and which categories use
   it. RenCredit Settlement shows estimated, frozen, captured, and released
   amounts in near real time, with a per-task receipt that expands into token
   categories and internal task stages.

7. When the task succeeds, RenWork captures only the catalog-priced actual usage
   and immediately releases the unused frozen amount. When a provider fails, the
   user cancels, no model result is delivered, or the desktop app restarts during
   a task, RenWork releases or reconciles the reservation without double charging.
   Replaying the same request or signed receipt never creates a second charge.

8. Local execution still requires a short online authorization and settlement
   connection. If RenWork cannot verify identity, entitlement, model policy,
   wallet balance, or the metering runtime, the model does not start. V8 does not
   silently provide an offline or direct-account bypass; a future signed offline
   credit lease must be specified and accepted separately.

9. Consumer account login, a user-supplied API key, Ollama, a custom endpoint, or
   a third-party model connection never becomes an unmetered shortcut. If an
   upstream authorization cannot provide auditable usage or cannot be routed
   through the controlled runtime, RenWork marks it unavailable for normal model
   execution instead of estimating a charge after the fact.

10. A platform super administrator manages provider credentials, model SKUs,
    tokenizer versions, pricing snapshots, multipliers, execution locations, and
    exception grants. An organization Owner manages only the published-model
    whitelist, default model, organization budget, warnings, and member quotas.
    Members can select permitted models and inspect their own task receipts, but
    cannot change providers or metering policy.

11. The account center uses the persistent multi-tenant RenCredit ledger as its
    only balance source. It shows wallet balance, reservations, immutable ledger
    entries, task receipts, member usage, and organization totals. The desktop
    cache and local usage files are diagnostic copies only and can never mint,
    overwrite, or restore spendable balance.

12. Acceptance is complete only when two isolated test tenants prove cloud-model
    capture, permitted local-model capture, multi-call coding-agent accounting,
    retry accounting, cancellation and no-result release, crash reconciliation,
    idempotent receipt replay, concurrent reservations, member quotas, tenant
    isolation, direct-route rejection, and exact agreement between the desktop
    panel, task receipt, wallet, and persistent ledger. A healthy service, a UI
    screenshot, or a locally passing unit test alone is not production proof.
