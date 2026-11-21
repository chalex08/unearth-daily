// DATA RULE (SPEC §5.3): reads and writes only our own puzzle files. No AI, no Redis, no Reddit data.
//
// Helpers for the /write-puzzle skill (.claude/skills/write-puzzle):
//   node tools/draft-puzzle.ts taken
//     final answer and clue 1 of every puzzle and draft, so new ones don't repeat them
//   node tools/draft-puzzle.ts build YYYY-MM-DD
//     expands content/puzzles/drafts/YYYY-MM-DD.ladder.json ({ clues, answers with depth })
//     into drafts/YYYY-MM-DD.json, then checks it: validator, clues that remove nothing, pool sizes
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { LAYER_COUNT, validatePuzzle } from '../src/shared/puzzle.ts';
import {
  draftsDir,
  isDate,
  isPuzzle,
  noOpLayers,
  numberFor,
  otherPuzzles,
  puzzlesDir,
  readPuzzleFiles,
  root,
  toPuzzle,
  type Draft,
} from './puzzle-files.ts';

const [command, date] = process.argv.slice(2);

if (command === 'taken') {
  for (const p of otherPuzzles(''))
    console.log(
      `${p.date}  ${p.layers.at(-1)!.pool[0]!.canonical}  |  ${p.layers[0]!.clue}`
    );
} else if (command === 'build' && isDate(date)) {
  const from = path.join(draftsDir, `${date}.ladder.json`);
  const to = path.join(draftsDir, `${date}.json`);
  const draft = JSON.parse(readFileSync(from, 'utf8')) as Draft;
  const badDepth = draft.answers.filter(
    (a) => !Number.isInteger(a.depth) || a.depth < 1 || a.depth > LAYER_COUNT
  );
  const known = readPuzzleFiles(puzzlesDir)
    .map((f) => f.data)
    .filter(isPuzzle);
  const puzzle = toPuzzle(draft, numberFor(date, known), date);
  writeFileSync(to, JSON.stringify(puzzle, null, 2) + '\n');

  puzzle.layers.forEach((l, i) =>
    console.log(
      `${String(i + 1).padStart(2)}  ${String(l.pool.length).padStart(3)}  ${l.clue}`
    )
  );
  const errors = [
    ...validatePuzzle(puzzle),
    ...badDepth.map((a) => `"${a.canonical}" depth must be 1..${LAYER_COUNT}`),
    ...noOpLayers(puzzle).map((n) => `clue ${n} removes nothing`),
  ];
  if (puzzle.layers[0]!.pool.length < 100)
    console.warn(
      `! layer 1 has ${puzzle.layers[0]!.pool.length} answers; aim for 100+`
    );
  if (errors.length) {
    console.error(`✖ ${path.relative(root, to)}\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✔ ${path.relative(root, to)} is valid (#${puzzle.number}).`);
} else {
  console.error('Usage: node tools/draft-puzzle.ts taken | build YYYY-MM-DD');
  process.exit(1);
}
