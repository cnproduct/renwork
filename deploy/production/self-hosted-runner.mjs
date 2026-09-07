import http from "node:http"
import { timingSafeEqual } from "node:crypto"
import { fileURLToPath } from "node:url"

const dockerSocket = process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock"
const dockerApiVersion = process.env.DOCKER_API_VERSION || "v1.43"
const runnerToken = (process.env.SELF_HOSTED_RUNNER_TOKEN || "").trim()
const workerImage = (process.env.SELF_HOSTED_WORKER_IMAGE || "").trim()
const workerImageVersion = (process.env.SELF_HOSTED_WORKER_IMAGE_VERSION || workerImage).trim()
const workerNetwork = (process.env.SELF_HOSTED_WORKER_NETWORK || "renwork-auth_default").trim()
const workerPort = Number(process.env.SELF_HOSTED_WORKER_PORT || "8787")
const maxRunningWorkers = Number(process.env.SELF_HOSTED_MAX_RUNNING_WORKERS || "1")
const workerMemoryBytes = Number(process.env.SELF_HOSTED_WORKER_MEMORY_BYTES || String(2 * 1024 ** 3))
const workerNanoCpus = Number(process.env.SELF_HOSTED_WORKER_NANO_CPUS || "1000000000")
const workerPidsLimit = Number(process.env.SELF_HOSTED_WORKER_PIDS_LIMIT || "256")

export function workerName(workerId) {
  const safe = workerId.toLowerCase().replace(/[^a-z0-9_.-]+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "")
  if (!/^wrk_[a-z0-9]+$/.test(safe)) throw new Error("invalid_worker_id")
  return `renwork-${safe}`.slice(0, 63)
}

export function volumeNames(workerId) {
  const name = workerName(workerId)
  return { workspace: `${name}-workspace`, data: `${name}-data` }
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  if (leftBuffer.length !== rightBuffer.length) {
    timingSafeEqual(Buffer.alloc(Math.max(leftBuffer.length, rightBuffer.length)), Buffer.alloc(Math.max(leftBuffer.length, rightBuffer.length)))
    return false
  }
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export function authorizeRequest(request, expectedToken = runnerToken) {
  const value = request.headers.authorization || ""
  const candidate = value.startsWith("Bearer ") ? value.slice(7).trim() : ""
  return Boolean(expectedToken && candidate && safeEqual(candidate, expectedToken))
}

export function buildContainerSpec(workerId, input, options = {}) {
  const name = workerName(workerId)
  const volumes = volumeNames(workerId)
  const image = options.image || workerImage
  const imageVersion = options.imageVersion || workerImageVersion
  const network = options.network || workerNetwork
  const port = options.port || workerPort
  if (!image) throw new Error("worker_image_missing")
  if (input.image && input.image !== image) throw new Error("worker_image_not_allowed")
  for (const key of ["hostToken", "clientToken", "activityToken", "heartbeatUrl"]) {
    if (typeof input[key] !== "string" || input[key].trim().length < 16) throw new Error(`invalid_${key}`)
  }

  return {
    name,
    imageVersion,
    internalUrl: `http://${name}:${port}`,
    body: {
      Image: image,
      Cmd: [
        "openwork-server",
        "--workspace", "/workspace",
        "--host", "0.0.0.0",
        "--port", String(port),
        "--cors", "*",
        "--approval", "auto",
        "--verbose",
      ],
      Env: [
        "HOME=/data/home",
        "XDG_CACHE_HOME=/data/cache",
        "XDG_CONFIG_HOME=/data/config",
        "OPENWORK_DATA_DIR=/data",
        "OPENWORK_SERVER_CONFIG=/data/server.json",
        `OPENWORK_TOKEN=${input.clientToken}`,
        `OPENWORK_HOST_TOKEN=${input.hostToken}`,
        "OPENWORK_MANAGE_OPENCODE=1",
        "OPENWORK_OPENCODE_BIN=/usr/local/bin/opencode",
        "OPENWORK_WEB_ROOT=/opt/openwork/web",
        "OPENWORK_WEB_BOOTSTRAP_TOKEN=0",
        "OPENWORK_EXTENSIONS_PLUGIN_DIR=/opt/openwork/opencode-plugins",
        "DEN_RUNTIME_PROVIDER=self_hosted",
        `DEN_WORKER_ID=${workerId}`,
        "DEN_ACTIVITY_HEARTBEAT_ENABLED=1",
        `DEN_ACTIVITY_HEARTBEAT_URL=${input.heartbeatUrl}`,
        `DEN_ACTIVITY_HEARTBEAT_TOKEN=${input.activityToken}`,
      ],
      Labels: {
        "renwork.self_hosted": "1",
        "renwork.worker_id": workerId,
        "renwork.image_version": imageVersion,
      },
      ExposedPorts: { [`${port}/tcp`]: {} },
      HostConfig: {
        NetworkMode: network,
        RestartPolicy: { Name: "no" },
        ReadonlyRootfs: true,
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges"],
        Memory: workerMemoryBytes,
        NanoCpus: workerNanoCpus,
        PidsLimit: workerPidsLimit,
        Tmpfs: { "/tmp": "rw,noexec,nosuid,size=256m", "/run": "rw,noexec,nosuid,size=16m" },
        Mounts: [
          { Type: "volume", Source: volumes.workspace, Target: "/workspace" },
          { Type: "volume", Source: volumes.data, Target: "/data" },
        ],
      },
    },
  }
}

function dockerRequest(path, { method = "GET", body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      socketPath: dockerSocket,
      path: `/${dockerApiVersion}${path}`,
      method,
      headers: body ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } : undefined,
    }, (response) => {
      const chunks = []
      response.on("data", (chunk) => chunks.push(chunk))
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8")
        const status = response.statusCode || 500
        if (status >= 400) {
          const error = new Error(`docker_request_failed:${status}`)
          error.status = status
          error.details = text.slice(0, 500)
          reject(error)
          return
        }
        try {
          resolve(text ? JSON.parse(text) : null)
        } catch {
          resolve(text)
        }
      })
    })
    request.on("error", reject)
    if (body) request.write(body)
    request.end()
  })
}

