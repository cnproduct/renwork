import { z } from "zod"

export const videoGenerationModeSchema = z.enum(["text_to_video", "first_frame_to_video"])
export const videoGenerationResolutionSchema = z.literal("768P")
export const videoGenerationStatusSchema = z.enum([
  "submitted",
  "running",
  "succeeded",
  "failed",
])

export type FirstFrameDimensionValidation =
  | { ok: true }
  | { ok: false; code: "FIRST_FRAME_DIMENSIONS_TOO_SMALL" | "FIRST_FRAME_ASPECT_RATIO_INVALID" | "FIRST_FRAME_PIXEL_LIMIT_EXCEEDED" }

export function validateFirstFrameDimensions(width: number, height: number): FirstFrameDimensionValidation {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 256 || height < 256) {
    return { ok: false, code: "FIRST_FRAME_DIMENSIONS_TOO_SMALL" }
  }
  const ratio = width / height
  if (ratio < 2 / 5 || ratio > 5 / 2) {
    return { ok: false, code: "FIRST_FRAME_ASPECT_RATIO_INVALID" }
  }
  if (width * height > 40_000_000) {
    return { ok: false, code: "FIRST_FRAME_PIXEL_LIMIT_EXCEEDED" }
  }
  return { ok: true }
}

export const videoGenerationInputSchema = z.object({
  mode: videoGenerationModeSchema,
  resolution: videoGenerationResolutionSchema,
  durationSeconds: z.number().int().min(4).max(8),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  prompt: z.string().trim().max(4_000),
  firstFrameAssetId: z.string().trim().min(1).max(64).optional(),
}).superRefine((input, context) => {
  if (!input.prompt) {
    context.addIssue({ code: "custom", path: ["prompt"], message: "PROMPT_REQUIRED" })
  }
  if (input.mode === "first_frame_to_video" && !input.firstFrameAssetId) {
    context.addIssue({ code: "custom", path: ["firstFrameAssetId"], message: "FIRST_FRAME_REQUIRED" })
  }
  if (input.mode === "text_to_video" && input.firstFrameAssetId) {
    context.addIssue({ code: "custom", path: ["firstFrameAssetId"], message: "FIRST_FRAME_NOT_ALLOWED" })
  }
})

export const createVideoQuoteSchema = videoGenerationInputSchema
export const createVideoJobSchema = z.object({
  quoteId: z.string().trim().min(1).max(64),
  confirmed: z.literal(true),
})

export type VideoGenerationInput = z.infer<typeof videoGenerationInputSchema>
export type VideoGenerationMode = z.infer<typeof videoGenerationModeSchema>
export type VideoGenerationStatus = z.infer<typeof videoGenerationStatusSchema>

export type VideoGenerationCapability = {
  visible: boolean
  enabled: boolean
  modes: VideoGenerationMode[]
  resolution: "768P"
  minimumDurationSeconds: 4
  maximumDurationSeconds: 8
  maximumConcurrentJobs: 1
}

export type VideoQuote = {
  id: string
  amountMicroCredits: number
  priceVersion: string
  expiresAt: string
  direction: {
    directedPrompt: string
    assetRoles: Array<{ role: "first_frame"; assetId: string }>
    acceptanceCriteria: string[]
  }
}

export type MemberVideoJob = {
  id: string
  status: VideoGenerationStatus
  mode: VideoGenerationMode
  resolution: "768P"
  durationSeconds: number
  reservedMicroCredits: number
  capturedMicroCredits: number
  assetUrl: string | null
  taskHash: string
  resultHash: string | null
  failureCode: string | null
  createdAt: string
  updatedAt: string
}
