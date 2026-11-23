// DATA RULE (SPEC §5.3): reads only our own puzzle files. No AI, no Redis, no Reddit data.
//
// Usage: node tools/validate-puzzles.ts [dir]   (default content/puzzles; drafts/ is not included)
import path from 'node:path';
import { poolShapeErrors, validatePuzzle } from '../src/shared/puzzle.ts';
import { isPuzzle, puzzlesDir, readPuzzleFiles, root } from './puzzle-files.ts';

const dir = process.argv[2] ? path.resolve(process.argv[2]) : puzzlesDir;
const files = readPuzzleFiles(dir);
const numbers = new Map<number, string>();
let failed = 0;

for (const { file, data } of files) {
  const errors = typeof data === 'string' ? [data] : validatePuzzle(data);
  if (isPuzzle(data)) {
    const p = data;
    errors.push(...poolShapeErrors(p));
    if (`${p.date}.json` !== file)
      errors.push(`file name must be ${p.date}.json`);
    const clash = numbers.get(p.number);
    if (clash) errors.push(`number ${p.number} is also used by ${clash}`);
    numbers.set(p.number, file);
  }
  if (errors.length > 0) {
    failed++;
    console.error(
      `✖ ${path.relative(root, path.join(dir, file))}\n    ${errors.join('\n    ')}`
    );
  }
}

if (files.length === 0) {
  console.error(`✖ No puzzle files in ${path.relative(root, dir)}`);
  process.exit(1);
}
if (failed > 0) {
  console.error(`\n${failed} of ${files.length} puzzle file(s) invalid.`);
  process.exit(1);
}
console.log(`✔ ${files.length} puzzle file(s) valid.`);
