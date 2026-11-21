// DATA RULE (SPEC §5.3): Gemini FREE tier. Callers may only send hand-written seed themes and our own
// puzzle files. Never Redis data, the Reddit API, player answers, the non-pool answer log, answer
// counts, usernames or anything else from Reddit.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { validatePuzzle, type Puzzle } from '../src/shared/puzzle.ts';
import { root, toPuzzle, type Draft } from './puzzle-files.ts';

// Loads GEMINI_FREE_* into process.env; the values are never printed.
if (existsSync(path.join(root, '.env')))
  process.loadEnvFile(path.join(root, '.env'));
const key = process.env['GEMINI_FREE_API_KEY'];
export const model = process.env['GEMINI_FREE_MODEL'];
if (!key || !model) {
  console.error(
    'Set GEMINI_FREE_API_KEY and GEMINI_FREE_MODEL in .env (see docs/CONTENT.md).'
  );
  process.exit(1);
}

export const PUZZLE_RULES = `UNEARTH is a daily word-chain puzzle. Players dig through 10 layers.
Clue 1 is broad ("Name something orange"). Each later clue narrows the previous ones, written as a
continuation starting with "…" ("…that you can eat"). An answer is valid at layer N only if it satisfies
clues 1..N. Clue 10 must leave exactly one valid answer.

Clue rules:
- Early clues are generous and unambiguous: many answers fit, and nobody argues about them.
- Each clue adds exactly one testable constraint, checkable by an ordinary adult without looking it up.
- Keep clues short, under 8 words like "…that grows on a tree". One idea per clue: no "and", no "rather than" contrasts.
- No trivia-only knowledge: the chain is solvable from everyday knowledge.
- Avoid subjective clues ("tasty", "beautiful", "popular"); every constraint must be a yes/no fact.
- Every clue removes at least one answer from the layer above.
- Layer 10 leaves exactly one answer, and players should be able to reason their way to it.

Answers:
- List EVERY reasonable answer to clue 1, aiming for 50-90 answers, so most things a player types are in the list.
- For each answer give "depth": the deepest layer N such that it satisfies clues 1..N. Be strict and honest.
- Exactly one answer has depth 10.
- "canonical": the plain lowercase everyday name, singular. "aliases": other names, spellings, plurals
  and hyphenated forms people type (lowercase). No alias may be shared by two answers, and two names
  for the same thing are one answer with aliases, not two answers.
- "commonness": "common" = most players would think of it in the first few seconds; "uncommon" = a solid
  second-wave answer; "rare" = clever or niche but still correct.
- Pools should shrink steadily: roughly half of the answers drop out by layer 4, and only a handful remain by layer 9.`;

export const DRAFT_PROPERTIES = {
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
};

type Content = { role: 'user' | 'model'; parts: { text: string }[] };
type GeminiBody = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] };
    finishReason?: string;
  }[];
  error?: { message?: string; details?: { retryDelay?: string }[] };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * One streamed generateContent call, retrying network errors, 429 and 5xx with backoff
 * (honouring RetryInfo when present). Streaming with thought summaries keeps bytes flowing
 * while the model thinks; a plain call hits Node fetch's 300s idle timeout.
 */
async function ask(contents: Content[], schema: object): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    let raw: string;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': key!,
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: schema,
              thinkingConfig: { includeThoughts: true },
            },
          }),
        }
      );
      raw = await res.text();
    } catch (e) {
      if (attempt > 6) throw e;
      console.warn(`Network error (${String(e)}), retry ${attempt}/6`);
      await sleep(2 ** attempt * 1000);
      continue;
    }
    if (res.ok) {
      // SSE: one "data: {json}" line per chunk; keep answer text, drop thought summaries.
      let text = '';
      let finish = 'no candidate';
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const chunk: GeminiBody = JSON.parse(line.slice(6));
        const c = chunk.candidates?.[0];
        finish = c?.finishReason ?? finish;
        for (const p of c?.content?.parts ?? [])
          if (!p.thought) text += p.text ?? '';
      }
      if (!text) throw new Error(`empty response (${finish})`);
      return text;
    }
    let body: GeminiBody = {};
    try {
      body = JSON.parse(raw);
    } catch {
      // non-JSON error page; handled by the status checks below
    }
    if ((res.status === 429 || res.status >= 500) && attempt <= 6) {
      const hinted = body.error?.details?.find((d) => d.retryDelay)?.retryDelay;
      const wait = hinted
        ? parseFloat(hinted) * 1000 + 500
        : 2 ** attempt * 1000 + Math.random() * 1000;
      // A long retryDelay means the daily quota is used up; sleeping for hours helps nobody.
      if (wait > 5 * 60_000)
        throw new Error(
          `Gemini quota exhausted, retry in about ${Math.ceil(wait / 3_600_000)}h (${body.error?.message ?? res.status})`
        );
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

export type Result<T> = {
  /** The model's last JSON reply (extra fields beyond the draft included). */
  reply: T | null;
  puzzle: Puzzle | null;
  errors: string[];
};

/**
 * Asks for a draft (clues + answers with depth, plus any extra fields in `schema`), expands it and
 * runs the shared validator; on failure sends the errors back, up to 2 times.
 */
export async function askForPuzzle<T extends Draft>(
  prompt: string,
  schema: object,
  number: number,
  date: string
): Promise<Result<T>> {
  const check = (text: string): Result<T> => {
    let reply: T;
    try {
      reply = JSON.parse(text);
    } catch {
      return {
        reply: null,
        puzzle: null,
        errors: ['response was not valid JSON'],
      };
    }
    if (!Array.isArray(reply?.clues) || !Array.isArray(reply?.answers))
      return {
        reply: null,
        puzzle: null,
        errors: ['response must have "clues" and "answers" arrays'],
      };
    const puzzle = toPuzzle(reply, number, date);
    return { reply, puzzle, errors: validatePuzzle(puzzle) };
  };

  const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
  let text = await ask(contents, schema);
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
            text: `Your puzzle failed validation:\n- ${result.errors.join('\n- ')}\nReturn the whole corrected reply in the same JSON format.`,
          },
        ],
      }
    );
    text = await ask(contents, schema);
    result = check(text);
  }
  return result;
}
