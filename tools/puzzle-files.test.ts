import { describe, expect, it } from 'vitest';
import { validatePuzzle } from '../src/shared/puzzle.ts';
import { puzzle14 } from '../src/shared/fixtures/puzzle-14.ts';
import {
  noOpLayers,
  numberFor,
  toDraft,
  toPuzzle,
  type Draft,
} from './puzzle-files.ts';

describe('numberFor', () => {
  it('counts days from a known puzzle', () => {
    const known = [{ ...puzzle14, date: '2026-11-21' }];
    expect(numberFor('2026-11-21', known)).toBe(14);
    expect(numberFor('2026-11-26', known)).toBe(19);
    expect(numberFor('2026-12-01', known)).toBe(24);
  });
});

describe('toPuzzle', () => {
  const draft: Draft = {
    clues: Array.from({ length: 10 }, (_, i) => `clue ${i + 1}`),
    answers: [
      {
        canonical: 'kumquat',
        aliases: ['cumquat'],
        commonness: 'rare',
        depth: 10,
      },
      { canonical: 'lemon', aliases: [], commonness: 'common', depth: 6 },
      { canonical: 'carrot', aliases: [], commonness: 'common', depth: 1 },
    ],
  };
  it('puts each answer in layers 1..depth and passes the validator', () => {
    const p = toPuzzle(draft, 15, '2026-11-22');
    expect(p.layers[0]!.pool).toHaveLength(3);
    expect(p.layers[5]!.pool.map((a) => a.canonical)).toEqual([
      'kumquat',
      'lemon',
    ]);
    expect(p.layers[9]!.pool).toEqual([
      { canonical: 'kumquat', aliases: ['cumquat'], commonness: 'rare' },
    ]);
    expect(validatePuzzle(p)).toEqual([]);
  });
  it('round-trips through toDraft', () => {
    const p = toPuzzle(draft, 15, '2026-11-22');
    expect(toDraft(p)).toEqual(draft);
    expect(toPuzzle(toDraft(puzzle14), 14, puzzle14.date)).toEqual(puzzle14);
  });
  it('finds clues that remove nothing', () => {
    expect(noOpLayers(toPuzzle(draft, 15, '2026-11-22'))).toEqual([
      3, 4, 5, 6, 8, 9, 10,
    ]);
    // Clue 8 ('doesn't contain "orange"') rules out nothing: clue 7 already removed the oranges.
    expect(noOpLayers(puzzle14)).toEqual([8]);
  });
  it('lets the validator catch a final layer with two answers', () => {
    const two = {
      ...draft,
      answers: draft.answers.map((a) => ({ ...a, depth: 10 })),
    };
    expect(validatePuzzle(toPuzzle(two, 15, '2026-11-22'))).toContain(
      'layer 10 must have exactly one answer'
    );
  });
});
