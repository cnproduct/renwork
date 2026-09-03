import { describe, expect, test } from "bun:test"
import {
  hasSupportedVideoContainer,
  MetaSoH3Provider,
  createMetaSoH3ProviderFromEnvironment,
  validatePersistedVideoResult,
} from "../src/minimax-h3-provider.js"

describe("MetaSo H3 provider adapter", () => {
  test("requires an explicitly configured provider base URL", () => {
    expect(() => createMetaSoH3ProviderFromEnvironment({
      RENWORK_METASO_H3_API_KEY: "server-secret",
      RENWORK_METASO_H3_RESULT_HOSTS: "cdn.example.test",
    })).toThrow("PROVIDER_BASE_URL_MISSING")
  })

  test("submits the official text content shape without exposing credentials in the result", async () => {
    const requests: RequestInit[] = []
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async (_url, init) => {
      requests.push(init ?? {})
      return Response.json({ base_resp: { status_code: 0 }, task_id: "task-1" })
    })
    expect(await provider.submit({
      mode: "text_to_video",
      resolution: "768P",
      durationSeconds: 6,
      aspectRatio: "16:9",
      prompt: "ignored after direction",
      directedPrompt: "A directed scene",
    })).toEqual({ taskId: "task-1" })
    expect(requests[0]?.headers).toEqual(expect.objectContaining({ Authorization: "Bearer server-secret" }))
    expect(JSON.parse(String(requests[0]?.body))).toEqual({
      model: "MiniMax-H3",
      content: [{ type: "text", text: "A directed scene" }],
      resolution: "768P",
      duration: 6,
      ratio: "16:9",
    })
  })

  test("uploads the first frame with the official purpose and mm_file reference", async () => {
    let submittedBody: Record<string, unknown> | null = null
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async (url, init) => {
      if (String(url).endsWith("/v1/files/upload")) {
        const body = init?.body
        expect(body).toBeInstanceOf(FormData)
        if (!(body instanceof FormData)) throw new Error("expected multipart form")
        expect(body.get("purpose")).toBe("video_generation_input")
        return Response.json({ base_resp: { status_code: 0 }, file: { file_id: 42, download_url: "https://example.test/file" } })
      }
      submittedBody = JSON.parse(String(init?.body))
      return Response.json({ base_resp: { status_code: 0 }, task: { task_id: "task-i2v" } })
    })
    const reference = await provider.uploadFirstFrame({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/png",
      filename: "first-frame.png",
    })
    expect(reference).toBe("mm_file://42")
    expect(await provider.submit({
      mode: "first_frame_to_video",
      resolution: "768P",
      durationSeconds: 4,
      aspectRatio: "9:16",
      prompt: "source",
      directedPrompt: "Develop the opening frame",
      firstFrameReference: reference,
    })).toEqual({ taskId: "task-i2v" })
    expect(submittedBody).toEqual({
      model: "MiniMax-H3",
      content: [
        { type: "text", text: "Develop the opening frame" },
        { type: "image_url", image_url: { url: "mm_file://42" }, role: "first_frame" },
      ],
      resolution: "768P",
      duration: 4,
    })
  })

  test("uses the official upload download URL when a file ID is absent", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => Response.json({
      base_resp: { status_code: 0 },
      file: { download_url: "https://files.example.test/input.png" },
    }))
    expect(await provider.uploadFirstFrame({
      bytes: new Uint8Array([1]),
      contentType: "image/png",
      filename: "first-frame.png",
    })).toBe("https://files.example.test/input.png")
  })

  test("normalizes the official task response and refuses an empty delivery", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => Response.json({
      base_resp: { status_code: 0 },
      task: { status: "done", content: {} },
    }))
    expect(await provider.query("task-1")).toEqual({ state: "failed", failureCode: "PROVIDER_RESULT_MISSING" })
  })

  test("does not synthesize actual cost from an unaudited provider task response", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => Response.json({
      base_resp: { status_code: 0 },
      task: {
        status: "done",
        content: { url: "https://cdn.example.test/video.mp4" },
        actual_cost: 123,
      },
    }))
    expect(await provider.query("task-1")).toEqual({
      state: "succeeded",
      resultUrl: "https://cdn.example.test/video.mp4",
    })
  })

  test("normalizes cancelled official tasks as failures", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => Response.json({
      base_resp: { status_code: 0 },
      task: { status: "cancelled", error: { message: "policy" } },
    }))
    expect(await provider.query("task-1")).toEqual({ state: "failed", failureCode: "PROVIDER_FAILED" })
  })

  test("rejects result downloads outside the explicit host allowlist", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => {
      throw new Error("fetch must not be reached")
    }, ["cdn.example.test"])
    expect(provider.downloadResult("https://attacker.test/video.mp4")).rejects.toThrow("PROVIDER_RESULT_URL_REJECTED")
  })

  test("recognizes a minimum-length MP4 container before settlement", () => {
    const bytes = new Uint8Array(4_096)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    expect(hasSupportedVideoContainer(bytes)).toBe(true)
    expect(hasSupportedVideoContainer(new Uint8Array([0, 1, 2, 3]))).toBe(false)
  })

  test("rejects changed or corrupted persisted bytes before capture", async () => {
    const bytes = new Uint8Array(4_096)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    expect(validatePersistedVideoResult({
      downloadedHash: hash,
      persistedHash: hash,
      persistedBytes: bytes,
      persistedByteLength: bytes.byteLength,
    })).toBeNull()
    expect(validatePersistedVideoResult({
      downloadedHash: "b".repeat(64),
      persistedHash: hash,
      persistedBytes: bytes,
      persistedByteLength: bytes.byteLength,
    })).toBe("RESULT_CHANGED_ACROSS_RETRY")
    const corrupted = bytes.slice()
    corrupted[10] = 1
    expect(validatePersistedVideoResult({
      downloadedHash: hash,
      persistedHash: hash,
      persistedBytes: corrupted,
      persistedByteLength: corrupted.byteLength,
    })).toBe("RESULT_PERSISTENCE_INVALID")
  })

  test("downloads allowlisted results without following redirects", async () => {
    const bytes = new Uint8Array(4_096)
    bytes.set([0x66, 0x74, 0x79, 0x70], 4)
    let redirect: RequestRedirect | undefined
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async (_url, init) => {
      redirect = init?.redirect
      return new Response(bytes, { headers: { "Content-Type": "video/mp4" } })
    }, ["cdn.example.test"])
    expect((await provider.downloadResult("https://cdn.example.test/video.mp4")).bytes).toHaveLength(4_096)
    expect(redirect).toBe("error")
  })

  test("rejects an oversized declared result before reading it", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => new Response(
      new Uint8Array([1]),
      { headers: { "Content-Type": "video/mp4", "Content-Length": String(100 * 1024 * 1024 + 1) } },
    ), ["cdn.example.test"])
    expect(provider.downloadResult("https://cdn.example.test/video.mp4")).rejects.toThrow("PROVIDER_RESULT_BYTES_INVALID")
  })

  test("normalizes transport aborts as provider timeouts", async () => {
    const provider = new MetaSoH3Provider("server-secret", "https://example.test/api", async () => {
      throw new DOMException("timed out", "TimeoutError")
    })
    expect(provider.query("task-timeout")).rejects.toThrow("PROVIDER_TIMEOUT")
  })
})
