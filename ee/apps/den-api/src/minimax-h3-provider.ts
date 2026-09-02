import { createHash } from "node:crypto"
import type { VideoGenerationInput } from "@openwork/minimax-h3-video"
import { z } from "zod"

type FetchImplementation = typeof globalThis.fetch
const GENERATE_PATH = "/v2/video_generation"
const QUERY_PATH = "/v2/query/video_generation/"
const PROVIDER_MUTATION_TIMEOUT_MS = 120_000
const PROVIDER_QUERY_TIMEOUT_MS = 60_000
const PROVIDER_DOWNLOAD_TIMEOUT_MS = 120_000
const MAX_RESULT_BYTES = 100 * 1024 * 1024

const uploadResponseSchema = z.object({
  base_resp: z.object({
    status_code: z.number(),
    status_msg: z.string().optional(),
  }).passthrough().optional(),
  file: z.object({
    file_id: z.union([z.string().min(1).max(255), z.number()]).optional(),
    download_url: z.string().url().max(2_048).optional(),
  }).passthrough().optional(),
  file_id: z.string().min(1).max(255).optional(),
  url: z.string().url().max(2_048).optional(),
  data: z.object({
    file_id: z.string().min(1).max(255).optional(),
    url: z.string().url().max(2_048).optional(),
  }).passthrough().optional(),
}).passthrough()

const generationResponseSchema = z.object({
  base_resp: z.object({
    status_code: z.number(),
    status_msg: z.string().optional(),
  }).passthrough().optional(),
  task: z.object({ task_id: z.string().min(1).max(255) }).passthrough().optional(),
  task_id: z.string().min(1).max(255).optional(),
  data: z.object({ task_id: z.string().min(1).max(255).optional() }).passthrough().optional(),
}).passthrough()

const queryResponseSchema = z.object({
  base_resp: z.object({
    status_code: z.number(),
    status_msg: z.string().optional(),
  }).passthrough().optional(),
  task: z.object({
    status: z.string(),
    content: z.object({ url: z.string().url().max(2_048).optional() }).passthrough().optional(),
    error: z.object({ message: z.string().optional() }).passthrough().optional(),
  }).passthrough().optional(),
  status: z.string().optional(),
  file_url: z.string().url().max(2_048).optional(),
  video_url: z.string().url().max(2_048).optional(),
  error_code: z.union([z.string(), z.number()]).optional(),
  data: z.object({
    status: z.string().optional(),
    file_url: z.string().url().max(2_048).optional(),
    video_url: z.string().url().max(2_048).optional(),
    error_code: z.union([z.string(), z.number()]).optional(),
  }).passthrough().optional(),
}).passthrough()

export type H3ProviderStatus =
  | { state: "submitted" | "running" }
  | { state: "succeeded"; resultUrl: string }
  | { state: "failed"; failureCode: string }

export class H3ProviderError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = "H3ProviderError"
  }
}

function normalizedTransportError(error: unknown) {
  if (error instanceof H3ProviderError) return error
  if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new H3ProviderError("PROVIDER_TIMEOUT")
  }
  return new H3ProviderError("PROVIDER_NETWORK_ERROR")
}

async function fetchWithTimeout(
  fetchImpl: FetchImplementation,
  input: Parameters<FetchImplementation>[0],
  init: RequestInit,
  timeoutMilliseconds: number,
) {
  try {
    return await fetchImpl(input, { ...init, signal: AbortSignal.timeout(timeoutMilliseconds) })
  } catch (error) {
    throw normalizedTransportError(error)
  }
}

function normalizeBaseUrl(value: string) {
  const parsed = new URL(value)
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new H3ProviderError("PROVIDER_BASE_URL_HTTPS_REQUIRED")
  }
  return parsed.toString().replace(/\/$/, "")
}

async function jsonOrProviderError(response: Response) {
  if (!response.ok) throw new H3ProviderError(`PROVIDER_HTTP_${response.status}`)
  try {
    return await response.json()
  } catch {
    throw new H3ProviderError("PROVIDER_RESPONSE_INVALID")
  }
}

