// Reads and writes our own puzzle files. No Reddit data passes through here (SPEC §5.3).
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LAYER_COUNT,
  normalise,
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

/** Inverse of toPuzzle: each canonical with the deepest layer whose pool holds it. */
export function toDraft(puzzle: Puzzle): Draft {
  return {
    clues: puzzle.layers.map((l) => l.clue),
    answers: puzzle.layers[0]!.pool.map((a) => ({
      ...a,
      depth: puzzle.layers.filter((l) =>
        l.pool.some((b) => b.canonical === a.canonical)
      ).length,
    })),
  };
}

/** Regular plural of the last word, or null when the name already ends in "s" (jeans, scissors). */
const plural = (name: string): string | null =>
  /s$/.test(name)
    ? null
    : /[^aeiou]y$/.test(name)
      ? `${name.slice(0, -1)}ies`
      : /(x|z|ch|sh)$/.test(name)
        ? `${name}es`
        : `${name}s`;

/**
 * Parses the compact depth list. Comment lines start with `#`; `N: clue` sets clue N (1-10); `== D`
 * starts the answers valid through layer D; each answer line is
 * `canonical [= alias, alias] [~|!]`, where a trailing `~` is uncommon and `!` is rare (no mark is
 * common). A plain plural of each canonical is added as an alias unless another answer already owns
 * that spelling, so only irregular plurals and real variants need writing out.
 */
export function parseLadderText(text: string): Draft {
  const clues: string[] = [];
  const answers: Draft['answers'] = [];
  let depth = 0;
  text.split(/\r?\n/).forEach((raw, n) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const at = `line ${n + 1}`;
    const clue = /^(\d+):\s*(.+)$/.exec(line);
    if (clue) {
      const num = Number(clue[1]);
      if (num < 1 || num > LAYER_COUNT) throw new Error(`${at}: clue ${num}`);
      clues[num - 1] = clue[2]!;
      return;
    }
    const section = /^==\s*(\d+)$/.exec(line);
    if (section) {
      depth = Number(section[1]);
      if (depth < 1 || depth > LAYER_COUNT)
        throw new Error(`${at}: depth ${depth} must be 1..${LAYER_COUNT}`);
      return;
    }
    if (!depth) throw new Error(`${at}: answer before any "== depth" line`);
    const mark = /\s([~!])$/.exec(line)?.[1];
    const body = mark ? line.slice(0, -1).trim() : line;
    const [canonical = '', rest = ''] = body.split(/\s=\s/);
    answers.push({
      canonical: canonical.trim(),
      aliases: rest
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      commonness: mark === '~' ? 'uncommon' : mark === '!' ? 'rare' : 'common',
      depth,
    });
  });
  const taken = new Set(
    answers.flatMap((a) => [a.canonical, ...a.aliases].map(normalise))
  );
  for (const a of answers) {
    const extra = plural(a.canonical);
    const key = extra ? normalise(extra) : '';
    if (extra && key && !taken.has(key)) {
      taken.add(key);
      a.aliases.push(extra);
    }
  }
  return { clues, answers };
}

/** Layers (1-based) whose clue removes nothing: same pool size as the layer above. */
export const noOpLayers = (puzzle: Puzzle): number[] =>
  puzzle.layers.flatMap((l, i) =>
    i > 0 && l.pool.length === puzzle.layers[i - 1]!.pool.length ? [i + 1] : []
  );

/** Published puzzles and drafts, other than `date`, for the "don't repeat" lists. */
export const otherPuzzles = (date: string): Puzzle[] =>
  [...readPuzzleFiles(puzzlesDir), ...readPuzzleFiles(draftsDir)]
    .map((f) => f.data)
    .filter(isPuzzle)
    .filter((p) => p.date !== date);

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
