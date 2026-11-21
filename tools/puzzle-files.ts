// Reads and writes our own puzzle files. No Reddit data passes through here (SPEC §5.3).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LAYER_COUNT,
  validatePuzzle,
  type AnswerEntry,
  type Puzzle,
} from '../src/shared/puzzle.ts';

export const isPuzzle = (d: unknown): d is Puzzle =>
  validatePuzzle(d).length === 0;

export const root = path.resolve(import.meta.dirname, '..');
export const puzzlesDir = path.join(root, 'content', 'puzzles');
export const draftsDir = path.join(puzzlesDir, 'drafts');

export const isDate = (s: string | undefined): s is string =>
  !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

/** Every `*.json` in `dir`, parsed, with its file name. Not recursive, so drafts/ stays out of content/puzzles. */
export function readPuzzleFiles(
  dir: string
): { file: string; data: unknown }[] {
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }
  return names.sort().map((file) => {
    const text = readFileSync(path.join(dir, file), 'utf8');
    try {
      return { file, data: JSON.parse(text) };
    } catch (e) {
      return { file, data: `invalid JSON: ${String(e)}` };
    }
  });
}

/** Puzzle numbers run one per UTC day, so a date's number follows from any existing puzzle. */
export function numberFor(date: string, known: Puzzle[]): number {
  const anchor = known[0];
  if (!anchor)
    throw new Error(
      'need at least one puzzle in content/puzzles to number from'
    );
  const days = (Date.parse(date) - Date.parse(anchor.date)) / 86_400_000;
  return anchor.number + Math.round(days);
}

/** The model's compact output: 10 clues and every answer with the deepest layer it survives. */
export type Draft = {
  clues: string[];
  answers: (AnswerEntry & { depth: number })[];
};

/** Expands answers into per-layer pools; an answer with depth d is in layers 1..d. */
export function toPuzzle(draft: Draft, number: number, date: string): Puzzle {
  return {
    number,
    date,
    layers: Array.from({ length: LAYER_COUNT }, (_, i) => ({
      clue: draft.clues[i] ?? '',
      pool: draft.answers
        .filter((a) => a.depth >= i + 1)
        .map(({ canonical, aliases, commonness }) => ({
          canonical,
          aliases,
          commonness,
        })),
    })),
  };
}