function assertBaseResponseSucceeded(payload: { base_resp?: { status_code: number } }) {
  if (payload.base_resp && payload.base_resp.status_code !== 0) {
    throw new H3ProviderError("PROVIDER_REQUEST_REJECTED")
  }
}

function normalizedProviderFailureCode(value: string | number | undefined) {
  if (value === undefined) return "PROVIDER_FAILED"
  const code = String(value).trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, "_").slice(0, 96)
  return code ? `PROVIDER_${code}` : "PROVIDER_FAILED"
}

export function hasSupportedVideoContainer(bytes: Uint8Array) {
  if (bytes.byteLength < 4_096) return false
  const isMp4 = String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0) === "ftyp"
  const isWebM = bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  return isMp4 || isWebM
}

export function validatePersistedVideoResult(input: {
  downloadedHash: string
  persistedHash: string
  persistedBytes: Uint8Array
  persistedByteLength: number
}) {
  if (input.downloadedHash !== input.persistedHash) return "RESULT_CHANGED_ACROSS_RETRY" as const
  if (
    input.persistedByteLength !== input.persistedBytes.byteLength ||
    !hasSupportedVideoContainer(input.persistedBytes) ||
    createHash("sha256").update(input.persistedBytes).digest("hex") !== input.persistedHash
  ) return "RESULT_PERSISTENCE_INVALID" as const
  return null
}

export class MetaSoH3Provider {
  private readonly baseUrl: string

  constructor(
    private readonly apiKey: string,
    baseUrl = "https://metaso.cn/api/minimax",
    private readonly fetchImpl: FetchImplementation = globalThis.fetch,
    private readonly resultHosts: readonly string[] = [],
  ) {
    if (!apiKey.trim()) throw new H3ProviderError("PROVIDER_CREDENTIAL_MISSING")
    this.baseUrl = normalizeBaseUrl(baseUrl)
  }

  private authorizationHeaders() {
    return { Authorization: `Bearer ${this.apiKey}` }
  }

  async uploadFirstFrame(input: { bytes: Uint8Array; contentType: string; filename: string }) {
    const form = new FormData()
    const fileBuffer = new ArrayBuffer(input.bytes.byteLength)
    new Uint8Array(fileBuffer).set(input.bytes)
    form.set("file", new Blob([fileBuffer], { type: input.contentType }), input.filename)
    form.set("purpose", "video_generation_input")
    const response = await fetchWithTimeout(this.fetchImpl, `${this.baseUrl}/v1/files/upload`, {
      method: "POST",
      headers: this.authorizationHeaders(),
      body: form,
    }, PROVIDER_MUTATION_TIMEOUT_MS)
    const payload = uploadResponseSchema.safeParse(await jsonOrProviderError(response))
    if (!payload.success) throw new H3ProviderError("PROVIDER_UPLOAD_RESPONSE_INVALID")
    assertBaseResponseSucceeded(payload.data)
    const officialFileId = payload.data.file?.file_id
    const reference = officialFileId !== undefined
      ? `mm_file://${officialFileId}`
      : payload.data.file?.download_url
        ?? payload.data.file_id
        ?? payload.data.url
        ?? payload.data.data?.file_id
        ?? payload.data.data?.url
    if (!reference) throw new H3ProviderError("PROVIDER_UPLOAD_REFERENCE_MISSING")
    return reference
  }

