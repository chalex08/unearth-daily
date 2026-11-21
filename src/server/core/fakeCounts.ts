// Made-up answer counts for dev installs, so rarity, fossils and the graveyard have data to show.
// Generated locally from our own puzzle file with a random number generator: no AI, no Reddit data.
import type { Commonness, Puzzle } from '../../shared/puzzle';

/** Redis keys for per-day stats. Step 4 writes real counts to the same keys. */
export const keys = {
  /** Sorted set: canonical answer → valid answers given at this layer. */
  answers: (date: string, layer: number) => `answers:${date}:${layer}`,
  /** Hash: deepest layer cleared (0–10, the mineral) → runs that ended there. */
  ends: (date: string) => `ends:${date}`,
};

const WEIGHT: Record<Commonness, number> = {
  common: 12,
  uncommon: 3,
  rare: 0.6,
};
// Share of players who clear each layer after reaching it.
const SURVIVAL = [0.97, 0.93, 0.9, 0.85, 0.8, 0.72, 0.65, 0.6, 0.5, 0.45];

export type FakeCounts = {
  /** answers[i] = canonical → count for layer i + 1. */
  answers: Record<string, number>[];
  /** ends[l] = runs whose deepest cleared layer is l. */
  ends: number[];
};

export function fakeCounts(
  puzzle: Puzzle,
  players: number,
  rand: () => number
): FakeCounts {
  const reached = [players];
  for (const s of SURVIVAL) reached.push(Math.round(reached.at(-1)! * s));

  const answers = puzzle.layers.map((layer, i) => {
    const total = reached[i + 1]!;
    const weights = layer.pool.map(
      (a) => WEIGHT[a.commonness] * (0.4 + rand())
    );
    const sum = weights.reduce((x, y) => x + y, 0);
    const counts = weights.map((w) => Math.floor((w / sum) * total));
    // Hand the rounding leftovers to the most-weighted answer so the layer total is exact.
    const top = weights.indexOf(Math.max(...weights));
    counts[top]! += total - counts.reduce((x, y) => x + y, 0);
    return Object.fromEntries(
      layer.pool
        .map((a, j) => [a.canonical, counts[j]!])
        .filter(([, n]) => n !== 0)
    );
  });

  const ends = reached.map((n, l) => n - (reached[l + 1] ?? 0));
  return { answers, ends };
}
