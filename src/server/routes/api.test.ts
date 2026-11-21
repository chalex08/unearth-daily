import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AnswerResult,
  ResultResponse,
  RunResponse,
  StatsResponse,
} from '../../shared/api';
import { puzzleNumber } from '../../shared/game';
import { puzzles } from '../core/puzzles';

// In-memory stand-in for the few Devvit Redis calls the routes use.
const env = vi.hoisted(() => {
  const hashes = new Map<string, Map<string, string>>();
  const zsets = new Map<string, Map<string, number>>();
  const strings = new Map<string, number>();
  const hash = (k: string) => hashes.get(k) ?? hashes.set(k, new Map()).get(k)!;
  const zset = (k: string) => zsets.get(k) ?? zsets.set(k, new Map()).get(k)!;
  const redis = {
    hGet: async (k: string, f: string) => hash(k).get(f),
    hGetAll: async (k: string) => Object.fromEntries(hash(k)),
    hSet: async (k: string, v: Record<string, string>) => {
      for (const [f, x] of Object.entries(v)) hash(k).set(f, x);
      return Object.keys(v).length;
    },
    hSetNX: async (k: string, f: string, v: string) => {
      if (hash(k).has(f)) return 0;
      hash(k).set(f, v);
      return 1;
    },
    hIncrBy: async (k: string, f: string, n: number) => {
      const v = Number(hash(k).get(f) ?? 0) + n;
      hash(k).set(f, String(v));
      return v;
    },
    zIncrBy: async (k: string, m: string, n: number) => {
      const v = (zset(k).get(m) ?? 0) + n;
      zset(k).set(m, v);
      return v;
    },
    zRange: async (k: string) =>
      [...zset(k)].map(([member, score]) => ({ member, score })),
    incrBy: async (k: string, n: number) => {
      strings.set(k, (strings.get(k) ?? 0) + n);
      return strings.get(k)!;
    },
    expire: async () => {},
    del: async (...ks: string[]) => {
      for (const k of ks) {
        hashes.delete(k);
        zsets.delete(k);
        strings.delete(k);
      }
    },
  };
  const state: { userId: string | undefined; key: string | undefined } = {
    userId: 't2_alice',
    key: undefined,
  };
  const reset = () => {
    hashes.clear();
    zsets.clear();
    strings.clear();
    state.userId = 't2_alice';
    state.key = undefined;
  };
  return { redis, state, reset, hashes, zsets };
});

vi.mock('@devvit/web/server', () => ({
  redis: env.redis,
  context: {
    get userId() {
      return env.state.userId;
    },
  },
  settings: { get: async () => env.state.key },
}));

const { api } = await import('./api');

const json = async <T>(res: Response | Promise<Response>): Promise<T> =>
  (await res).json();

const start = async () =>
  await json<RunResponse>(api.request('/start', { method: 'POST' }));
const submit = (answer: string, layer: number) =>
  api.request('/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ answer, layer }),
  });
const answer = async (text: string, layer: number) =>
  await json<AnswerResult>(submit(text, layer));

/** Gemini REST response wrapping the given verdict text. */
const gemini = (text: string) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: 200 }
  );
const verdict = (valid: boolean, canonical: string, reason = '') =>
  gemini(JSON.stringify({ valid, canonical, offensive: false, reason }));

// Puzzle #14 (content/puzzles/2026-11-21.json): one valid answer per layer.
const WIN = [
  'tiger',
  'orange juice',
  'carrot',
  'pumpkin',
  'mango',
  'navel orange',
  'clementine',
  'mandarin',
  'calamondin',
  'chinotto',
];

