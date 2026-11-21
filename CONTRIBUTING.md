# Contributing to UNEARTH

Two developers work on this repo. Each has their own Devvit **dev app** and **playtest subreddit**, so we never overwrite each other's playtests. This follows Devvit's [Multiple Developers](https://developers.reddit.com/docs/guides/tools/multiple_developers) guide.

## Ground rules

- **Only the app owner (Alex) runs `npm run deploy:prod`.** It uploads the canonical `unearth-daily` app. Everyone else only uploads and playtests their own dev app.
- **Nobody publishes before the hackathon ends.** No `devvit publish`, ever, until then. The `launch:after-hackathon` script exists for afterwards and refuses to run without explicit confirmation.
- `devvit.json` is shared config. Don't edit it to point at your own app or subreddit; use `.env` for that.
- Never commit `.env`, API keys or tokens.

## First-time setup

You need Node.js 24.18+ (`.nvmrc`), git, access to the GitHub repo, and a Reddit account.

1. **Clone and install**

   ```sh
   git clone git@github.com:chalex08/unearth-daily.git
   cd unearth-daily
   npm install
   ```

2. **Log the Devvit CLI in** (opens your browser):

   ```sh
   npx devvit login
   ```

3. **Create your playtest subreddit** on reddit.com, for example `r/unearth_dev_<you>`. It must have fewer than 200 members, and you must be a moderator. (Optional: if you skip this, use the private one the CLI creates in step 5.)

4. **Create your `.env`**

   ```sh
   cp .env.example .env
   ```

   Then set your own lane:

   ```sh
   DEVVIT_APP_NAME=unearth-dev-<you>
   DEVVIT_SUBREDDIT=unearth_dev_<you>
   ```

   Every `devvit` command reads `.env`, so this redirects playtests and uploads to your lane. Real environment variables take precedence over `.env`, which takes precedence over `devvit.json`.

   **Both variables must be set (not blank) before step 5.** When the CLI creates an app, it writes the new app name and subreddit back to wherever they came from: to `.env` if the variables are set, otherwise into the shared `devvit.json`.

5. **Create your dev app (once)**

   ```sh
   npm run upload:dev
   ```

   Your dev app doesn't exist yet, so the CLI opens Reddit's app-creation wizard in your browser. Name the app exactly `unearth-dev-<you>`. When it finishes, the CLI changes three files:
   - **`.env`**: it sets `DEVVIT_SUBREDDIT` to a new private subreddit it creates for every new app, `r/unearth_dev_<you>_dev`. Set it back to `unearth_dev_<you>`, or keep the auto-created one if you prefer; either works.
   - **`package.json`**: it sets `name` to your app name. Undo this before you commit anything: `git checkout -- package.json`
   - **`devvit.json`**: it must be unchanged. Check with `git status`; if it changed, a variable was blank. Undo it with `git checkout -- devvit.json` and fix `.env`.

6. **Playtest**

   ```sh
   npm run dev
   ```

   This prints a URL like `https://www.reddit.com/r/unearth_dev_<you>/?playtest=unearth-dev-<you>`. Open it and create a post from the subreddit menu if there isn't one yet. Saving code reloads the playtest. Press Ctrl+C to stop.

7. **Set your own Gemini key** (needs at least one install, so run step 6 first). Secrets belong to a single app, so your dev app needs its own key:

   ```sh
   npx devvit settings set geminiApiKey
   ```

   This targets the app named in `DEVVIT_APP_NAME`. Use your own **paid-tier** Gemini API key (a Google project with billing enabled, never a free-tier key); don't share keys.

8. Puzzles are written in Claude Code with `/write-puzzle` (no key needed); see [docs/CONTENT.md](docs/CONTENT.md). Never give it Reddit data (SPEC §5.3).

## Branch workflow

- Never push to `main` directly. Every change goes through a pull request, and the **CI / checks** job (typecheck, lint, test, build) must pass before merging. GitHub can't enforce this on a private repo on the Free plan, so it's on us: don't merge a PR with red or pending checks.
- Use short-lived feature branches off an up-to-date `main`, e.g. `feat/dig-animation`, `fix/streak-reset`, `chore/deps`. Aim to merge within a day or two.
- Before opening a PR, run locally:

  ```sh
  npm run typecheck && npm run lint && npm run test
  ```

- Open the PR against `main`, keep it focused, and describe what you changed and how you playtested it.
- **Squash merge** only, then delete the branch. The squash commit title follows the convention below.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short imperative summary>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `build`, `perf`, `style`. Examples:

```
feat(client): add dig animation to the letter grid
fix(server): reset streak at UTC midnight
docs: explain dev app setup
```

Keep the summary to 72 characters or fewer, written in the imperative ("add", not "added"). Explain _why_ in the body when it isn't obvious.
