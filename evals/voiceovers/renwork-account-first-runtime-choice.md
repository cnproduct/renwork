# renwork-account-first-runtime-choice — Register first, then choose RenWork Cloud or local execution

1. A new RenWork installation opens on a calm “Connect to RenWork” screen. I can register, sign in, read the privacy summary, change language, or retry a failed connection. I cannot see model-source cards, create a workspace, choose a folder, or skip account setup while signed out.

2. I choose Register. RenWork opens the real account service in my browser and keeps the desktop in a visible waiting state. I complete the currently supported registration and verification steps; the desktop does not mark onboarding complete until the signed callback resolves to an authenticated user and tenant.

3. Back in RenWork, I can see which account and workspace identity connected. Only now does RenWork ask where work should run: “RenWork Cloud” is recommended, and “Local” is equally available. This choice is separate from sign-in, so connecting an account does not upload files or silently select cloud inference.

4. I choose RenWork Cloud. The page explains the verified entitlement or current RenCredit boundary without a hard-coded promotional price. After the entitlement check succeeds, RenWork creates or opens the workspace and uses the authenticated tenant for cloud requests; a client-supplied or model-supplied tenant cannot replace it.

5. On another clean run I sign in and choose Local. RenWork then offers detected local agents or Ollama and a bring-your-own-key path. My folders, prompts, model keys, and local knowledge stay on this device by default. Local agents, BYOK, and local knowledge work remain the free core even though account connection is mandatory.

6. I restart with a still-valid saved session and return without registering again. If the session is expired, revoked, or no longer belongs to the tenant, RenWork returns to the connection screen before any workspace opens. A temporary network failure shows retry guidance and never becomes a guest-mode bypass.

7. The final proof inspects the fresh-install route and tenant fixtures. Every signed-out branch is blocked before runtime selection, and no default RenWork brand, workspace, analytics fixture, public demo, or SEO payload contains Naike data. Naike remains an explicitly labeled customer case inside its own tenant scope.
