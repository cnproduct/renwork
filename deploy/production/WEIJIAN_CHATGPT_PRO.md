# weijian ChatGPT Pro cloud runner

The `weijian-codex` container is an isolated Codex runner for the exact `weijian` organization ID. Its device-code flow lets the organization owner complete sign-in on OpenAI's site. RenWork never receives the ChatGPT password. The Codex credential is encrypted at rest in a dedicated Docker volume and is removed when the owner disconnects it.

## Required production settings

Set these in `/opt/renwork-auth/.env` using distinct random values for the worker token and vault key:

```dotenv
RENWORK_WEIJIAN_ORGANIZATION_ID=org_...
RENWORK_WEIJIAN_CODEX_WORKER_TOKEN=<random internal token>
RENWORK_WEIJIAN_CODEX_VAULT_KEY=<random 32-or-more-character key>
RENWORK_WEIJIAN_CODEX_IMAGE=ghcr.io/cnproduct/renwork-weijian-codex:sha-...
```

Keep the vault key available across container upgrades; changing it makes the saved login unreadable. The worker has no public port. Start it explicitly with the `weijian-codex` Compose profile after publishing the Den API, web, and worker images.

```sh
docker compose -f docker-compose.production.yml --profile weijian-codex up -d weijian-codex den web
```

The existing organization `subscriptionCliPolicy` must be enabled, unexpired, and grant exactly the intended member and `renwork-codex-gpt-5-6-sol` model. The organization model policy, RenWork access and RenCredit wallet must also allow the request. The organization owner then opens **Dashboard → Models → ChatGPT Pro 云端授权**, selects **连接 ChatGPT Pro**, and completes the device code at the OpenAI URL shown there.

The first release runs a text task in a read-only Codex workspace. Successful Codex structured usage is charged to the organization's RenCredit wallet through reserve and capture; failures release the reservation. The API-key option is a separate future connection type and does not reuse the subscription credential.
