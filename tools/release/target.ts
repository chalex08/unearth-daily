import { parseEnv } from 'node:util';

/**
 * Works out which Devvit app the CLI will target, using the same precedence as
 * the Devvit CLI itself (bin/devvit.js loads `.env` with dotenv, which never
 * overrides variables that are already set; Project.name then prefers
 * DEVVIT_APP_NAME over devvit.json):
 *
 *   1. DEVVIT_APP_NAME in the real process environment
 *   2. DEVVIT_APP_NAME in the project's `.env` file
 *   3. `name` in devvit.json
 */
export type AppTarget = {
  name: string;
  source: 'environment' | '.env' | 'devvit.json';
};

export type ResolveInput = {
  processEnv: Record<string, string | undefined>;
  dotenvContent: string | undefined;
  configName: string;
};

export function resolveAppTarget(input: ResolveInput): AppTarget {
  const fromProcess = input.processEnv['DEVVIT_APP_NAME']?.trim();
  if (fromProcess) {
    return { name: fromProcess, source: 'environment' };
  }
  if (input.dotenvContent !== undefined) {
    const fromFile = parseEnv(input.dotenvContent)['DEVVIT_APP_NAME']?.trim();
    if (fromFile) {
      return { name: fromFile, source: '.env' };
    }
  }
  return { name: input.configName, source: 'devvit.json' };
}

export type GuardResult = { ok: true } | { ok: false; reason: string };

/** deploy:prod may only ever target the canonical app. */
export function checkProdTarget(
  target: AppTarget,
  canonicalName: string
): GuardResult {
  if (target.name === canonicalName) {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      `deploy:prod uploads the canonical app "${canonicalName}", but DEVVIT_APP_NAME ` +
      `resolves to "${target.name}" (from ${target.source}). Refusing to upload.`,
  };
}

/** upload:dev must target a personal dev app, never the canonical one. */
export function checkDevTarget(
  target: AppTarget,
  canonicalName: string
): GuardResult {
  if (target.name !== canonicalName) {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      `upload:dev would upload to the canonical app "${canonicalName}" ` +
      `(from ${target.source}). Set DEVVIT_APP_NAME to your own dev app in .env.`,
  };
}
