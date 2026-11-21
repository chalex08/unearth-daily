import { describe, expect, it } from 'vitest';
import { puzzle14 } from '../../shared/fixtures/puzzle-14';
import { fakeCounts } from './fakeCounts';

// Small deterministic generator so the test is stable.
const seeded = (s: number) => () => (s = (s * 16807) % 2147483647) / 2147483647;

describe('fakeCounts', () => {
  const { answers, ends } = fakeCounts(puzzle14, 600, seeded(42));
  const total = (layer: Record<string, number>) =>
    Object.values(layer).reduce((a, b) => a + b, 0);

  it('accounts for every player exactly once in the graveyard', () => {
    expect(ends).toHaveLength(11);
    expect(ends.reduce((a, b) => a + b, 0)).toBe(600);
    expect(ends.every((n) => n >= 0)).toBe(true);
  });

  it('counts one valid answer per player who cleared each layer', () => {
    let reached = 600;
    answers.forEach((layer, i) => {
      reached -= ends[i]!;
      expect(total(layer)).toBe(reached);
    });
  });

  it('only uses pool canonicals, and common answers outnumber rare ones', () => {
    answers.forEach((layer, i) => {
      const pool = puzzle14.layers[i]!.pool.map((a) => a.canonical);
      expect(Object.keys(layer).every((k) => pool.includes(k))).toBe(true);
    });
    // common weight 12×(0.4–1.4) always beats rare 0.6×(0.4–1.4)
    expect(answers[5]!['navel orange']!).toBeGreaterThan(
      answers[5]!['seville orange'] ?? 0
    );
  });
});
