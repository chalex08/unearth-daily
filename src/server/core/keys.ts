// Every Redis key the app uses. Documented with TTLs in SPEC §8.1.

/** 30 days, for everything tied to a day or a user (Devvit data-retention guidance). */
export const TTL_SECONDS = 30 * 86_400;

export const keys = {
  /** Hash, field `state`: this user's RunState JSON for the day. */
  run: (day: string, userId: string) => `run:${day}:${userId}`,
  /** Counter used as a 15s lock so one user's submits run one at a time. */
  lock: (day: string, userId: string) => `lock:${day}:${userId}`,
  /** Sorted set: canonical answer → valid answers given at this layer (pool and AI-approved). */
  answers: (day: string, layer: number) => `answers:${day}:${layer}`,
  /** Hash: layer → all valid answers given at that layer. */
  totals: (day: string) => `totals:${day}`,
  /** Hash: deepest layer cleared (0–10, the mineral) → runs that ended there. */
  ends: (day: string) => `ends:${day}`,
  /** Hash: mineral (0–10) → players who reached it; 0 = runs started. */
  reached: (day: string) => `reached:${day}`,
  /** Hash: normalised answer → cached JudgeVerdict JSON for this layer. */
  verdicts: (day: string, layer: number) => `verdicts:${day}:${layer}`,
  /** Hash, field `id`: the app's stickied comment on this post, which shared results reply to. */
  sticky: (postId: string) => `sticky:${postId}`,
  /** Hash, field `post`: the day's post id (`creating` while it's being made). One post per day. */
  daily: (day: string) => `daily:${day}`,
  /** Hash: `count`, `lastDay` (the Streak), `best` (deepest mineral ever), `prompted` (join prompt shown), `onboarded` (hints dismissed). */
  user: (userId: string) => `user:${userId}`,
};
