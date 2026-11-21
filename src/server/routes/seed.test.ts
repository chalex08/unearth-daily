import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  del: vi.fn(async (..._keys: string[]) => {}),
  hSet: vi.fn(async (_k: string, _v: Record<string, string>) => 1),
  ctx: {
    appSlug: 'unearth-dev' as string | undefined,
    userId: 't2_alice' as string | undefined,
  },
}));

vi.mock('@devvit/web/server', () => ({
  redis: { del: env.del, hSet: env.hSet, expire: async () => {} },
  context: env.ctx,
}));

const { devApi, seed } = await import('./seed');
const { runStatus } = await import('../../shared/game');

const reset = async () =>
  (await seed.request('/reset-my-run', { method: 'POST' })).json();

describe('reset-my-run', () => {
  beforeEach(() => {
    env.del.mockClear();
    env.ctx.appSlug = 'unearth-dev';
    env.ctx.userId = 't2_alice';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-22T23:30:00Z'));
  });

  it("deletes only the caller's run and lock for today", async () => {
    await reset();
    expect(env.del).toHaveBeenCalledWith(
      'run:2026-11-22:t2_alice',
      'lock:2026-11-22:t2_alice'
    );
  });

  it('refuses on the canonical app', async () => {
    env.ctx.appSlug = 'unearth-daily';
    expect(await reset()).toEqual({
      showToast: 'Resetting runs is for dev apps only',
    });
    expect(env.del).not.toHaveBeenCalled();
  });

  it('needs a logged-in user', async () => {
    env.ctx.userId = undefined;
    await reset();
    expect(env.del).not.toHaveBeenCalled();
  });
});

describe('dev jump', () => {
  const jump = (to: unknown) =>
    devApi.request('/jump', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ to }),
    });
  const saved = () => JSON.parse(env.hSet.mock.calls.at(-1)?.[1].state ?? '');

  beforeEach(() => {
    env.hSet.mockClear();
    env.ctx.appSlug = 'unearth-dev';
    env.ctx.userId = 't2_alice';
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-21T12:00:00Z'));
  });

  it('clears the layers above the target with pool answers', async () => {
    expect((await jump(6)).status).toBe(200);
    const run = saved();
    expect(run.cleared.map((c: { layer: number }) => c.layer)).toEqual([
      1, 2, 3, 4, 5,
    ]);
    expect(runStatus(run)).toBe('playing');
  });

  it('11 is the Uranium finish', async () => {
    await jump(11);
    expect(runStatus(saved())).toBe('cleared');
  });

  it('is not there on the canonical app or with no app slug', async () => {
    env.ctx.appSlug = 'unearth-daily';
    expect((await jump(3)).status).toBe(404);
    env.ctx.appSlug = undefined;
    expect((await jump(3)).status).toBe(404);
    expect(env.hSet).not.toHaveBeenCalled();
  });
});
