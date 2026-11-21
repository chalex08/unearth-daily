# UNEARTH

UNEARTH is a daily word game that runs inside a Reddit post: one new puzzle a day, the same for everyone, with scores players can compare. <!-- TODO: replace with the real one-paragraph pitch from docs/briefing. --> It is built with [Devvit Web](https://developers.reddit.com/docs) and Phaser for Reddit's Game of the Day Hackathon.

> **Do not publish until after the hackathon.** For the hackathon we only **upload** and **playtest**. Nobody runs `devvit publish`. The publish script is renamed to `launch:after-hackathon` and refuses to run unless you confirm explicitly.

## Stack

- **Client** (`src/client/`): Phaser scenes plus a DOM overlay, built with Vite
- **Server** (`src/server/`): Hono API routes, game logic, Redis access, AI answer validator
- **Shared** (`src/shared/`): types and scoring logic used by both client and server
- **Content** (`content/puzzles/`): daily puzzle JSON files
- **Tools** (`tools/`): offline Node scripts (puzzle authoring with the Gemini free tier, validators, release guards) and the TypeScript project configs
- **Docs** (`docs/`): briefing, plan, terms, privacy

## Local setup

Requires Node.js 24.18+ (see `.nvmrc`) and a Reddit account that is connected to [Reddit for Developers](https://developers.reddit.com).

```sh
git clone git@github.com:chalex08/unearth-daily.git
cd unearth-daily
npm install
npx devvit login
cp .env.example .env   # then set DEVVIT_APP_NAME and DEVVIT_SUBREDDIT to your own dev lane
```

Teammates should follow the full first-time steps in [CONTRIBUTING.md](CONTRIBUTING.md).

## Canonical app vs. dev lanes

`devvit.json` is committed and is the single source of truth: app **`unearth-daily`**, dev subreddit **r/UnearthDaily** (the public demo subreddit). Following Devvit's [Multiple Developers](https://developers.reddit.com/docs/guides/tools/multiple_developers) guide, each developer overrides the CLI target locally in a gitignored `.env`:

| Variable           | Purpose                                   | Example            |
| ------------------ | ----------------------------------------- | ------------------ |
| `DEVVIT_APP_NAME`  | the app the CLI uploads and playtests     | `unearth-dev-alex` |
| `DEVVIT_SUBREDDIT` | where `npm run dev` installs the playtest | `unearth_dev_alex` |

Every `devvit` command reads `.env`. Precedence, highest first: real environment variables, then `.env`, then `devvit.json`. Never edit `devvit.json` to point at your own lane.

## Commands

| Command                          | What it does                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                    | Playtest (`devvit playtest`) on your dev app and subreddit, with live reload. Prints the playtest URL.                          |
| `npm run build`                  | Build client and server into `dist/`                                                                                            |
| `npm run typecheck`              | TypeScript (strict) across all projects                                                                                         |
| `npm run lint`                   | ESLint                                                                                                                          |
| `npm run test`                   | Vitest unit tests                                                                                                               |
| `npm run format`                 | Prettier                                                                                                                        |
| `npm run upload:dev`             | Upload your **dev** app. Refuses if the target would be `unearth-daily`.                                                        |
| `npm run deploy:prod`            | Upload the **canonical** `unearth-daily` app (app owner only). Refuses if `DEVVIT_APP_NAME` is anything else. Does not publish. |
| `npm run launch:after-hackathon` | Publishes for review. **Not before the hackathon ends.** Refuses unless you pass `-- --confirm-hackathon-is-over`.              |

Uploading puts a private version in the App Directory; only you can see it, and it can only be installed on subreddits with fewer than 200 members. Publishing is what submits the app for Reddit review. We don't publish during the hackathon.

## Secrets

- **Runtime (Gemini paid tier):** the key comes from a Google project with billing enabled and is a Devvit secret app setting (`geminiApiKey` in `devvit.json`, `isSecret: true`). It is never stored in code or in `.env`. Secrets belong to one app, so each dev app needs its own key:
  ```sh
  npm run dev                               # the app must be installed at least once first
  npx devvit settings set geminiApiKey      # targets the app named by DEVVIT_APP_NAME
  ```
  The app owner sets the key for `unearth-daily` with `DEVVIT_APP_NAME=unearth-daily` set in their shell.
- **Offline tools (Gemini free tier):** `GEMINI_FREE_API_KEY` (from a separate Google project with no billing) and `GEMINI_FREE_MODEL` go in your gitignored `.env`. Only the scripts in `tools/` use them, and they must never send Reddit data to it (SPEC §5.3).

Never commit `.env` or any key.
