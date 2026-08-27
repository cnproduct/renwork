# RenWork account-first onboarding design contract

## Scope

This contract governs the first-install authentication and runtime-choice flow. It does not replace the product-wide design system.

## Product context

- Artifact: desktop onboarding and authentication.
- Audience: export-business owners and operators who need a trustworthy path into AI-assisted work without becoming infrastructure experts.
- Primary action: verify an account, then explicitly choose RenWork Cloud or local execution.
- Positioning: calm, trustworthy, sovereign, and decisive.
- Essence: **verified identity, controlled execution**.
- Reference boundary: OpenDesign informs the sequence (account first, runtime second) only. Its brand, visual identity, product names, pricing copy, and promotional language are not RenWork assets.

## Signature interaction: the identity passport

The full-screen entry surface presents a short three-step rail:

1. Verify identity.
2. Choose where work runs.
3. Start working.

After authentication, a compact verified-account strip acts as the visual passport that unlocks runtime selection. Authentication establishes identity, tenant, and entitlement context; it does not imply file upload or cloud inference.

## Visual language

- Use the existing RenWork semantic tokens and CJK-safe application font stack. A global typeface change is outside this feature's risk boundary.
- Primary accent: DLS navy `#011627` (approximately `oklch(0.19 0.04 240)`).
- Background and surfaces: existing semantic background, surface, foreground, muted, and border tokens.
- Success/verified state: use the existing success semantic color; never rely on color alone.
- No page-level gradients, shader dithering, glass panels, glow, or decorative dashboard chrome.
- Borders define hierarchy. Shadows are reserved for real elevation such as dialogs.
- Radius is restrained: 8–16 px, with pills only for compact status badges.

## Layout and hierarchy

- Full-screen sign-in: two-column composition at desktop widths; the step rail collapses above the form on narrow screens.
- Runtime choice: verified-account strip, concise title and privacy statement, then two first-level choices: RenWork Cloud and Local.
- Local expands in place to two explicit subchoices: local Agent/Ollama/CLI and BYOK.
- Cloud and Local are peers. “Recommended” may describe Cloud but must not visually disable or shame Local.
- Avoid fake operating-system title bars, traffic lights, home icons, and unrelated product dashboards during onboarding.

## Copy and truth constraints

- Signed-out users cannot see runtime cards, choose folders, create workspaces, or bypass registration/sign-in.
- State clearly that login establishes identity/tenant/entitlement and does not automatically upload local files.
- Local Agent/Ollama/CLI, BYOK, and local knowledge work remain the free core.
- Do not hard-code promotional pricing. Cloud entitlement and RenCredit boundaries must come from the authenticated service.
- Do not use OpenDesign or Naike as RenWork product branding, default fixtures, or promotional copy. Naike is an isolated customer case.

## Interaction and accessibility

- Main touch targets are at least 44 px high.
- Native buttons and disclosures are keyboard reachable and expose selected, expanded, loading, error, and disabled states.
- Visible focus rings use semantic focus tokens.
- Dynamic status and authentication errors use appropriate live regions.
- Runtime selection is never communicated by color alone.
- Respect reduced motion; the feature does not require animation to explain state.

## Acceptance signature

The flow should feel like receiving a secure passport and then choosing a route: identity is verified once, execution location remains an explicit user decision, and local sovereignty stays legible throughout.
