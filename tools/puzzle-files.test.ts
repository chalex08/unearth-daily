import { describe, expect, it } from 'vitest';
import { poolShapeErrors, validatePuzzle } from '../src/shared/puzzle.ts';
import { puzzle14 } from '../src/shared/fixtures/puzzle-14.ts';
import {
  noOpLayers,
  numberFor,
  parseLadderText,
  puzzlesDir,
  readPuzzleFiles,
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
    expect(noOpLayers(puzzle14)).toEqual([]);
  });
});

describe('parseLadderText', () => {
  const text = [
    '# a comment',
    '1: Name an animal',
    '2: …that has a backbone',
    '== 2',
    'zebra',
    'mouse = mice',
    'okapi !',
    '== 1',
    'sea star = starfish ~',
    'jeans',
    'berry',
    'bus',
  ].join('\n');

  it('reads clues, depths, aliases and commonness marks', () => {
    const d = parseLadderText(text);
    expect(d.clues).toEqual(['Name an animal', '…that has a backbone']);
    expect(d.answers.find((a) => a.canonical === 'okapi')).toMatchObject({
      depth: 2,
      commonness: 'rare',
    });
    expect(d.answers.find((a) => a.canonical === 'sea star')).toMatchObject({
      depth: 1,
      commonness: 'uncommon',
      aliases: ['starfish', 'sea stars'],
    });
    expect(d.answers.find((a) => a.canonical === 'zebra')).toMatchObject({
      depth: 2,
      commonness: 'common',
    });
  });

  it('adds a plain plural unless the name ends in s or another answer owns it', () => {
    const by = (name: string) =>
      parseLadderText(text).answers.find((a) => a.canonical === name)!.aliases;
    expect(by('zebra')).toEqual(['zebras']);
    expect(by('mouse')).toEqual(['mice', 'mouses']);
    expect(by('berry')).toEqual(['berries']);
    expect(by('bus')).toEqual([]);
    expect(by('jeans')).toEqual([]);
  });

  it('rejects an answer with no depth line and a depth out of range', () => {
    expect(() => parseLadderText('zebra')).toThrow('before any');
    expect(() => parseLadderText('== 11')).toThrow('depth 11');
  });
});

describe('bundled puzzles', () => {
  const files = readPuzzleFiles(puzzlesDir);
  it('has at least one puzzle', () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const { file, data } of files) {
    it(`${file} is valid and has the funnel shape (SPEC §2)`, () => {
      expect(typeof data).not.toBe('string');
      expect(validatePuzzle(data)).toEqual([]);
      expect(
        poolShapeErrors(data as Parameters<typeof poolShapeErrors>[0])
      ).toEqual([]);
    });
  }
});
