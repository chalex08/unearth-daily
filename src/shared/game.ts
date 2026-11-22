// Pure game rules: minerals, rarity, scoring, the run state machine, share text, days and streaks.
// SPEC §2–§4 and §6.6. No Devvit imports.

import { LAYER_COUNT, matchAnswer, normalise } from './puzzle';
import type { AnswerEntry, Commonness } from './puzzle';

export type Mineral = { name: string; base: number; emoji: string };

/** Index = deepest layer cleared. SPEC §3.1. */
export const MINERALS: readonly Mineral[] = [
  { name: 'Surface', base: 0, emoji: '🌱' },
  { name: 'Dirt', base: 10, emoji: '🟫' },
  { name: 'Clay', base: 20, emoji: '🟧' },
  { name: 'Stone', base: 30, emoji: '🪨' },
  { name: 'Coal', base: 50, emoji: '⬛' },
  { name: 'Copper', base: 75, emoji: '🟠' },
  { name: 'Iron', base: 100, emoji: '🔩' },
  { name: 'Silver', base: 150, emoji: '🥈' },
  { name: 'Gold', base: 200, emoji: '🥇' },
  { name: 'Diamond', base: 300, emoji: '💎' },
  { name: 'Uranium', base: 500, emoji: '☢️' },
];

export const mineral = (layer: number): Mineral =>
  MINERALS[layer] ?? MINERALS[0]!;

/** Most to least common: loose bits, one chunk, a cluster, a line, the whole deposit. SPEC §3.2. */
export const BANDS = [
  'Rubble',
  'Nugget',
  'Pocket',
  'Vein',
  'Mother Lode',
] as const;
export type RarityBand = (typeof BANDS)[number];

const BONUS_PERCENT: Record<RarityBand, number> = {
  Rubble: 0,
  Nugget: 25,
  Pocket: 50,
  Vein: 100,
  'Mother Lode': 200,
};

/** Plain-words rarity shown under the band name. */
export const BAND_RARITY: Record<RarityBand, string> = {
  Rubble: 'Everywhere',
  Nugget: 'Plenty',
  Pocket: 'Scarce',
  Vein: 'Hidden',
  'Mother Lode': 'Fabled',
};

const COLD_START_BAND: Record<Commonness, RarityBand> = {
  common: 'Rubble',
  uncommon: 'Nugget',
  rare: 'Pocket',
};

export const COLD_START_THRESHOLD = 50;

/**
 * SPEC §3.2. `count` = valid answers at this layer with this canonical, `total` = all valid answers
 * at this layer, both including the answer being scored. `commonness` is null for non-pool answers.
 */
export function rarityBand(
  count: number,
  total: number,
  commonness: Commonness | null
): { band: RarityBand; estimated: boolean } {
  if (total < COLD_START_THRESHOLD)
    return {
      band: commonness ? COLD_START_BAND[commonness] : 'Pocket',
      estimated: true,
    };
  // Integer comparisons so exact boundaries (25%, 10%, 4%, 1%) don't hit float error.
  const band: RarityBand =
    count * 100 > total * 25
      ? 'Rubble'
      : count * 100 >= total * 10
        ? 'Nugget'
        : count * 100 >= total * 4
          ? 'Pocket'
          : count * 100 >= total
            ? 'Vein'
            : 'Mother Lode';
  return { band, estimated: false };
}

/** Base + rounded rarity bonus. Layer 10 gets no bonus (band is null there). */
export function layerPoints(layer: number, band: RarityBand | null): number {
  const base = mineral(layer).base;
  return base + (band ? Math.round((base * BONUS_PERCENT[band]) / 100) : 0);
}

export const PICKAXES = 3;
export const PICKAXE_BONUS = 50;
export const MAX_ANSWER_LENGTH = 40;

export type MoveResult =
  | { kind: 'ignored'; reason: 'empty' | 'too-long' | 'reused' }
  | {
      kind: 'valid';
      layer: number;
      /** What the player typed, normalised. Always shown to that player. */
      answer: string;
      canonical: string;
      band: RarityBand | null;
      estimated: boolean;
      points: number;
    }
  | { kind: 'invalid'; reason: string };

export type ClearedLayer = Extract<MoveResult, { kind: 'valid' }>;

/** Plain JSON, so it can be stored and resumed as is. */
export type RunState = {
  puzzleNumber: number;
  pickaxes: number;
  cleared: ClearedLayer[];
  /** Normalised inputs and canonicals already tried this run (valid or not). */
  used: string[];
  /** Answers that broke a pickaxe, for the end-screen chain (SPEC §6.6). Absent on older runs. */
  misses?: { layer: number; answer: string; reason: string }[];
};

export type RunStatus = 'playing' | 'cleared' | 'caved-in';

export const startRun = (puzzleNumber: number): RunState => ({
  puzzleNumber,
  pickaxes: PICKAXES,
  cleared: [],
  used: [],
});

export const currentLayer = (run: RunState): number => run.cleared.length + 1;

export function runStatus(run: RunState): RunStatus {
  if (run.cleared.length === LAYER_COUNT) return 'cleared';
  return run.pickaxes === 0 ? 'caved-in' : 'playing';
}

