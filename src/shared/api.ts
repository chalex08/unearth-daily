// Request and response types for /api/*. The client only ever sees cleared clues, the current
// clue, and (after the run ends) the full chain. Never pools or future clues (SPEC §4).
import type { RarityBand, RunStatus } from './game';

/** One cleared layer. `answer` is what this player typed; always shown to them (SPEC §4.1). */
export type ChainLink = {
  layer: number;
  clue: string;
  answer: string;
  canonical: string;
  band: RarityBand | null;
  estimated: boolean;
  points: number;
};

/** POST /api/start: starts today's run or resumes it. */
export type RunResponse = {
  puzzleNumber: number;
  date: string;
  status: RunStatus;
  /** 1–10; the layer being dug. 11 once all ten are cleared. */
  layer: number;
  /** The current clue, or null once the run has ended (then call /api/result). */
  clue: string | null;
  chain: ChainLink[];
  lives: number;
  score: number;
  /** True until this player has started a first run (SPEC §6.2 hints). */
  onboarding: boolean;
};

/** POST /api/answer. `layer` is the layer the client thinks it is on; a stale one is rejected. */
export type AnswerRequest = { answer: string; layer: number };

/**
 * - `valid`: layer cleared.
 * - `invalid`: a pickaxe broke; `reason` says why.
 * - `ignored`: empty, too long or reused; nothing lost.
 * - `unchecked`: "Couldn't check that, try again"; nothing lost (SPEC §4 failure handling).
 */
export type AnswerOutcome = 'valid' | 'invalid' | 'ignored' | 'unchecked';

export type AnswerResult = {
  outcome: AnswerOutcome;
  valid: boolean;
  /** Normalised input. */
  answer: string;
  reason: string | null;
  canonical: string | null;
  mineral: string | null;
  base: number | null;
  band: RarityBand | null;
  estimated: boolean;
  bonus: number | null;
  /** Share of valid answers at this layer with this canonical, 0–100, one decimal. */
  percent: number | null;
  /** Running total (pickaxe bonus added once the run ends). */
  total: number;
  lives: number;
  /** Next clue while the run goes on, else null. */
  nextClue: string | null;
  ended: boolean;
};

/** GET /api/result: only after the run has ended. */
export type ResultResponse = {
  puzzleNumber: number;
  date: string;
  status: Exclude<RunStatus, 'playing'>;
  hero: string;
  total: number;
  rareFinds: number;
  lives: number;
  streak: number;
  share: string;
  /** All ten layers: the clue, plus this player's answer where cleared. */
  chain: { layer: number; clue: string; cleared: ChainLink | null }[];
  finalAnswer: string;
};

export type Fossil = {
  /** Pool canonical, or "something else" for answers only the AI accepted (SPEC §4.1). */
  answer: string;
  count: number;
  percent: number;
};

/** GET /api/stats. */
export type StatsResponse = {
  players: number;
  /** Index = mineral (deepest layer cleared): runs that ended there. */
  graveyard: number[];
  /** Index = mineral: players who reached it (index 0 = everyone who started). */
  reached: number[];
  /** Only for layers this player has cleared, index 0 = layer 1. */
  fossils: Fossil[][];
};

export type ErrorResponse = { error: string };