async function inspectContainer(name) {
  try {
    return await dockerRequest(`/containers/${encodeURIComponent(name)}/json`)
  } catch (error) {
    if (error.status === 404) return null
    throw error
  }
}

async function pullImage(image) {
  try {
    await dockerRequest(`/images/${encodeURIComponent(image)}/json`)
  } catch (error) {
    if (error.status !== 404) throw error
    await dockerRequest(`/images/create?fromImage=${encodeURIComponent(image)}`, { method: "POST" })
  }
}

async function runningWorkerCount() {
  const filters = encodeURIComponent(JSON.stringify({ label: ["renwork.self_hosted=1"], status: ["running"] }))
  const rows = await dockerRequest(`/containers/json?filters=${filters}`)
  return Array.isArray(rows) ? rows.length : 0
}

async function waitForHealth(url, timeoutMs = 120_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) })
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  throw new Error("worker_health_timeout")
}

function workerResponse(workerId, spec, inspection) {
  const state = inspection?.State?.Running ? "running" : inspection ? "stopped" : "missing"
  return { workerId, containerName: spec.name, state, internalUrl: spec.internalUrl, imageVersion: inspection?.Config?.Labels?.["renwork.image_version"] || spec.imageVersion }
}

async function provision(workerId, input) {
  const spec = buildContainerSpec(workerId, input)
  let existing = await inspectContainer(spec.name)
  const existingVersion = existing?.Config?.Labels?.["renwork.image_version"]
  if (existing && existingVersion !== spec.imageVersion) {
    if (existing.State?.Running) await dockerRequest(`/containers/${encodeURIComponent(spec.name)}/stop?t=20`, { method: "POST" })
    await dockerRequest(`/containers/${encodeURIComponent(spec.name)}?v=false&force=true`, { method: "DELETE" })
    existing = null
  }

  if (!existing) {
    if (await runningWorkerCount() >= maxRunningWorkers) {
      const error = new Error("runner_capacity_reached")
      error.status = 409
      throw error
    }
    await pullImage(spec.body.Image)
    await dockerRequest(`/containers/create?name=${encodeURIComponent(spec.name)}`, { method: "POST", body: JSON.stringify(spec.body) })
  }

  existing = await inspectContainer(spec.name)
  if (!existing?.State?.Running) {
    if (await runningWorkerCount() >= maxRunningWorkers) {
      const error = new Error("runner_capacity_reached")
      error.status = 409
      throw error
    }
    await dockerRequest(`/containers/${encodeURIComponent(spec.name)}/start`, { method: "POST" })
  }
  await waitForHealth(spec.internalUrl)
  return workerResponse(workerId, spec, await inspectContainer(spec.name))
}

