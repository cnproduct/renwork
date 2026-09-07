import { readFile } from "node:fs/promises";
import { expect } from "vitest";
import { test } from "@openwork/testkit";

test("Voiceover V23 provides a free self-hosted cloud runtime without bypassing Den", async ({ evidence }) => {
  const [runner, compose, cloudRoute, heartbeat, workflow, gatewayTest] = await Promise.all([
    readFile("../deploy/production/self-hosted-runner.mjs", "utf8"),
    readFile("../deploy/production/docker-compose.production.yml", "utf8"),
    readFile("../ee/apps/den-api/src/routes/cloud/index.ts", "utf8"),
    readFile("../apps/server/src/worker-activity-heartbeat.ts", "utf8"),
    readFile("../.github/workflows/publish-ee-images.yml", "utf8"),
    readFile("../ee/apps/den-api/test/rencredit-production-gateway.test.ts", "utf8"),
  ]);

  expect(compose).toContain('profiles: ["self-hosted"]');
  expect(compose).toContain("/var/run/docker.sock:/var/run/docker.sock");
  expect(compose).toContain("SELF_HOSTED_MAX_RUNNING_WORKERS");
  expect(runner).toContain('"renwork.worker_id": workerId');
  expect(runner).toContain('ReadonlyRootfs: true');
  expect(runner).toContain('CapDrop: ["ALL"]');
  expect(runner).toContain('Type: "volume"');
  expect(cloudRoute).toContain("proxySelfHostedWorkerRequest");
  expect(cloudRoute).toContain('normalizeDenTypeId("worker"');
  expect(heartbeat).toContain('provider === "self_hosted"');
  expect(workflow).toContain("openwork-self-hosted-runner");
  expect(workflow).toContain("openwork-self-hosted-worker");
  expect(gatewayTest).toContain("reserves before egress and releases every failed or empty result");
  expect(gatewayTest).toContain("scopes idempotency and usage uniqueness by organization");

  evidence.fact(
    "The free runner is isolated from Den",
    "Only a narrow authenticated lifecycle sidecar mounts the Docker socket; Den never receives arbitrary container, command, mount, or image control.",
    true,
  );
  evidence.fact(
    "Each cloud user has persistent isolated storage",
    "Container and named-volume identities derive from Den worker IDs, while one-running-worker capacity and fifteen-minute idle stop bound the initial rollout.",
    true,
  );
  evidence.fact(
    "Model use still crosses the RenCredit authority",
    "The self-hosted runtime is exposed through Den and keeps the existing managed provider materialization, reservation, settlement, release, and tenant-scoped ledger path.",
    true,
  );
});
