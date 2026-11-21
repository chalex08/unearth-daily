// DATA RULE (SPEC §5.3): this script calls the Gemini FREE tier. Its only inputs are a hand-written
// seed theme and our own puzzle files in content/puzzles/. Never give it Redis data, the Reddit API,
// player answers, the non-pool answer log, answer counts, usernames or anything else from Reddit.
//
// Usage: node tools/generate-puzzle.ts --date 2026-11-22 [--seed "things in a kitchen drawer"]
// Writes content/puzzles/drafts/YYYY-MM-DD.json, then runs the critic on it.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { critique } from './critique-puzzle.ts';
import {
  askForPuzzle,
  DRAFT_PROPERTIES,
  model,
  PUZZLE_RULES,
} from './gemini.ts';
import {
  draftsDir,
  isDate,
  isPuzzle,
  numberFor,
  otherPuzzles,
  puzzlesDir,
  readPuzzleFiles,
  root,
} from './puzzle-files.ts';

const { values } = parseArgs({
  options: { date: { type: 'string' }, seed: { type: 'string' } },
});
if (!isDate(values.date)) {
  console.error(
    'Usage: node tools/generate-puzzle.ts --date YYYY-MM-DD [--seed "theme or first clue"]'
  );
  process.exit(1);
}
const date = values.date;

const published = readPuzzleFiles(puzzlesDir)
  .map((f) => f.data)
  .filter(isPuzzle);
const number = numberFor(date, published);
const others = otherPuzzles(date);
const used = (pick: (p: (typeof others)[number]) => string) =>
  others.map(pick).join('; ') || '(none)';

const prompt = `You write UNEARTH puzzles.

${PUZZLE_RULES}

${values.seed ? `Seed theme or first clue from the editor: ${values.seed}` : 'Pick a fresh, everyday theme.'}
Do not reuse any of these final answers: ${used((p) => p.layers[9]!.pool[0]!.canonical)}.
${values.seed ? '' : `Do not reuse any of these themes (first clues): ${used((p) => p.layers[0]!.clue)}.`}`;

console.log(`Drafting #${number} for ${date} with ${model}...`);
const result = await askForPuzzle(
  prompt,
  {
    type: 'object',
    properties: DRAFT_PROPERTIES,
    required: ['clues', 'answers'],
  },
  number,
  date
);

if (!result.puzzle) {
  console.error(`✖ No usable draft: ${result.errors.join('; ')}`);
  process.exit(1);
}
mkdirSync(draftsDir, { recursive: true });
const out = path.join(draftsDir, `${date}.json`);
writeFileSync(out, JSON.stringify(result.puzzle, null, 2) + '\n');
console.log(`Wrote ${path.relative(root, out)}`);
if (result.errors.length > 0) {
  console.error(
    `✖ Still invalid after 2 fixes, fix by hand then run npm run puzzle:critique -- ${date}:\n  ${result.errors.join('\n  ')}`
  );
  process.exit(1);
}
if (!(await critique(date))) process.exit(1);
console.log(`✔ Done. Review it with: npm run review -- ${date}`);
