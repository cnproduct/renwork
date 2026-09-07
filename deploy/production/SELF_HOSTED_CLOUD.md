# RenWork self-hosted Cloud Runner

This is the no-new-vendor-cost replacement for Daytona in small production pilots. It uses the existing RenWork host and Docker installation; it is not a free public compute service.

## Security boundary

- Den remains the source of organization entitlement, worker identity, model policy, and RenCredit billing.
- Only `self-hosted-runner` can access the Docker socket. The runner accepts authenticated lifecycle requests for a fixed image and fixed container shape; it cannot execute arbitrary commands or mounts supplied by a browser.
- Every Den worker ID gets separate persistent workspace and data volumes.
- The initial default permits one running worker and stops it after 15 idle minutes. Stopping preserves volumes; deleting the worker removes its container and both volumes.
- The public worker URL is a Den reverse-proxy path. Worker client and host tokens still protect the OpenWork API.

## Required server configuration

Set strong, server-only values in `/opt/renwork-auth/.env`:

```env
PROVISIONER_MODE=self_hosted
SELF_HOSTED_RUNNER_TOKEN=<at-least-32-random-characters>
SELF_HOSTED_WORKER_IMAGE=ghcr.io/cnproduct/openwork-self-hosted-worker:<release-tag>
SELF_HOSTED_WORKER_IMAGE_VERSION=<release-tag>
RENWORK_SELF_HOSTED_RUNNER_IMAGE=ghcr.io/cnproduct/openwork-self-hosted-runner:<release-tag>
SELF_HOSTED_MAX_RUNNING_WORKERS=1
CLOUD_IDLE_STOP_MINUTES=15
DOCKER_GID=<numeric-group-id-of-var-run-docker-sock>
```

Start or update the stack with the self-hosted profile enabled. The Runner token must never be placed in Den Web, desktop configuration, a catalog payload, logs, or source control.

## Production acceptance gates

1. Confirm Den, Den Web, catalog, Runner, and MySQL health.
2. Enable the Cloud capability for one test organization only.
3. Sign in from the Windows Server 2016 cloud-only client and wait for `ready`.
4. Verify the model list is the organization-authorized RenWork catalog.
5. Run one real model turn and confirm reservation, usage receipt, final settlement, and the organization ledger delta.
6. Force one upstream failure and confirm the reservation is released with no charge.
7. Sign in as a second organization and verify it cannot see the first worker, tokens, volumes, sessions, or ledger.
8. Leave the worker idle for 15 minutes, confirm it stops, then reconnect and confirm the same workspace data returns.

Code, unit tests, and CI images are prerequisites only. Do not call the runtime production-ready until all eight live gates pass on the deployment host.
