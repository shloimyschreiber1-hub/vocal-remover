// Billing rule: one credit covers up to 6 minutes of audio. Longer tracks use
// an extra credit for every additional (started) 6-minute block.
export const SECONDS_PER_CREDIT = 6 * 60 // 360s = 6 minutes
export const MINUTES_PER_CREDIT = 6

// How many credits a track of the given length (in seconds) costs.
// Always at least 1, even for very short clips.
export function creditsForDuration(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 1
  return Math.max(1, Math.ceil(seconds / SECONDS_PER_CREDIT))
}
