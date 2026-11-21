import { Hono } from 'hono';
import type { Context } from 'hono';
import { context, redis, settings } from '@devvit/web/server';
import type {
  AnswerResult,
  ChainLink,
  ErrorResponse,
  ResultResponse,
  RunResponse,
  StatsResponse,
} from '../../shared/api';
import {
  applyAnswer,
  checkAnswer,
  currentLayer,
  currentStreak,
  dayKey,
  mineral,
  puzzleNumber,
  rarityBand,
  runStatus,
  scoreRun,
  shareText,
  startRun,
  updateStreak,
} from '../../shared/game';
import type {
  ClearedLayer,
  RunState,
  Streak,
  Verdict,
} from '../../shared/game';
import { LAYER_COUNT, matchAnswer, normalise } from '../../shared/puzzle';
import type { Commonness, Puzzle } from '../../shared/puzzle';
import { judgeFor } from '../core/judge';
import type { JudgeVerdict } from '../core/judge';
import { keys, TTL_SECONDS } from '../core/keys';
import { puzzleFor } from '../core/puzzles';

const LOCK_SECONDS = 15;
const UNCHECKED = "Couldn't check that, try again";

export const api = new Hono();

const fail = (c: Context, status: 400 | 401 | 404 | 409, error: string) =>
  c.json<ErrorResponse>({ error }, status);

/** The signed-in user and today's puzzle, or the error to send. */
function who(c: Context) {
  const userId = context.userId;
  if (!userId) return { error: fail(c, 401, 'Log in to play') };
  const day = dayKey(new Date());
  const puzzle = puzzleFor(day);
  if (!puzzle) return { error: fail(c, 404, 'No puzzle today') };
  return { userId, day, puzzle };
}

async function loadRun(day: string, userId: string): Promise<RunState | null> {
  const json = await redis.hGet(keys.run(day, userId), 'state');
  return json ? JSON.parse(json) : null;
}

async function loadStreak(userId: string): Promise<Streak | null> {
  const { count, lastDay } = await redis.hGetAll(keys.user(userId));
  return count && lastDay ? { count: Number(count), lastDay } : null;
}

const link = (puzzle: Puzzle, c: ClearedLayer): ChainLink => ({
  layer: c.layer,
  clue: puzzle.layers[c.layer - 1]!.clue,
  answer: c.answer,
  canonical: c.canonical,
  band: c.band,
  estimated: c.estimated,
  points: c.points,
});

const score = (run: RunState) =>
  runStatus(run) === 'playing'
    ? run.cleared.reduce((sum, c) => sum + c.points, 0)
    : scoreRun(run).total;

const clueAt = (puzzle: Puzzle, run: RunState) =>
  runStatus(run) === 'playing'
    ? puzzle.layers[currentLayer(run) - 1]!.clue
    : null;

api.post('/start', async (c) => {
  const w = who(c);
  if ('error' in w) return w.error;
  const { userId, day, puzzle } = w;
  const runKey = keys.run(day, userId);
  // hSetNX makes two simultaneous starts create one run and count one player.
  if (
    await redis.hSetNX(
      runKey,
      'state',
      JSON.stringify(startRun(puzzleNumber(day)))
    )
  ) {
    await redis.expire(runKey, TTL_SECONDS);
    await redis.hIncrBy(keys.reached(day), '0', 1);
  }
  const [run, streak] = await Promise.all([
    loadRun(day, userId),
    loadStreak(userId),
  ]);
  if (!run) return fail(c, 409, 'Run not found, try again');
  return c.json<RunResponse>({
    puzzleNumber: run.puzzleNumber,
    date: day,
    status: runStatus(run),
    layer: currentLayer(run),
    clue: clueAt(puzzle, run),
    chain: run.cleared.map((cl) => link(puzzle, cl)),
    lives: run.pickaxes,
    score: score(run),
    onboarding: streak === null,
  });
});

