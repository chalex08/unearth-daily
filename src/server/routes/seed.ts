// Dev-only tools: made-up answer counts (docs/CONTENT.md) and replaying today's run.
// Devvit Redis is only reachable from app code, so these run from moderator menu items.
import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context, redis } from '@devvit/web/server';
import { dayKey } from '../../shared/game';
import { fakeCounts } from '../core/fakeCounts';
import { keys } from '../core/keys';
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
