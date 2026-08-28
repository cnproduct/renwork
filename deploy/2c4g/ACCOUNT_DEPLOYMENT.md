# RenWork account service deployment

The production account control plane is served at `https://account.rrenn.com`.
Both Den API and Den Web must use `DEN_ORG_MODE=multi_org`; a mismatch can allow
the web client to skip organization onboarding.

## Preconditions

1. Add an `A` record for `account.rrenn.com` pointing to `43.135.182.81`.
2. Restore SSH access to the Tencent host.
3. Install Docker Engine, Docker Compose v2, Nginx, and Certbot.
4. Issue a Let's Encrypt certificate for `account.rrenn.com`.
5. Copy `.env.account.example` to `.env.account`, generate the five service
   secrets, and configure Resend or SMTP. Do not reuse provider API keys as
   authentication secrets.

## Deploy

Copy `nginx/account.rrenn.com.conf` to the host Nginx `conf.d` directory, test
the Nginx configuration, reload Nginx, then run:

```bash
chmod +x deploy/2c4g/scripts/deploy-account-stack.sh
deploy/2c4g/scripts/deploy-account-stack.sh
```

## Acceptance gates

- `https://account.rrenn.com/?mode=sign-up&desktopAuth=1&desktopScheme=renwork`
  renders the RenWork email OTP page, not the rrenn.com marketing homepage.
- A new account must create or join an organization before a desktop grant is
  issued.
- The exchanged grant contains that organization and cannot be replayed.
- `GET /api/health` and `GET /api/ready` are healthy through the public origin.
- Production logs confirm OTP delivery without logging the OTP value.
