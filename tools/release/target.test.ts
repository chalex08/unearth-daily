import { describe, expect, it } from 'vitest';
import { checkDevTarget, checkProdTarget, resolveAppTarget } from './target.ts';

const canonical = 'unearth-daily';

describe('resolveAppTarget', () => {
  it('falls back to devvit.json when nothing overrides it', () => {
    expect(
      resolveAppTarget({
        processEnv: {},
        dotenvContent: undefined,
        configName: canonical,
      })
    ).toEqual({ name: canonical, source: 'devvit.json' });
  });

  it('reads DEVVIT_APP_NAME from .env', () => {
    const dotenvContent =
      '# comment\nDEVVIT_APP_NAME=unearth-dev-alex\nDEVVIT_SUBREDDIT=x\n';
    expect(
      resolveAppTarget({ processEnv: {}, dotenvContent, configName: canonical })
    ).toEqual({
      name: 'unearth-dev-alex',
      source: '.env',
    });
  });

  it('ignores an empty DEVVIT_APP_NAME in .env', () => {
    expect(
      resolveAppTarget({
        processEnv: {},
        dotenvContent: 'DEVVIT_APP_NAME=\n',
        configName: canonical,
      })
    ).toEqual({ name: canonical, source: 'devvit.json' });
  });

  it('lets the real environment win over .env, like the Devvit CLI', () => {
    expect(
      resolveAppTarget({
        processEnv: { DEVVIT_APP_NAME: ' unearth-daily ' },
        dotenvContent: 'DEVVIT_APP_NAME=unearth-dev-alex',
        configName: canonical,
      })
    ).toEqual({ name: canonical, source: 'environment' });
  });
});

describe('checkProdTarget', () => {
  it('allows the canonical app', () => {
    expect(
      checkProdTarget({ name: canonical, source: 'devvit.json' }, canonical).ok
    ).toBe(true);
  });

  it('refuses a dev app', () => {
    const result = checkProdTarget(
      { name: 'unearth-dev-alex', source: '.env' },
      canonical
    );
    expect(result.ok).toBe(false);
  });
});

describe('checkDevTarget', () => {
  it('refuses the canonical app', () => {
    expect(
      checkDevTarget({ name: canonical, source: 'devvit.json' }, canonical).ok
    ).toBe(false);
  });

  it('allows a dev app', () => {
    expect(
      checkDevTarget({ name: 'unearth-dev-sam', source: '.env' }, canonical).ok
    ).toBe(true);
  });
});
