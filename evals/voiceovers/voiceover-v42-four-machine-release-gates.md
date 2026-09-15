# Voiceover V42: four-machine release gates

1. Freeze the exact private 0.18.66 candidates for Apple Silicon, Intel Mac, Windows x64, and Windows Server 2016 cloud-only.
2. Preserve the currently installed RenWork app. Test candidates with isolated state and never reuse host credentials or stale model state as package evidence.
3. On every available target machine, verify startup, sign-in, organization loading, the authoritative 26-model catalog, stale-model recovery to RenWork Auto, and a harmless Kimi K3 response.
4. For every test organization with an authenticated session, correlate one paid request with its RenCredit reserve, capture or release, final wallet balance, and immutable receipt. Keep each organization below the approved 0.01 RenCredit cap.
5. Windows Server 2016 must remain cloud-only, contain no OpenCode sidecar, and never attempt the unsupported local runtime that exits with code 3221225785.
6. The macOS Alpha workflow must use RenWork branding and reject missing Apple signing or notarization inputs before packaging begins.
7. Treat source checks, CI artifacts, installed clients, account entitlement, production settlement, and public signing as separate gates. Do not publish until every required gate has direct evidence.
