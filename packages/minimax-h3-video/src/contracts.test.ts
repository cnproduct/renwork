import { describe, expect, test } from "bun:test"
import { directH3Video } from "./director.js"
import { validateFirstFrameDimensions, videoGenerationInputSchema } from "./contracts.js"

describe("Phase 1 video contract", () => {
  test("accepts only the approved 768P, four-to-eight-second modes", () => {
    expect(videoGenerationInputSchema.safeParse({
      mode: "text_to_video",
      resolution: "768P",
      durationSeconds: 6,
      aspectRatio: "16:9",
      prompt: "A precision instrument rotating on a clean studio table",
    }).success).toBe(true)
    expect(videoGenerationInputSchema.safeParse({
      mode: "reference_video",
      resolution: "2K",
      durationSeconds: 15,
      aspectRatio: "16:9",
      prompt: "Unsupported",
    }).success).toBe(false)
  })

  test("requires a first frame before quote or billing", () => {
    const result = videoGenerationInputSchema.safeParse({
      mode: "first_frame_to_video",
      resolution: "768P",
      durationSeconds: 4,
      aspectRatio: "9:16",
      prompt: "Camera slowly approaches the product",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.message === "FIRST_FRAME_REQUIRED")).toBe(true)
  })

  test("director produces deterministic acceptance criteria", () => {
    const input = videoGenerationInputSchema.parse({
      mode: "text_to_video",
      resolution: "768P",
      durationSeconds: 8,
      aspectRatio: "1:1",
      prompt: "  A product   reveal  ",
    })
    const direction = directH3Video(input)
    expect(direction.prompt).toContain("A product reveal")
    expect(direction.prompt).toContain("integrated_multimodal_description: [Shot 1]")
    expect(direction.prompt).toContain("overall_soundscape:")
    expect(direction.prompt).toContain("non_diegetic_music: none")
    expect(direction.prompt).toContain("preserve required AI provenance markings")
    expect(direction.prompt).not.toContain("no captions, logos, watermarks")
    expect(direction.acceptanceCriteria).toContain("Duration is 8 seconds at 768P.")
  })

  test("rejects unsafe first-frame dimensions before quote or reserve", () => {
    expect(validateFirstFrameDimensions(256, 640)).toEqual({ ok: true })
    expect(validateFirstFrameDimensions(255, 640)).toEqual({ ok: false, code: "FIRST_FRAME_DIMENSIONS_TOO_SMALL" })
    expect(validateFirstFrameDimensions(256, 641)).toEqual({ ok: false, code: "FIRST_FRAME_ASPECT_RATIO_INVALID" })
    expect(validateFirstFrameDimensions(8_000, 8_000)).toEqual({ ok: false, code: "FIRST_FRAME_PIXEL_LIMIT_EXCEEDED" })
  })
})