async function stop(workerId) {
  const name = workerName(workerId)
  const existing = await inspectContainer(name)
  if (!existing) return { status: "no_sandbox" }
  if (existing.State?.Running) await dockerRequest(`/containers/${encodeURIComponent(name)}/stop?t=20`, { method: "POST" })
  return { status: "stopped" }
}

async function remove(workerId) {
  const name = workerName(workerId)
  const volumes = volumeNames(workerId)
  const existing = await inspectContainer(name)
  if (existing) await dockerRequest(`/containers/${encodeURIComponent(name)}?v=false&force=true`, { method: "DELETE" })
  for (const volume of Object.values(volumes)) {
    try {
      await dockerRequest(`/volumes/${encodeURIComponent(volume)}?force=true`, { method: "DELETE" })
    } catch (error) {
      if (error.status !== 404) throw error
    }
  }
  return { ok: true }
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload)
  response.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" })
  response.end(body)
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 64 * 1024) throw new Error("request_too_large")
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")
}

export async function handleRequest(request, response) {
  if (request.url === "/health") return sendJson(response, 200, { ok: true, service: "renwork-self-hosted-runner" })
  if (!authorizeRequest(request)) return sendJson(response, 404, { error: "not_found" })

  const url = new URL(request.url || "/", "http://runner.local")
  const match = url.pathname.match(/^\/v1\/workers\/(wrk_[a-z0-9]+)(?:\/(provision|wake|stop))?$/)
  if (!match) return sendJson(response, 404, { error: "not_found" })
  const workerId = match[1]
  const action = match[2] || ""

  try {
    if (request.method === "POST" && action === "provision") return sendJson(response, 200, await provision(workerId, await readJson(request)))
    if (request.method === "POST" && action === "wake") {
      const existing = await inspectContainer(workerName(workerId))
      if (!existing) return sendJson(response, 404, { error: "worker_not_found" })
      return sendJson(response, 200, await provision(workerId, await readJson(request)))
    }
    if (request.method === "POST" && action === "stop") return sendJson(response, 200, await stop(workerId))
    if (request.method === "DELETE" && !action) return sendJson(response, 200, await remove(workerId))
    if (request.method === "GET" && !action) {
      const spec = buildContainerSpec(workerId, { hostToken: "x".repeat(16), clientToken: "x".repeat(16), activityToken: "x".repeat(16), heartbeatUrl: "https://invalid.local/heartbeat" })
      const inspection = await inspectContainer(spec.name)
      if (!inspection) return sendJson(response, 404, { error: "worker_not_found" })
      return sendJson(response, 200, workerResponse(workerId, spec, inspection))
    }
    return sendJson(response, 405, { error: "method_not_allowed" })
  } catch (error) {
    const status = Number.isInteger(error.status) ? error.status : error.message === "request_too_large" ? 413 : 500
    console.error(JSON.stringify({ level: "error", event: "runner_request_failed", workerId, action, error: error.message }))
    return sendJson(response, status, { error: status === 409 ? "runner_capacity_reached" : "runner_request_failed" })
  }
}

export function startRunner() {
  if (runnerToken.length < 32) throw new Error("SELF_HOSTED_RUNNER_TOKEN must contain at least 32 characters")
  if (!workerImage) throw new Error("SELF_HOSTED_WORKER_IMAGE is required")
  const port = Number(process.env.PORT || "8792")
  return http.createServer((request, response) => void handleRequest(request, response)).listen(port, "0.0.0.0")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) startRunner()
