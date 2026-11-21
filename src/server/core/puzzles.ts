/// <reference types="vite/client" />
// Puzzle files are bundled into the server only; the client never imports this (SPEC §4).
import type { Puzzle } from '../../shared/puzzle';

const files = import.meta.glob<Puzzle>('../../../content/puzzles/*.json', {
  eager: true,
  import: 'default',
});

/** Published puzzles by UTC date, oldest first. drafts/ is excluded by the glob. */
export const puzzles: Puzzle[] = Object.values(files).sort((a, b) =>
  a.date.localeCompare(b.date)
);

export const puzzleFor = (date: string): Puzzle | undefined =>
  puzzles.find((p) => p.date === date);