api.post('/answer', async (c) => {
  const w = who(c);
  if ('error' in w) return w.error;
  const { userId, day, puzzle } = w;
  const body: unknown = await c.req.json().catch(() => null);
  if (
    typeof body !== 'object' ||
    body === null ||
    !('answer' in body && 'layer' in body) ||
    typeof body.answer !== 'string' ||
    body.answer.length > 200 ||
    !Number.isInteger(body.layer)
  )
    return fail(c, 400, 'Expected { answer, layer }');

  // One submit at a time per user, so a double tap can't spend two pickaxes or count twice.
  const lock = keys.lock(day, userId);
  if ((await redis.incrBy(lock, 1)) !== 1)
    return fail(c, 409, 'Still checking your last answer');
  await redis.expire(lock, LOCK_SECONDS);
  try {
    const run = await loadRun(day, userId);
    if (!run) return fail(c, 409, 'Start a run first');
    if (runStatus(run) !== 'playing') return fail(c, 409, 'This run is over');
    const layer = currentLayer(run);
    // A repeated request for a layer already answered is stale: answer it with no change.
    if (body.layer !== layer) return fail(c, 409, 'That layer is already done');

    const pool = puzzle.layers[layer - 1]!.pool;
    const checked = checkAnswer(run, body.answer, pool);
    const base = {
      answer: normalise(body.answer),
      total: score(run),
      lives: run.pickaxes,
    };
    if (checked.kind === 'ignored')
      return c.json(noMove(base, 'ignored', checked.reason));
    const { answer } = checked;

    let canonical: string;
    let commonness: Commonness | null;
    if (checked.match) {
      ({ canonical, commonness } = checked.match);
    } else {
      // Layer 1's pool holds every answer, so this catches aliases of answers already used.
      const earlier = matchAnswer(puzzle.layers[0]!.pool, answer);
      if (earlier && run.used.includes(normalise(earlier.canonical)))
        return c.json(noMove(base, 'ignored', 'reused'));
      const v = await judged(day, layer, puzzle, answer);
      if (!v) return c.json(noMove(base, 'unchecked', UNCHECKED));
      if (!v.valid)
        return c.json(
          await settle(day, userId, puzzle, run, {
            valid: false,
            answer,
            reason: v.reason,
          })
        );
      // The AI may name a pool answer ("mandarin" for "mandarine"): count it as that entry.
      const m = matchAnswer(pool, v.canonical);
      canonical = m?.canonical ?? v.canonical;
      commonness = m?.commonness ?? null;
      if (run.used.includes(normalise(canonical)))
        return c.json(noMove(base, 'ignored', 'reused'));
    }

    // Rarity is locked now, counting this answer (SPEC §3.2).
    const [count, total] = await Promise.all([
      redis.zIncrBy(keys.answers(day, layer), canonical, 1),
      redis.hIncrBy(keys.totals(day), String(layer), 1),
      redis.hIncrBy(keys.reached(day), String(layer), 1),
    ]);
    await Promise.all([
      redis.expire(keys.answers(day, layer), TTL_SECONDS),
      redis.expire(keys.totals(day), TTL_SECONDS),
      redis.expire(keys.reached(day), TTL_SECONDS),
    ]);
    const verdict: Verdict = {
      valid: true,
      answer,
      canonical,
      ...rarityBand(count, total, commonness),
    };
    const result = await settle(day, userId, puzzle, run, verdict);
    return c.json<AnswerResult>({
      ...result,
      percent: Math.round((count * 1000) / total) / 10,
    });
  } finally {
    await redis.del(lock);
  }
});

const noMove = (
  base: { answer: string; total: number; lives: number },
  outcome: 'ignored' | 'unchecked',
  reason: string
): AnswerResult => ({
  ...base,
  outcome,
  valid: false,
  reason,
  canonical: null,
  mineral: null,
  base: null,
  band: null,
  estimated: false,
  bonus: null,
  percent: null,
  nextClue: null,
  ended: false,
});

/** SPEC §4 steps 5–7: verdict cache, then the judge; every verdict is cached. */
async function judged(
  day: string,
  layer: number,
  puzzle: Puzzle,
  answer: string
): Promise<JudgeVerdict | null> {
  const cacheKey = keys.verdicts(day, layer);
  const cached = await redis.hGet(cacheKey, answer);
  if (cached) return JSON.parse(cached);
  const clues = puzzle.layers.slice(0, layer).map((l) => l.clue);
  // The key is only ever the geminiApiKey secret setting (paid tier, SPEC §5.3); no key = no AI.
  const judge = judgeFor(await settings.get<string>('geminiApiKey'));
  const verdict = await judge.judge(clues, answer);
  if (verdict) {
    await redis.hSet(cacheKey, { [answer]: JSON.stringify(verdict) });
    await redis.expire(cacheKey, TTL_SECONDS);
  }
  return verdict;
}

