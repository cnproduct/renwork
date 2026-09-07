import assert from "node:assert/strict"
import test from "node:test"
import { authorizeRequest, buildContainerSpec, volumeNames, workerName } from "./self-hosted-runner.mjs"

const workerId = "wrk_01abc123"

test("derives isolated deterministic container and volume names", () => {
  assert.equal(workerName(workerId), "renwork-wrk_01abc123")
  assert.deepEqual(volumeNames(workerId), {
    workspace: "renwork-wrk_01abc123-workspace",
    data: "renwork-wrk_01abc123-data",
  })
  assert.throws(() => workerName("../../host"), /invalid_worker_id/)
})

test("builds a constrained worker with persistent per-worker volumes", () => {
  const spec = buildContainerSpec(workerId, {
    hostToken: "h".repeat(32),
    clientToken: "c".repeat(32),
    activityToken: "a".repeat(32),
    heartbeatUrl: "https://www.rrenn.com/api/den/v1/workers/wrk_01abc123/activity-heartbeat",
    image: "ghcr.io/cnproduct/worker:v23",
  }, {
    image: "ghcr.io/cnproduct/worker:v23",
    imageVersion: "v23",
    network: "renwork-auth_default",
    port: 8787,
  })

  assert.equal(spec.body.HostConfig.NetworkMode, "renwork-auth_default")
  assert.equal(spec.body.HostConfig.ReadonlyRootfs, true)
  assert.deepEqual(spec.body.HostConfig.CapDrop, ["ALL"])
  assert.equal(spec.body.HostConfig.Mounts[0].Source, "renwork-wrk_01abc123-workspace")
  assert.equal(spec.body.Labels["renwork.worker_id"], workerId)
  assert.ok(spec.body.Env.includes("DEN_RUNTIME_PROVIDER=self_hosted"))
})

test("rejects arbitrary images and requires the shared runner token", () => {
  assert.throws(() => buildContainerSpec(workerId, {
    hostToken: "h".repeat(32),
    clientToken: "c".repeat(32),
    activityToken: "a".repeat(32),
    heartbeatUrl: "https://www.rrenn.com/heartbeat",
    image: "attacker/image:latest",
  }, { image: "ghcr.io/cnproduct/worker:v23" }), /worker_image_not_allowed/)

  assert.equal(authorizeRequest({ headers: { authorization: "Bearer correct-token-value" } }, "correct-token-value"), true)
  assert.equal(authorizeRequest({ headers: { authorization: "Bearer wrong" } }, "correct-token-value"), false)
})
