// Timings (ms) for the moment-to-moment feel. The table in docs/DESIGN.md §13 is written from this file.
import type { RarityBand } from '../shared/game';

/** Layer 10 has no band (SPEC §3.2) but gets the Mother Lode treatment. */
export type Look = RarityBand;

/** A strike, in ms from the server's answer. Rarer bands linger longer; then the camera descends (600ms). */
export const STRIKE = {
  /** The pickaxe swings in and hits. Strike sound, shake, debris and haptics all fire here. */
  impact: 110,
  shake: 140,
  /** The answer is chiselled into the stratum, from the impact. */
  chisel: 180,
  /** The ore starts showing 90ms after impact; how long it takes to settle depends on the band. */
  ore: 200,
  oreMs: { Common: 160, Seam: 260, Vein: 380, 'Mother Lode': 520 },
  /** Shake strength, as a fraction of the screen. */
  shakeBy: { Common: 0.003, Seam: 0.004, Vein: 0.006, 'Mother Lode': 0.008 },
  /** The in-world score label shows from the end of the ore reveal and fades over `labelOut`. */
  labelIn: 120,
  labelOut: 150,
  /** Strike start to the camera descending (or a tap). */
  hold: { Common: 1000, Seam: 1500, Vein: 2000, 'Mother Lode': 2500 },
} as const;

/** A wrong answer: the word flies at the rock, clinks, bounces off. Typing never waits for it. */
export const WRONG = { hit: 120, bounce: 300 } as const;
export const WRONG_MS = WRONG.hit + WRONG.bounce;

/** When the score label appears: once the ore has settled. */
export const labelAt = (look: Look) => STRIKE.ore + STRIKE.oreMs[look];
