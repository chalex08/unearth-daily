import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  del: vi.fn(async (..._keys: string[]) => {}),
  ctx: { appSlug: 'unearth-dev', userId: 't2_alice' as string | undefined },
}));

vi.mock('@devvit/web/server', () => ({
  redis: { del: env.del },
  context: env.ctx,
}));

const { seed } = await import('./seed');

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
