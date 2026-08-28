# RenWork production authentication and tenant journey

1. On first launch, RenWork opens the hosted account page at `https://account.rrenn.com` in create-account mode. The browser URL carries `desktopAuth=1` and the `renwork` callback scheme.
2. The page asks for an email address, sends a six-digit one-time code, and never asks an MVP user to create or remember a password.
3. Entering the valid code creates or signs in the account. A new user names a personal or company organization; existing users see only organizations they belong to.
4. The signed-in page issues a five-minute, one-time desktop grant and returns through `renwork://den-auth`. The server accepts the legacy `openwork` scheme only when an older desktop explicitly requests it.
5. After the grant is consumed, RenWork shows the verified account and lets the user choose RenWork Cloud, local Agent/Ollama/CLI, or BYOK execution.
6. Organization, invitation, buyer-growth, and RenCredit requests derive their tenant from the authenticated session. A caller cannot select another tenant by changing a request field.
7. Invalid, expired, replayed, or cross-tenant grants and resource requests fail closed without exposing another tenant's data.