/**
 * SPEC §4 steps 1–4. Ignored input costs nothing. On `ok`, `match` is the pool entry, or null when
 * the caller must go on to the verdict cache / AI judge.
 */
export function checkAnswer(
  run: RunState,
  raw: string,
  pool: AnswerEntry[]
):
  | Extract<MoveResult, { kind: 'ignored' }>
  | { kind: 'ok'; answer: string; match: AnswerEntry | null } {
  const answer = normalise(raw);
  if (!answer) return { kind: 'ignored', reason: 'empty' };
  if (answer.length > MAX_ANSWER_LENGTH)
    return { kind: 'ignored', reason: 'too-long' };
  const match = matchAnswer(pool, answer);
  if (
    run.used.includes(answer) ||
    (match && run.used.includes(normalise(match.canonical)))
  )
    return { kind: 'ignored', reason: 'reused' };
  return { kind: 'ok', answer, match };
}

export type Verdict =
  | {
      valid: true;
      answer: string;
      canonical: string;
      band: RarityBand;
      estimated: boolean;
    }
  | { valid: false; answer: string; reason: string };

/** Applies a decided answer to the run. Returns a new state; the input state is not changed. */
export function applyAnswer(
  run: RunState,
  verdict: Verdict
): { run: RunState; result: MoveResult } {
  if (runStatus(run) !== 'playing') throw new Error('run is over');
  const key = normalise(verdict.valid ? verdict.canonical : verdict.answer);
  if (run.used.includes(key) || run.used.includes(verdict.answer))
    return { run, result: { kind: 'ignored', reason: 'reused' } };
  const used = [...new Set([...run.used, verdict.answer, key])];

  if (!verdict.valid) {
    return {
      run: {
        ...run,
        pickaxes: run.pickaxes - 1,
        used,
        misses: [
          ...(run.misses ?? []),
          {
            layer: currentLayer(run),
            answer: verdict.answer,
            reason: verdict.reason,
          },
        ],
      },
      result: { kind: 'invalid', reason: verdict.reason },
    };
  }
  const layer = currentLayer(run);
  const band = layer === LAYER_COUNT ? null : verdict.band;
  const result: ClearedLayer = {
    kind: 'valid',
    layer,
    answer: verdict.answer,
    canonical: verdict.canonical,
    band,
    estimated: band ? verdict.estimated : false,
    points: layerPoints(layer, band),
  };
  return { run: { ...run, cleared: [...run.cleared, result], used }, result };
}

const isRare = (c: ClearedLayer) =>
  c.band === 'Pocket' || c.band === 'Vein' || c.band === 'Mother Lode';

/** SPEC §3.3. The pickaxe bonus counts whatever is left, so call it once the run is over. */
export function scoreRun(run: RunState): {
  total: number;
  rareFinds: number;
  hero: Mineral;
} {
  const layers = run.cleared.reduce((sum, c) => sum + c.points, 0);
  return {
    total: layers + run.pickaxes * PICKAXE_BONUS,
    rareFinds: run.cleared.filter(isRare).length,
    hero: mineral(run.cleared.length),
  };
}

/** SPEC §6.6 spoiler-free share text. */
export function shareText(run: RunState): string {
  const { total, rareFinds, hero } = scoreRun(run);
  const strata = run.cleared.length
    ? run.cleared.map((c) => mineral(c.layer).emoji).join('')
    : MINERALS[0]!.emoji;
  const broken = '💥'.repeat(PICKAXES - run.pickaxes);
  const finds = `✨ ${rareFinds} rare ${rareFinds === 1 ? 'find' : 'finds'}`;
  return [
    `Unearth #${run.puzzleNumber} — ${hero.emoji} ${hero.name} · ${total} pts`,
    strata,
    broken ? `${finds} · ${broken}` : finds,
  ].join('\n');
}

export type DayStats = {
  players: number;
  /** Runs ended per mineral, index = deepest layer cleared (the graveyard). */
  ended: number[];
  /** Per layer (index 0 = layer 1): valid answers by canonical. */
  answers: Record<string, number>[];
};

/** UTC day key, YYYY-MM-DD. */
export const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

export type Streak = { count: number; lastDay: string };

/** SPEC §3.3: call when a run finishes. A missed UTC day restarts the count. */
export function updateStreak(streak: Streak | null, today: string): Streak {
  // >=: yesterday's run finished after today's (it spanned midnight) changes nothing.
  if (streak && streak.lastDay >= today) return streak;
  const yesterday = dayKey(new Date(Date.parse(today) - 86_400_000));
  return {
    count: streak?.lastDay === yesterday ? streak.count + 1 : 1,
    lastDay: today,
  };
}

/** The streak to display today: 0 once a UTC day has been missed. */
export function currentStreak(streak: Streak | null, today: string): number {
  if (!streak) return 0;
  const yesterday = dayKey(new Date(Date.parse(today) - 86_400_000));
  return streak.lastDay === today || streak.lastDay === yesterday
    ? streak.count
    : 0;
}

/** Day of puzzle #1. Puzzle number = UTC days since this date + 1. */
export const LAUNCH_DAY = '2026-11-08';

export const puzzleNumber = (day: string): number =>
  Math.round((Date.parse(day) - Date.parse(LAUNCH_DAY)) / 86_400_000) + 1;