beforeEach(() => {
  env.reset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('puzzles', () => {
  it('numbers every bundled puzzle from the launch day', () => {
    for (const p of puzzles) expect(p.number).toBe(puzzleNumber(p.date));
  });
});

describe('POST /start', () => {
  it('starts a run with only the first clue, then resumes it', async () => {
    const run = await start();
    expect(run).toMatchObject({
      puzzleNumber: 14,
      date: '2026-11-21',
      status: 'playing',
      layer: 1,
      clue: 'Name something orange',
      chain: [],
      lives: 3,
      score: 0,
      onboarding: true,
    });
    await answer('tiger', 1);
    const again = await start();
    expect(again.layer).toBe(2);
    expect(again.chain.map((c) => c.answer)).toEqual(['tiger']);
    expect(env.hashes.get('reached:2026-11-21')?.get('0')).toBe('1');
  });

  it('never sends future clues or pools', async () => {
    const body = JSON.stringify(await start());
    expect(body).not.toContain('that you can eat');
    expect(body).not.toContain('chinotto');
    expect(body).not.toContain('traffic cone');
  });

  it('needs a logged-in user and a puzzle for today', async () => {
    env.state.userId = undefined;
    expect((await api.request('/start', { method: 'POST' })).status).toBe(401);
    env.state.userId = 't2_alice';
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    expect((await api.request('/start', { method: 'POST' })).status).toBe(404);
  });
});

describe('POST /answer', () => {
  beforeEach(start);

  it('validates pool answers with no AI and locks rarity', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const r = await answer('Tigers!', 1);
    expect(r).toMatchObject({
      outcome: 'valid',
      valid: true,
      canonical: 'tiger',
      mineral: 'Dirt',
      base: 10,
      band: 'Common',
      estimated: true,
      bonus: 0,
      percent: 100,
      total: 10,
      lives: 3,
      nextClue: '…that you can eat',
      ended: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(env.zsets.get('answers:2026-11-21:1')?.get('tiger')).toBe(1);
  });

  it('ignores empty, too-long and reused answers at no cost', async () => {
    await answer('tiger', 1);
    for (const text of ['  ', 'x'.repeat(41), 'tigers']) {
      const r = await answer(text, 2);
      expect(r.outcome).toBe('ignored');
      expect(r.lives).toBe(3);
    }
  });

  it('rejects a stale layer (double submit) and concurrent submits', async () => {
    await answer('tiger', 1);
    expect((await submit('fox', 1)).status).toBe(409);
    const [a, b] = await Promise.all([
      submit('fanta', 2),
      submit('cheetos', 2),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await start()).chain).toHaveLength(2);
  });

  it('rejects a bad body', async () => {
    const res = await api.request('/answer', {
      method: 'POST',
      body: '{"answer":1}',
    });
    expect(res.status).toBe(400);
  });

  it('with no key, unknown answers are unchecked and cost nothing', async () => {
    const r = await answer('zzz unknown thing', 1);
    expect(r).toMatchObject({
      outcome: 'unchecked',
      reason: "Couldn't check that, try again",
      lives: 3,
    });
    expect(env.hashes.get('verdicts:2026-11-21:1')?.size ?? 0).toBe(0);
    expect((await start()).layer).toBe(1);
  });

  it.each([
    ['times out', () => Promise.reject(new DOMException('t', 'TimeoutError'))],
    ['returns HTTP 500', async () => new Response('', { status: 500 })],
    ['returns malformed JSON', async () => gemini('{"valid": "yes"}')],
    [
      'is not approved (fetch denied)',
      () => Promise.reject(new TypeError('denied')),
    ],
  ])(
    'when the AI %s, the answer is unchecked and nothing is cached',
    async (_, impl) => {
      env.state.key = 'test-key';
      vi.stubGlobal('fetch', vi.fn(impl));
      const r = await answer('ripe persimmon slice', 1);
      expect(r).toMatchObject({ outcome: 'unchecked', lives: 3 });
      expect(env.hashes.get('verdicts:2026-11-21:1')?.size ?? 0).toBe(0);
    }
  );

  it('AI-approved answers count, are cached, and show as "something else" to others', async () => {
    env.state.key = 'test-key';
    const fetchSpy = vi.fn(async () => verdict(true, 'orange kazoo'));
    vi.stubGlobal('fetch', fetchSpy);
    const r = await answer('orange kazoo', 1);
    expect(r).toMatchObject({
      outcome: 'valid',
      canonical: 'orange kazoo',
      band: 'Vein',
      estimated: true,
      bonus: 5,
    });

    env.state.userId = 't2_bob';
    await start();
    await answer('orange  kazoo', 1);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // second time came from the cache
    const stats = await json<StatsResponse>(api.request('/stats'));
    expect(stats.fossils[0]).toEqual([
      { answer: 'something else', count: 2, percent: 100 },
    ]);
    expect(JSON.stringify(stats)).not.toContain('kazoo');
  });

  it('an AI rejection breaks a pickaxe and is cached', async () => {
    env.state.key = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => verdict(false, 'blue whale', 'Whales are blue'))
    );
    const r = await answer('blue whale', 1);
    expect(r).toMatchObject({
      outcome: 'invalid',
      valid: false,
      reason: 'Whales are blue',
      lives: 2,
    });
    expect(env.hashes.get('verdicts:2026-11-21:1')?.has('blue whale')).toBe(
      true
    );
  });

  it('sends the judge only the clues so far and the normalised answer', async () => {
    env.state.key = 'test-key';
    const fetchSpy = vi.fn(async (_url: string, _init: RequestInit) =>
      verdict(false, 'x', 'no')
    );
    vi.stubGlobal('fetch', fetchSpy);
    await answer('tiger', 1);
    await answer('Orange  Lego!', 2);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toContain('generativelanguage.googleapis.com');
    expect(new Headers(init.headers).get('x-goog-api-key')).toBe('test-key');
    const sent = String(init.body);
    expect(sent).toContain('\\"orange lego\\"');
    expect(sent).toContain('that you can eat');
    expect(sent).not.toContain('that grows on a plant');
    expect(sent).not.toContain('alice');
    expect(sent).not.toContain('tiger');
  });
});

describe('a full run', () => {
  it('reaches Uranium, then reveals the result and stats', async () => {
    await start();
    expect((await api.request('/result')).status).toBe(409);
    for (const [i, text] of WIN.entries()) {
      const stats = await json<StatsResponse>(api.request('/stats'));
      expect(stats.fossils).toHaveLength(i);
      await answer(text, i + 1);
    }
    const res = await json<ResultResponse>(api.request('/result'));
    expect(res).toMatchObject({
      status: 'cleared',
      hero: 'Uranium',
      lives: 3,
      streak: 1,
      finalAnswer: 'chinotto',
    });
    expect(res.chain).toHaveLength(10);
    expect(res.chain.every((c) => c.cleared)).toBe(true);
    // 935 base for layers 1–9 + estimated bonuses + 500 + 150 pickaxe bonus
    expect(res.total).toBe(
      res.chain.reduce((s, c) => s + c.cleared!.points, 0) + 150
    );
    const stats = await json<StatsResponse>(api.request('/stats'));
    expect(stats).toMatchObject({ players: 1 });
    expect(stats.graveyard[10]).toBe(1);
    expect(stats.reached[10]).toBe(1);
    expect((await submit('anything', 11)).status).toBe(409);
  });

  it('caves in after three wrong answers', async () => {
    env.state.key = 'test-key';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => verdict(false, 'x', 'Nope'))
    );
    await start();
    let r: AnswerResult | undefined;
    for (const text of ['blue whale', 'green pea', 'red brick'])
      r = await answer(text, 1);
    expect(r).toMatchObject({
      outcome: 'invalid',
      lives: 0,
      ended: true,
      nextClue: null,
      total: 0,
    });
    const res = await json<ResultResponse>(api.request('/result'));
    expect(res).toMatchObject({
      status: 'caved-in',
      hero: 'Surface',
      total: 0,
    });
    expect(res.chain[0]).toMatchObject({
      clue: 'Name something orange',
      cleared: null,
    });
  });
});
