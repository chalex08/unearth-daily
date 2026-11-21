// DATA RULE (SPEC §5.3): this script calls the Gemini FREE tier. Its only input is our own draft
// puzzle file. Never give it Redis data, the Reddit API, player answers, the non-pool answer log,
// answer counts, usernames or anything else from Reddit.
//
// Usage: node tools/critique-puzzle.ts YYYY-MM-DD   (also run by generate-puzzle.ts after each draft)
// Rewrites content/puzzles/drafts/YYYY-MM-DD.json with clear-cut fixes and writes
// YYYY-MM-DD.review.md listing the judgement calls left for a human.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { validatePuzzle } from '../src/shared/puzzle.ts';
import { askForPuzzle, DRAFT_PROPERTIES, PUZZLE_RULES } from './gemini.ts';
import {
  draftsDir,
  isDate,
  isPuzzle,
  noOpLayers,
  root,
  toDraft,
  type Draft,
} from './puzzle-files.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    ...DRAFT_PROPERTIES,
    fixes: {
      type: 'array',
      items: { type: 'string' },
      description: 'One short line per change you made.',
    },
    open: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Judgement calls you did not settle, each a short question or note for the editor.',
    },
  },
  required: ['clues', 'answers', 'fixes', 'open'],
};

type Critique = Draft & { fixes: string[]; open: string[] };

/** Critiques and fixes one draft in place. Returns false if the result is still invalid. */
export async function critique(date: string): Promise<boolean> {
  const file = path.join(draftsDir, `${date}.json`);
  if (!existsSync(file)) {
    console.error(`✖ No draft at ${path.relative(root, file)}`);
    return false;
  }
  const puzzle: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isPuzzle(puzzle)) {
    console.error(
      `✖ Fix the validator errors first:\n  ${validatePuzzle(puzzle).join('\n  ')}`
    );
    return false;
  }
  const noOps = noOpLayers(puzzle);

  const prompt = `You are the strict editor of UNEARTH. Check this draft puzzle against the rules and fix it.

${PUZZLE_RULES}

Check every one of these:
1. Any clue holding more than one constraint, or relying on trivia: rewrite it as one everyday constraint.
2. Any clue that removes nothing from the layer above.${noOps.length ? ` Computed: clue(s) ${noOps.join(', ')} remove nothing.` : ''}
3. The final answer must be unique. Actively try to find a second answer that fits all 10 clues (not
   only ones in the list). If you find one, tighten the clues or fix depths so exactly one answer remains.
4. Obvious answers missing from any layer's pool: add the ones a typical player would type, with honest depths.
5. Wrong pool entries: re-check every answer's depth against each clue in order; lower it where an
   earlier clue already fails, raise it only if it truly fits.
6. Duplicates that should be aliases (e.g. "berry colander" vs "colander"): merge them into one answer.
Fix every clear-cut issue yourself; when you change a clue, re-check every answer's depth.
Leave genuine judgement calls (fairness, how well-known something is, borderline answers) unchanged
and list each one in "open". List each change in "fixes". Return the whole corrected puzzle.

Draft (each answer is valid at layers 1..depth):
${JSON.stringify(toDraft(puzzle))}`;

  console.log(`Critiquing #${puzzle.number} (${date})...`);
  const result = await askForPuzzle<Critique>(
    prompt,
    SCHEMA,
    puzzle.number,
    date
  );
  if (!result.puzzle || !result.reply) {
    console.error(
      `✖ Critic gave no usable puzzle: ${result.errors.join('; ')}`
    );
    return false;
  }

  const open = [...(result.reply.open ?? [])];
  const left = noOpLayers(result.puzzle);
  if (left.length)
    open.push(`Clue(s) ${left.join(', ')} still remove nothing.`);
  open.push(...result.errors.map((e) => `Validator: ${e}`));

  writeFileSync(file, JSON.stringify(result.puzzle, null, 2) + '\n');
  writeFileSync(
    path.join(draftsDir, `${date}.review.md`),
    `# Unearth #${puzzle.number} (${date}): judgement calls\n\n` +
      (open.length ? open.map((o) => `- ${o}`).join('\n') : '- None.') +
      '\n'
  );
  for (const f of result.reply.fixes ?? []) console.log(`  fixed: ${f}`);
  console.log(
    `Wrote ${path.relative(root, file)} and ${date}.review.md (${open.length} open)`
  );
  return result.errors.length === 0;
}

if (import.meta.main) {
  const date = process.argv[2];
  if (!isDate(date)) {
    console.error('Usage: node tools/critique-puzzle.ts YYYY-MM-DD');
    process.exit(1);
  }
  process.exit((await critique(date)) ? 0 : 1);
}
