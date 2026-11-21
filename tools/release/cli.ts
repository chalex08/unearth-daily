/**
 * Guarded release commands. Run through npm scripts:
 *
 *   npm run upload:dev               upload your personal dev app (never the canonical one)
 *   npm run deploy:prod              upload the canonical app (app owner only)
 *   npm run launch:after-hackathon   publish for review; refuses unless explicitly confirmed
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkDevTarget,
  checkProdTarget,
  resolveAppTarget,
  type GuardResult,
} from './target.ts';

type Env = typeof process.env;

const root = path.resolve(import.meta.dirname, '..', '..');
const config = JSON.parse(
  readFileSync(path.join(root, 'devvit.json'), 'utf8')
) as {
  name: string;
  dev?: { subreddit?: string };
};
const canonicalName = config.name;
const dotenvPath = path.join(root, '.env');
const target = resolveAppTarget({
  processEnv: process.env,
  dotenvContent: existsSync(dotenvPath)
    ? readFileSync(dotenvPath, 'utf8')
    : undefined,
  configName: canonicalName,
});

function fail(message: string): never {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function enforce(result: GuardResult, hint: string): void {
  if (!result.ok) {
    fail(`${result.reason}\n  ${hint}`);
  }
}

function run(command: string, env: Env = process.env): void {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: true,
  });
  if (result.status !== 0) {
    fail(`"${command}" failed with exit code ${String(result.status)}.`);
  }
}

function checks(): void {
  run('npm run typecheck');
  run('npm run lint');
  run('npm run test');
}

/** Environment for the canonical app: pin the name so `.env` cannot change it. */
function canonicalEnv(): Env {
  const env: Env = {
    ...process.env,
    DEVVIT_APP_NAME: canonicalName,
  };
  if (config.dev?.subreddit) {
    env['DEVVIT_SUBREDDIT'] = config.dev.subreddit;
  }
  return env;
}

const command = process.argv[2];

switch (command) {
  case 'upload-dev': {
    enforce(
      checkDevTarget(target, canonicalName),
      'Put DEVVIT_APP_NAME=unearth-dev-<you> in .env (see CONTRIBUTING.md).'
    );
    console.log(`Uploading dev app "${target.name}" (from ${target.source}).`);
    checks();
    run('npx devvit upload');
    break;
  }
  case 'deploy-prod': {
    enforce(
      checkProdTarget(target, canonicalName),
      `If you are the app owner, run it with the override set explicitly, e.g. in PowerShell:\n` +
        `    $env:DEVVIT_APP_NAME='${canonicalName}'; npm run deploy:prod; Remove-Item Env:DEVVIT_APP_NAME`
    );
    console.log(
      `Uploading canonical app "${canonicalName}". This does NOT publish.`
    );
    checks();
    run('npx devvit upload', canonicalEnv());
    break;
  }
  case 'launch-after-hackathon': {
    console.warn(
      '\n⚠  WARNING: this PUBLISHES the app for Reddit review (devvit publish).\n' +
        '⚠  Do NOT run it before the hackathon is over. Upload + playtest only until then.\n'
    );
    if (!process.argv.includes('--confirm-hackathon-is-over')) {
      fail(
        'Refusing to publish. When the hackathon has ended and the app owner has agreed, run:\n' +
          '    npm run launch:after-hackathon -- --confirm-hackathon-is-over'
      );
    }
    enforce(
      checkProdTarget(target, canonicalName),
      'Publishing is only allowed for the canonical app.'
    );
    checks();
    run('npx devvit upload', canonicalEnv());
    run('npx devvit publish', canonicalEnv());
    break;
  }
  default:
    fail(
      `Unknown command "${String(command)}". Use upload-dev, deploy-prod or launch-after-hackathon.`
    );
}
