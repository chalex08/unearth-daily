// Dev-only tools: made-up answer counts (docs/CONTENT.md), replaying today's run, jumping to a layer.
// Devvit Redis is only reachable from app code, so these run from moderator menu items.
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import {
  applyAnswer,
  dayKey,
  mineral,
  puzzleNumber,
  rarityBand,
  startRun,
} from '../../shared/game';
import { LAYER_COUNT, normalise } from '../../shared/puzzle';
import type { Commonness } from '../../shared/puzzle';
import { fakeCounts } from '../core/fakeCounts';
import { keys, TTL_SECONDS } from '../core/keys';
import { puzzleFor, puzzles } from '../core/puzzles';

// devvit.json "name". Dev installs run under DEVVIT_APP_NAME (a personal app), never this one.
const CANONICAL_APP = 'unearth-daily';
const PLAYERS = 600;

export const seed = new Hono();

seed.post('/seed-fake-counts', async (c) => {
  if (context.appSlug === CANONICAL_APP)
    return c.json<UiResponse>(
      { showToast: 'Fake counts are for dev apps only' },
      200
    );

  const today = new Date().toISOString().slice(0, 10);
  const puzzle = puzzleFor(today) ?? puzzles.at(-1);
  if (!puzzle)
    return c.json<UiResponse>({ showToast: 'No puzzle files bundled' }, 200);

  const { answers, ends } = fakeCounts(puzzle, PLAYERS, Math.random);
  const answerKeys = answers.map((_, i) => keys.answers(puzzle.date, i + 1));
  await redis.del(
    ...answerKeys,
    keys.ends(puzzle.date),
    keys.totals(puzzle.date),
    keys.reached(puzzle.date)
  );
  for (const [i, layer] of answers.entries()) {
    const members = Object.entries(layer).map(([member, score]) => ({
      member,
      score,
    }));
    if (members.length) await redis.zAdd(answerKeys[i]!, ...members);
  }
  await redis.hSet(
    keys.ends(puzzle.date),
    Object.fromEntries(ends.map((n, l) => [String(l), String(n)]))
  );
  const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
  await redis.hSet(
    keys.totals(puzzle.date),
    Object.fromEntries(
      answers.map((layer, i) => [
        String(i + 1),
        String(sum(Object.values(layer))),
      ])
    )
  );
  await redis.hSet(
    keys.reached(puzzle.date),
    Object.fromEntries(
      ends.map((_, l) => [String(l), String(sum(ends.slice(l)))])
    )
  );

  return c.json<UiResponse>(
    {
      showToast: `Seeded ${PLAYERS} fake runs for #${puzzle.number} (${puzzle.date})`,
    },
    200
  );
});

/** Deletes the moderator's own run for today so they can play it again. Answer counts stay. */
seed.post('/reset-my-run', async (c) => {
  if (context.appSlug === CANONICAL_APP)
    return c.json<UiResponse>(
      { showToast: 'Resetting runs is for dev apps only' },
      200
    );
  const userId = context.userId;
  if (!userId) return c.json<UiResponse>({ showToast: 'Log in first' }, 200);
  const day = dayKey(new Date());
  await redis.del(keys.run(day, userId), keys.lock(day, userId));
  return c.json<UiResponse>(
    { showToast: `Run for ${day} cleared. Reopen the post to play again.` },
    200
  );
});

// Jumping to a layer (PLAN step 6 checks). Dev installs and the local preview only: the slug must
// be present and not the canonical app's, so an unknown context refuses rather than allows.
const isDevApp = () =>
  Boolean(context.appSlug) && context.appSlug !== CANONICAL_APP;

/**
 * Rewrites the caller's run for today so `to - 1` layers are cleared with pool answers (11 = all
 * ten, the Uranium finish). Bands cycle Rubble, Nugget, Pocket through the commonness labels, as on a
 * cold start. Answer counts, the graveyard and the streak are not touched.
 */
export async function jumpRun(userId: string, to: number): Promise<string> {
  const day = dayKey(new Date());
  const puzzle = puzzleFor(day);
  if (!puzzle) return 'No puzzle today';
  let run = startRun(puzzleNumber(day));
  const want: Commonness[] = ['common', 'uncommon', 'rare'];
  for (let layer = 1; layer < to; layer++) {
    const pool = puzzle.layers[layer - 1]!.pool.filter(
      (a) => !run.used.includes(normalise(a.canonical))
    );
    const pick =
      pool.find((a) => a.commonness === want[(layer - 1) % 3]) ?? pool[0];
    if (!pick) return `No unused answer for layer ${layer}`;
    run = applyAnswer(run, {
      valid: true,
      answer: normalise(pick.canonical),
      canonical: pick.canonical,
      ...rarityBand(1, 1, pick.commonness),
    }).run;
  }
  const runKey = keys.run(day, userId);
  await redis.hSet(runKey, { state: JSON.stringify(run) });
  await redis.expire(runKey, TTL_SECONDS);
  await redis.del(keys.lock(day, userId));
  return to > LAYER_COUNT
    ? 'Jumped to the end: all ten cleared. Reopen the post.'
    : `Jumped to layer ${to}. Reopen the post.`;
}

const JUMP_FORM = 'devJump';

seed.post('/dev-jump', (c) =>
  c.json<UiResponse>(
    isDevApp()
      ? {
          showForm: {
            name: JUMP_FORM,
            form: {
              title: 'Jump to a layer (dev)',
              fields: [
                {
                  name: 'to',
                  label: 'Start at',
                  type: 'select',
                  required: true,
                  options: [
                    ...Array.from({ length: LAYER_COUNT }, (_, i) => ({
                      label: `Layer ${i + 1}, ${mineral(i + 1).name}`,
                      value: String(i + 1),
                    })),
                    { label: 'End screen, Uranium finish', value: '11' },
                  ],
                },
              ],
            },
          },
        }
      : { showToast: 'Jumping is for dev apps only' },
    200
  )
);

/** The jump form's submit (devvit.json "forms"). */
export const devForms = new Hono();

devForms.post('/dev-jump', async (c) => {
  const userId = context.userId;
  if (!isDevApp() || !userId)
    return c.json<UiResponse>(
      { showToast: 'Jumping is for dev apps only' },
      200
    );
  const body = await c.req.json<{ to?: string[] }>().catch(() => null);
  const to = Number(body?.to?.[0]);
  if (!Number.isInteger(to) || to < 1 || to > LAYER_COUNT + 1)
    return c.json<UiResponse>({ showToast: 'Pick a layer' }, 200);
  return c.json<UiResponse>({ showToast: await jumpRun(userId, to) }, 200);
});

/** POST /api/dev/jump { to }: the local preview's `?jump=` (game.ts). 404 outside dev apps. */
export const devApi = new Hono();

devApi.post('/jump', async (c) => {
  const userId = context.userId;
  if (!isDevApp() || !userId) return c.json({ error: 'Not found' }, 404);
  const body = await c.req.json<{ to?: unknown }>().catch(() => null);
  const to = Number(body?.to);
  if (!Number.isInteger(to) || to < 1 || to > LAYER_COUNT + 1)
    return c.json({ error: 'Expected { to: 1–11 }' }, 400);
  return c.json({ message: await jumpRun(userId, to) });
});
