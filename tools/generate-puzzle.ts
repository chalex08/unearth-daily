// DATA RULE (SPEC §5.3): this script calls the Gemini FREE tier. Its only inputs are a hand-written
// seed theme and our own puzzle files in content/puzzles/. Never give it Redis data, the Reddit API,
// player answers, the non-pool answer log, answer counts, usernames or anything else from Reddit.
//
// Usage: node tools/generate-puzzle.ts --date 2026-11-22 [--seed "things in a kitchen drawer"]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { validatePuzzle, type Puzzle } from '../src/shared/puzzle.ts';
import {
  draftsDir,
  isDate,
  isPuzzle,
  numberFor,
  puzzlesDir,
  readPuzzleFiles,
  root,
  toPuzzle,
  type Draft,
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

// Loads GEMINI_FREE_* into process.env; the values are never printed.
if (existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
const key = process.env['GEMINI_FREE_API_KEY'];
const model = process.env['GEMINI_FREE_MODEL'];
if (!key || !model) {
  console.error(
    'Set GEMINI_FREE_API_KEY and GEMINI_FREE_MODEL in .env (see docs/CONTENT.md).'
  );
  process.exit(1);
}

const published = readPuzzleFiles(puzzlesDir)
  .map((f) => f.data)
  .filter(isPuzzle);
const number = numberFor(date, published);
const usedAnswers = published.map((p) => p.layers[9]!.pool[0]!.canonical);

const SCHEMA = {
  type: 'object',
  properties: {
    clues: {
      type: 'array',
      items: { type: 'string' },
      minItems: 10,
      maxItems: 10,
    },
    answers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          canonical: { type: 'string' },
          aliases: { type: 'array', items: { type: 'string' } },
          commonness: { type: 'string', enum: ['common', 'uncommon', 'rare'] },
          depth: { type: 'integer', minimum: 1, maximum: 10 },
        },
        required: ['canonical', 'aliases', 'commonness', 'depth'],
      },
    },
  },
  required: ['clues', 'answers'],
};

const prompt = `You write UNEARTH, a daily word-chain puzzle. Players dig through 10 layers.
Clue 1 is broad ("Name something orange"). Each later clue narrows the previous ones, written as a
continuation starting with "…" ("…that you can eat"). An answer is valid at layer N only if it satisfies
clues 1..N. Clue 10 must leave exactly one valid answer.

Clue rules:
- Early clues are generous and unambiguous: many answers fit, and nobody argues about them.
- Each clue adds exactly one testable constraint, checkable by an ordinary adult without looking it up.
- No trivia-only knowledge: the chain is solvable from everyday knowledge.
- Avoid subjective clues ("tasty", "beautiful", "popular"); every constraint must be a yes/no fact.
- Layer 10 leaves exactly one answer, and players should be able to reason their way to it.

Answers:
- List EVERY reasonable answer to clue 1, aiming for 50-90 answers, so most things a player types are in the list.
- For each answer give "depth": the deepest layer N such that it satisfies clues 1..N. Be strict and honest.
- Exactly one answer has depth 10.
- "canonical": the plain lowercase everyday name, singular. "aliases": other names, spellings, plurals
  and hyphenated forms people type (lowercase). No alias may be shared by two answers.
- "commonness": "common" = most players would think of it in the first few seconds; "uncommon" = a solid
  second-wave answer; "rare" = clever or niche but still correct.
- Pools should shrink steadily: roughly half of the answers drop out by layer 4, and only a handful remain by layer 9.

${values.seed ? `Seed theme or first clue from the editor: ${values.seed}` : 'Pick a fresh, everyday theme.'}
Do not use any of these previous final answers: ${usedAnswers.join(', ') || '(none)'}.`;

type Content = { role: 'user' | 'model'; parts: { text: string }[] };
type GeminiBody = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { message?: string; details?: { retryDelay?: string }[] };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One generateContent call, retrying 429 and 5xx with backoff (honouring RetryInfo when present). */
async function ask(contents: Content[]): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key! },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: SCHEMA,
          },
        }),
      }
    );
    const raw = await res.text();
    let body: GeminiBody = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // non-JSON error page; handled by the status checks below
    }
    if (res.ok) {
      const text = body.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? '')
        .join('');
      if (!text)
        throw new Error(
          `empty response (${body.candidates?.[0]?.finishReason ?? 'no candidate'})`
        );
      return text;
    }
    if ((res.status === 429 || res.status >= 500) && attempt <= 6) {
      const hinted = body.error?.details?.find(
        (d: { retryDelay?: string }) => d.retryDelay
      )?.retryDelay;
      const wait = hinted
        ? parseFloat(hinted) * 1000 + 500
        : 2 ** attempt * 1000 + Math.random() * 1000;
      console.warn(
        `Gemini ${res.status}, retry ${attempt}/6 in ${Math.round(wait / 1000)}s`
      );
      await sleep(wait);
      continue;
    }
    throw new Error(
      `Gemini ${res.status}: ${body.error?.message ?? res.statusText}`
    );
  }
}

function check(text: string): { puzzle: Puzzle | null; errors: string[] } {
  let draft: Draft;
  try {
    draft = JSON.parse(text);
  } catch {
    return { puzzle: null, errors: ['response was not valid JSON'] };
  }
  if (!Array.isArray(draft?.clues) || !Array.isArray(draft?.answers))
    return {
      puzzle: null,
      errors: ['response must have "clues" and "answers" arrays'],
    };
  const puzzle = toPuzzle(draft, number, date);
  return { puzzle, errors: validatePuzzle(puzzle) };
}

const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
console.log(`Drafting #${number} for ${date} with ${model}...`);
let text = await ask(contents);
let result = check(text);
for (let retry = 1; retry <= 2 && result.errors.length > 0; retry++) {
  console.warn(
    `Validator found ${result.errors.length} problem(s), asking for a fix (${retry}/2)`
  );
  contents.push(
    { role: 'model', parts: [{ text }] },
    {
      role: 'user',
      parts: [
        {
          text: `Your puzzle failed validation:\n- ${result.errors.join('\n- ')}\nReturn the whole corrected puzzle in the same JSON format.`,
        },
      ],
    }
  );
  text = await ask(contents);
  result = check(text);
}

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
    `✖ Still invalid after 2 fixes:\n  ${result.errors.join('\n  ')}`
  );
  process.exit(1);
}
console.log(`✔ Valid. Review it with: npm run review -- ${date}`);