/** Applies the verdict, saves the run, and records the end of the run (graveyard, streak). */
async function settle(
  day: string,
  userId: string,
  puzzle: Puzzle,
  run: RunState,
  verdict: Verdict
): Promise<AnswerResult> {
  const { run: next, result } = applyAnswer(run, verdict);
  await redis.hSet(keys.run(day, userId), { state: JSON.stringify(next) });
  const ended = runStatus(next) !== 'playing';
  if (ended) {
    await redis.hIncrBy(keys.ends(day), String(next.cleared.length), 1);
    await redis.expire(keys.ends(day), TTL_SECONDS);
    const streak = updateStreak(await loadStreak(userId), day);
    await redis.hSet(keys.user(userId), {
      count: String(streak.count),
      lastDay: streak.lastDay,
    });
    await redis.expire(keys.user(userId), TTL_SECONDS);
  }
  const valid = result.kind === 'valid' ? result : null;
  const m = valid ? mineral(valid.layer) : null;
  return {
    outcome: valid ? 'valid' : 'invalid',
    valid: valid !== null,
    answer: verdict.answer,
    reason: result.kind === 'invalid' ? result.reason : null,
    canonical: valid?.canonical ?? null,
    mineral: m?.name ?? null,
    base: m?.base ?? null,
    band: valid?.band ?? null,
    estimated: valid?.estimated ?? false,
    bonus: valid && m ? valid.points - m.base : null,
    percent: null,
    total: score(next),
    lives: next.pickaxes,
    nextClue: clueAt(puzzle, next),
    ended,
  };
}

api.get('/result', async (c) => {
  const w = who(c);
  if ('error' in w) return w.error;
  const { userId, day, puzzle } = w;
  const run = await loadRun(day, userId);
  const status = run ? runStatus(run) : 'playing';
  if (!run || status === 'playing') return fail(c, 409, 'Finish the run first');
  const { total, rareFinds, hero } = scoreRun(run);
  return c.json<ResultResponse>({
    puzzleNumber: run.puzzleNumber,
    date: day,
    status,
    hero: hero.name,
    total,
    rareFinds,
    lives: run.pickaxes,
    streak: currentStreak(await loadStreak(userId), day),
    share: shareText(run),
    chain: puzzle.layers.map((l, i) => {
      const cl = run.cleared[i];
      return {
        layer: i + 1,
        clue: l.clue,
        cleared: cl ? link(puzzle, cl) : null,
      };
    }),
    finalAnswer: puzzle.layers[LAYER_COUNT - 1]!.pool[0]!.canonical,
  });
});

const SOMETHING_ELSE = 'something else';

api.get('/stats', async (c) => {
  const w = who(c);
  if ('error' in w) return w.error;
  const { userId, day, puzzle } = w;
  const [run, ends, reached] = await Promise.all([
    loadRun(day, userId),
    redis.hGetAll(keys.ends(day)),
    redis.hGetAll(keys.reached(day)),
  ]);
  const minerals = (h: Record<string, string>) =>
    Array.from({ length: LAYER_COUNT + 1 }, (_, l) =>
      Number(h[String(l)] ?? 0)
    );
  const cleared = run?.cleared.length ?? 0;
  const fossils = await Promise.all(
    puzzle.layers.slice(0, cleared).map(async (layer, i) => {
      const counts = await redis.zRange(keys.answers(day, i + 1), 0, -1);
      const pool = new Set(layer.pool.map((a) => a.canonical));
      // Only hand-reviewed pool answers are named to other players (SPEC §4.1).
      const shown = new Map<string, number>();
      for (const { member, score: n } of counts) {
        const name = pool.has(member) ? member : SOMETHING_ELSE;
        shown.set(name, (shown.get(name) ?? 0) + n);
      }
      const total = [...shown.values()].reduce((a, b) => a + b, 0);
      return [...shown]
        .map(([answer, count]) => ({
          answer,
          count,
          percent: Math.round((count * 1000) / total) / 10,
        }))
        .sort((a, b) => b.count - a.count);
    })
  );
  const reachedCounts = minerals(reached);
  return c.json<StatsResponse>({
    players: reachedCounts[0]!,
    graveyard: minerals(ends),
    reached: reachedCounts,
    fossils,
  });
});
