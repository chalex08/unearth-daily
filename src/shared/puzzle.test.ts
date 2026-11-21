import { describe, expect, it } from 'vitest';
import { puzzle14 } from './fixtures/puzzle-14';
import { matchAnswer, normalise, validatePuzzle } from './puzzle';

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

  it('needs exactly one answer at layer 10', () => {
    const p = clone();
    p.layers[9]!.pool.push(p.layers[8]!.pool[0]!);
    p.layers[9]!.pool[1] = {
      canonical: 'kumquat2',
      aliases: [],
      commonness: 'rare',
    };
    expect(validatePuzzle(p)).toContain(
      'layer 10 must have exactly one answer'
    );
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
