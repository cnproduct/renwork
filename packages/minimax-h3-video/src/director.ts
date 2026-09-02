import type { VideoGenerationInput } from "./contracts.js"

export type H3Direction = {
  prompt: string
  assetRoles: Array<{ role: "first_frame"; assetId: string }>
  acceptanceCriteria: string[]
}

function compact(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

/**
 * Deterministic prompt direction kept in a pure package so quote validation,
 * retries, and audits all operate on the exact same creative instruction.
 */
export function directH3Video(input: VideoGenerationInput): H3Direction {
  const prompt = compact(input.prompt)
  const framing = input.aspectRatio === "9:16"
    ? "vertical composition, subject inside mobile safe area"
    : input.aspectRatio === "1:1"
      ? "square composition, centered visual hierarchy"
      : "cinematic widescreen composition"
  const continuity = input.mode === "first_frame_to_video"
    ? "preserve the supplied first frame's subject identity, product geometry, colors, and scene continuity"
    : "maintain stable subject identity, product geometry, colors, and temporal continuity"
  const anchor = input.mode === "first_frame_to_video"
    ? "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.\n\n"
    : ""
  const integratedDescription = [
    `integrated_multimodal_description: [Shot 1] ${prompt}.`,
    `${framing}; ${continuity}; deliberate camera motion; physically coherent movement.`,
    `Settle into a readable final hold before ${input.durationSeconds.toFixed(2)} seconds.`,
    "No incidental captions or third-party logos; preserve required AI provenance markings; no morphing, duplicate objects, or abrupt cuts.",
  ].join(" ")

  return {
    prompt: `${anchor}${integratedDescription}\n\noverall_soundscape: Coherent ambient and physical sounds synchronized to visible actions.\n\nnon_diegetic_music: none`,
    assetRoles: input.firstFrameAssetId
      ? [{ role: "first_frame", assetId: input.firstFrameAssetId }]
      : [],
    acceptanceCriteria: [
      `Duration is ${input.durationSeconds} seconds at 768P.`,
      "The main subject remains recognizable and spatially consistent.",
      "The delivered file is a playable video with non-empty bytes.",
      "Required AI provenance markings remain intact.",
    ],
  }
}