  async submit(input: VideoGenerationInput & { directedPrompt: string; firstFrameReference?: string }) {
    const response = await fetchWithTimeout(this.fetchImpl, `${this.baseUrl}${GENERATE_PATH}`, {
      method: "POST",
      headers: {
        ...this.authorizationHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "MiniMax-H3",
        content: [
          { type: "text", text: input.directedPrompt },
          ...(input.firstFrameReference
            ? [{ type: "image", image_url: { url: input.firstFrameReference }, role: "first_frame" }]
            : []),
        ],
        resolution: input.resolution,
        duration: input.durationSeconds,
        ...(input.mode === "text_to_video" ? { ratio: input.aspectRatio } : {}),
      }),
    }, PROVIDER_MUTATION_TIMEOUT_MS)
    const payload = generationResponseSchema.safeParse(await jsonOrProviderError(response))
    if (!payload.success) throw new H3ProviderError("PROVIDER_SUBMIT_RESPONSE_INVALID")
    assertBaseResponseSucceeded(payload.data)
    const taskId = payload.data.task?.task_id ?? payload.data.task_id ?? payload.data.data?.task_id
    if (!taskId) throw new H3ProviderError("PROVIDER_TASK_ID_MISSING")
    return { taskId }
  }

  async query(taskId: string): Promise<H3ProviderStatus> {
    const response = await fetchWithTimeout(
      this.fetchImpl,
      `${this.baseUrl}${QUERY_PATH}${encodeURIComponent(taskId)}`,
      { headers: this.authorizationHeaders() },
      PROVIDER_QUERY_TIMEOUT_MS,
    )
    const payload = queryResponseSchema.safeParse(await jsonOrProviderError(response))
    if (!payload.success) throw new H3ProviderError("PROVIDER_QUERY_RESPONSE_INVALID")
    assertBaseResponseSucceeded(payload.data)
    const status = (payload.data.task?.status ?? payload.data.status ?? payload.data.data?.status ?? "").trim().toLowerCase()
    const resultUrl = payload.data.task?.content?.url
      ?? payload.data.file_url
      ?? payload.data.video_url
      ?? payload.data.data?.file_url
      ?? payload.data.data?.video_url
    if (["success", "succeeded", "completed", "complete", "done"].includes(status)) {
      if (!resultUrl) return { state: "failed", failureCode: "PROVIDER_RESULT_MISSING" }
      return { state: "succeeded", resultUrl }
    }
    if (["fail", "failed", "error", "rejected", "cancelled", "canceled", "expired"].includes(status)) {
      return {
        state: "failed",
        failureCode: normalizedProviderFailureCode(payload.data.error_code ?? payload.data.data?.error_code),
      }
    }
    return { state: ["queueing", "queued", "submitted", "pending"].includes(status) ? "submitted" : "running" }
  }

  async downloadResult(resultUrl: string) {
    const url = new URL(resultUrl)
    const allowed = this.resultHosts.some((host) => host.trim().toLowerCase() === url.hostname.toLowerCase())
    if (url.protocol !== "https:" || !allowed) {
      throw new H3ProviderError("PROVIDER_RESULT_URL_REJECTED")
    }
    const response = await fetchWithTimeout(this.fetchImpl, url, { redirect: "error" }, PROVIDER_DOWNLOAD_TIMEOUT_MS)
    if (!response.ok) throw new H3ProviderError(`PROVIDER_RESULT_HTTP_${response.status}`)
    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
    if (!contentType.startsWith("video/")) throw new H3ProviderError("PROVIDER_RESULT_CONTENT_TYPE_INVALID")
    const contentLengthHeader = response.headers.get("content-length")
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader)
      if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_RESULT_BYTES) {
        throw new H3ProviderError("PROVIDER_RESULT_BYTES_INVALID")
      }
    }
    if (!response.body) throw new H3ProviderError("PROVIDER_RESULT_BYTES_INVALID")
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) break
        totalBytes += result.value.byteLength
        if (totalBytes > MAX_RESULT_BYTES) {
          await reader.cancel()
          throw new H3ProviderError("PROVIDER_RESULT_BYTES_INVALID")
        }
        chunks.push(result.value)
      }
    } catch (error) {
      throw normalizedTransportError(error)
    }
    const bytes = new Uint8Array(totalBytes)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    if (!hasSupportedVideoContainer(bytes)) {
      throw new H3ProviderError("PROVIDER_RESULT_BYTES_INVALID")
    }
    return { bytes, contentType }
  }
}

export function createMetaSoH3ProviderFromEnvironment(environment: NodeJS.ProcessEnv = process.env) {
  const apiKey = environment.RENWORK_METASO_H3_API_KEY?.trim()
  if (!apiKey) throw new H3ProviderError("PROVIDER_CREDENTIAL_MISSING")
  const resultHosts = (environment.RENWORK_METASO_H3_RESULT_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  return new MetaSoH3Provider(apiKey, environment.RENWORK_METASO_H3_BASE_URL, globalThis.fetch, resultHosts)
}
