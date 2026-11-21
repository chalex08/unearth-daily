// DATA RULE (SPEC §5.3): reads only our own draft puzzle files. No AI, no Redis, no Reddit data.
//
// Usage: node tools/review.ts YYYY-MM-DD   (reads content/puzzles/drafts/YYYY-MM-DD.json)
import { existsSync, readFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { validatePuzzle, type AnswerEntry } from '../src/shared/puzzle.ts';
import {
  draftsDir,
  isDate,
  isPuzzle,
  puzzlesDir,
  root,
} from './puzzle-files.ts';

const date = process.argv[2];
if (!isDate(date)) {
  console.error('Usage: node tools/review.ts YYYY-MM-DD');
  process.exit(1);
}
const from = path.join(draftsDir, `${date}.json`);
const to = path.join(puzzlesDir, `${date}.json`);
if (!existsSync(from)) {
  console.error(`✖ No draft at ${path.relative(root, from)}`);
  process.exit(1);
}

const data: unknown = JSON.parse(readFileSync(from, 'utf8'));
if (!isPuzzle(data)) {
  console.error(`✖ Draft is invalid:\n  ${validatePuzzle(data).join('\n  ')}`);
  process.exit(1);
}

const show = (a: AnswerEntry) =>
  a.aliases.length ? `${a.canonical} (${a.aliases.join(', ')})` : a.canonical;

console.log(`\nUnearth #${data.number}, ${data.date}\n`);
data.layers.forEach((layer, i) => {
  const kept = new Set(layer.pool.map((a) => a.canonical));
  const dropped =
    i === 0
      ? []
      : data.layers[i - 1]!.pool.filter((a) => !kept.has(a.canonical));
  console.log(
    `── Layer ${i + 1}: ${layer.clue}   [${layer.pool.length} answers]`
  );
  for (const c of ['common', 'uncommon', 'rare'] as const) {
    const list = layer.pool.filter((a) => a.commonness === c);
    if (list.length)
      console.log(`   ${c.padEnd(9)} ${list.map(show).join(', ')}`);
  }
  // What this clue rules out is the quickest way to judge whether it's fair.
  if (dropped.length)
    console.log(`   ruled out ${dropped.map((a) => a.canonical).join(', ')}`);
  console.log();
});

if (existsSync(to)) {
  console.error(
    `✖ ${path.relative(root, to)} already exists; not overwriting.`
  );
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  `Approve and move to ${path.relative(root, to)}? [y/N] `
);
rl.close();
if (answer.trim().toLowerCase() !== 'y') {
  console.log('Not approved. Edit the draft and run review again.');
  process.exit(0);
}
renameSync(from, to);
console.log(
  `✔ Moved to ${path.relative(root, to)}. Run npm run validate:puzzles, then commit.`
);
