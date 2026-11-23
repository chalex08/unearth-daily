import { describe, expect, it } from 'vitest';
import { puzzle14 } from './fixtures/puzzle-14';
import {
  matchAnswer,
  normalise,
  poolShapeErrors,
  validatePuzzle,
  type Puzzle,
} from './puzzle';

const clone = () => structuredClone(puzzle14);

describe('normalise', () => {
  it('lowercases, strips punctuation, collapses and trims whitespace', () => {
    expect(normalise('  Navel   ORANGE!! ')).toBe('navel orange');
    expect(normalise("Kum-quat's.")).toBe('kumquats');
    expect(normalise('\tsweet\n potato ')).toBe('sweet potato');
    expect(normalise(' ?! ')).toBe('');
  });
});

describe('matchAnswer', () => {
  const pool = puzzle14.layers[5]!.pool;
  it('matches canonicals and aliases, whatever the case', () => {
    expect(matchAnswer(pool, 'navel orange')?.canonical).toBe('navel orange');
    expect(matchAnswer(pool, normalise('Naval Orange'))?.canonical).toBe(
      'navel orange'
    );
    expect(matchAnswer(pool, 'orange')?.canonical).toBe('navel orange');
  });
  it('misses answers not in this layer', () => {
    expect(matchAnswer(pool, 'persimmon')).toBeNull();
  });
});

describe('validatePuzzle', () => {
  it('accepts puzzle #14', () => {
    expect(validatePuzzle(puzzle14)).toEqual([]);
  });

  it('needs exactly 10 layers', () => {
    const p = clone();
    p.layers.pop();
    expect(validatePuzzle(p)).toEqual(['layers must be an array of 10']);
  });

  it('needs each pool to be a subset of the one before', () => {
    const p = clone();
    p.layers[6]!.pool.push({
      canonical: 'grapefruit',
      aliases: [],
      commonness: 'rare',
    });
    expect(validatePuzzle(p)).toEqual([
      'layer 7 "grapefruit" is missing from layer 6',
    ]);
  });

  it('rejects duplicate canonicals and aliases that match two answers', () => {
    const p = clone();
    p.layers[0]!.pool.push({
      canonical: 'Traffic Cone',
      aliases: [],
      commonness: 'rare',
    });
    p.layers[0]!.pool.push({
      canonical: 'road cone',
      aliases: [],
      commonness: 'rare',
    });
    expect(validatePuzzle(p)).toEqual([
      'layer 1 duplicate canonical "Traffic Cone"',
      'layer 1 "road cone" matches more than one answer',
    ]);
  });

  it('reports missing fields', () => {
    expect(validatePuzzle(null)).toEqual(['puzzle must be an object']);
    const p: Record<string, unknown> = clone();
    delete p.number;
    p.date = '5 Dec';
    const layers = p.layers as Record<string, unknown>[];
    delete layers[0]!.clue;
    (layers[1]!.pool as Record<string, unknown>[])[0] = {
      canonical: 'kumquat',
    };
    const errors = validatePuzzle(p);
    expect(errors).toContain('number must be a positive integer');
    expect(errors).toContain('date must be YYYY-MM-DD');
    expect(errors).toContain('layer 1 clue is required');
    expect(errors).toContain(
      'layer 2 pool[0] aliases must be an array of strings'
    );
    expect(errors).toContain(
      'layer 2 pool[0] commonness must be common, uncommon or rare'
    );
  });
});

describe('poolShapeErrors', () => {
  /** A puzzle whose layer N holds sizes[N-1] answers, each also in every layer above it. */
  const shaped = (sizes: number[]): Puzzle => ({
    number: 1,
    date: '2026-11-08',
    layers: sizes.map((n, i) => ({
      clue: `clue ${i + 1}`,
      pool: Array.from({ length: n }, (_, j) => ({
        canonical: `answer ${j}`,
        aliases: [],
        commonness: 'common' as const,
      })),
    })),
  });
  const FUNNEL = [506, 311, 194, 120, 75, 47, 29, 18, 11, 7];

  it('accepts a funnel from 500+ down to 5-10', () => {
    expect(poolShapeErrors(shaped(FUNNEL))).toEqual([]);
  });

  it('needs at least 500 answers at layer 1', () => {
    expect(poolShapeErrors(shaped([499, ...FUNNEL.slice(1)]))).toEqual(
      [
        'layer 1 has 499 answers; it needs at least 500',
        'layer 2 keeps 62% of layer 1 (311 of 499); it needs 35% to 85%',
      ].slice(0, 1)
    );
  });

  it('needs 5 to 10 answers at layer 10', () => {
    expect(poolShapeErrors(shaped([...FUNNEL.slice(0, 9), 4]))).toContain(
      'layer 10 has 4 answers; it needs 5 to 10'
    );
    expect(poolShapeErrors(shaped([...FUNNEL.slice(0, 9), 11]))).toContain(
      'layer 10 has 11 answers; it needs 5 to 10'
    );
    expect(poolShapeErrors(shaped([...FUNNEL.slice(0, 8), 14, 10]))).toEqual(
      []
    );
  });

  it('rejects a clue that removes too little or too much', () => {
    const little = [...FUNNEL];
    little[1] = 450;
    expect(poolShapeErrors(shaped(little))).toContain(
      'layer 2 keeps 89% of layer 1 (450 of 506); it needs 35% to 85%'
    );
    const much = [...FUNNEL];
    much[3] = 40;
    expect(poolShapeErrors(shaped(much))).toContain(
      'layer 4 keeps 21% of layer 3 (40 of 194); it needs 35% to 85%'
    );
  });
});
