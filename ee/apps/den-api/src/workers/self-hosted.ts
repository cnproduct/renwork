import { env } from "../env.js"
import type { ProvisionInput, ProvisionedInstance } from "./provisioner.js"

type WorkerId = ProvisionInput["workerId"]

type RunnerWorker = {
  workerId: string
  containerName: string
  state: "missing" | "created" | "running" | "stopped" | "failed"
  internalUrl: string
  imageVersion: string | null
}

type RunnerStopResult = { status: "stopped" | "no_sandbox" }
const internalUrlCache = new Map<string, { url: string; expiresAt: number }>()

export class SelfHostedWorkerMissingError extends Error {
  constructor(workerId: string) {
    super(`Self-hosted worker ${workerId} was not found`)
    this.name = "SelfHostedWorkerMissingError"
  }
}

function assertSelfHostedConfig() {
  if (!env.selfHosted.runnerUrl || !env.selfHosted.runnerToken || !env.selfHosted.workerPublicBaseUrl || !env.selfHosted.workerImage) {
    throw new Error("Self-hosted runner configuration is incomplete")
  }
}

function publicWorkerUrl(workerId: WorkerId) {
  assertSelfHostedConfig()
  return `${env.selfHosted.workerPublicBaseUrl!.replace(/\/+$/, "")}/${encodeURIComponent(workerId)}`
}

function runnerPath(workerId: WorkerId, action = "") {
  assertSelfHostedConfig()
  const suffix = action ? `/${action}` : ""
  return `${env.selfHosted.runnerUrl!.replace(/\/+$/, "")}/v1/workers/${encodeURIComponent(workerId)}${suffix}`
}

async function runnerRequest<T>(workerId: WorkerId, action = "", init: RequestInit = {}): Promise<T> {
  assertSelfHostedConfig()
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${env.selfHosted.runnerToken}`)
  headers.set("Accept", "application/json")
  if (init.body) headers.set("Content-Type", "application/json")

  const response = await fetch(runnerPath(workerId, action), {
    ...init,
    headers,
    signal: AbortSignal.timeout(180_000),
  })
  const text = await response.text()
  if (response.status === 404) throw new SelfHostedWorkerMissingError(workerId)
  if (!response.ok) throw new Error(`Self-hosted runner failed (${response.status}): ${text.slice(0, 400)}`)
  return (text ? JSON.parse(text) : {}) as T
}

function toProvisioned(workerId: WorkerId, worker: RunnerWorker): ProvisionedInstance {
  return {
    provider: "self_hosted",
    url: publicWorkerUrl(workerId),
    status: worker.state === "running" ? "healthy" : "provisioning",
    region: "local-docker",
    imageVersion: worker.imageVersion ?? env.selfHosted.workerImageVersion,
  }
}

function provisionBody(input: ProvisionInput) {
  return JSON.stringify({
    name: input.name,
    hostToken: input.hostToken,
    clientToken: input.clientToken,
    activityToken: input.activityToken,
    image: env.selfHosted.workerImage,
    imageVersion: env.selfHosted.workerImageVersion,
    heartbeatUrl: `${env.workerActivityBaseUrl.replace(/\/+$/, "")}/v1/workers/${encodeURIComponent(input.workerId)}/activity-heartbeat`,
  })
}

export async function provisionWorkerOnSelfHosted(input: ProvisionInput) {
  const worker = await runnerRequest<RunnerWorker>(input.workerId, "provision", {
    method: "POST",
    body: provisionBody(input),
  })
  return toProvisioned(input.workerId, worker)
}

export async function wakeWorkerOnSelfHosted(input: ProvisionInput) {
  const worker = await runnerRequest<RunnerWorker>(input.workerId, "wake", {
    method: "POST",
    body: provisionBody(input),
  })
  return toProvisioned(input.workerId, worker)
}

export async function stopWorkerOnSelfHosted(workerId: WorkerId): Promise<RunnerStopResult> {
  return runnerRequest<RunnerStopResult>(workerId, "stop", { method: "POST" })
}

export async function deprovisionWorkerOnSelfHosted(workerId: WorkerId) {
  try {
    await runnerRequest(workerId, "", { method: "DELETE" })
  } catch (error) {
    if (!(error instanceof SelfHostedWorkerMissingError)) throw error
  }
}

export async function inspectSelfHostedWorker(workerId: WorkerId) {
  try {
    const worker = await runnerRequest<RunnerWorker>(workerId)
    return { state: worker.state }
  } catch (error) {
    if (error instanceof SelfHostedWorkerMissingError) return null
    throw error
  }
}

export async function getSelfHostedWorkerInternalUrl(workerId: WorkerId) {
  const cached = internalUrlCache.get(workerId)
  if (cached && cached.expiresAt > Date.now()) return cached.url
  const worker = await runnerRequest<RunnerWorker>(workerId)
  if (worker.state !== "running") throw new Error(`Self-hosted worker ${workerId} is not running`)
  const url = worker.internalUrl.replace(/\/+$/, "")
  internalUrlCache.set(workerId, { url, expiresAt: Date.now() + 30_000 })
  return url
}

const hopByHopHeaders = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
])

function forwardedHeaders(headers: Headers) {
  const forwarded = new Headers()
  headers.forEach((value, name) => {
    if (!hopByHopHeaders.has(name.toLowerCase())) forwarded.set(name, value)
  })
  return forwarded
}

export async function proxySelfHostedWorkerRequest(request: Request, workerId: WorkerId, path: string) {
  const internalUrl = await getSelfHostedWorkerInternalUrl(workerId)
  const requestUrl = new URL(request.url)
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  const target = `${internalUrl}${normalizedPath}${requestUrl.search}`
  const method = request.method.toUpperCase()
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer()
  const upstream = await fetch(target, {
    method,
    headers: forwardedHeaders(request.headers),
    body,
    redirect: "manual",
    signal: request.signal,
  })
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: forwardedHeaders(upstream.headers),
  })
}

export async function getSelfHostedWorkerRecord(workerId: WorkerId) {
  try {
    const worker = await runnerRequest<RunnerWorker>(workerId)
    return {
      sandbox_id: worker.containerName,
      signed_preview_url: publicWorkerUrl(workerId),
      signed_preview_url_expires_at: new Date("9999-12-31T23:59:59.000Z"),
    }
  } catch (error) {
    if (error instanceof SelfHostedWorkerMissingError) return null
    throw error
  }
}

export async function refreshSelfHostedWorkerUrl(workerId: WorkerId) {
  return getSelfHostedWorkerRecord(workerId)
}

export async function flushSelfHostedWorkerCheckpoint(workerId: WorkerId) {
  const worker = await inspectSelfHostedWorker(workerId)
  return Boolean(worker)
}

export function isSelfHostedWorkerMissingError(error: unknown) {
  return error instanceof SelfHostedWorkerMissingError
    || (error instanceof Error && error.name === "SelfHostedWorkerMissingError")
}

export function selfHostedWorkerImageVersion() {
  return env.selfHosted.workerImageVersion ?? null
}
