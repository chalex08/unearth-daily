# Content pipeline

Daily puzzles live in `content/puzzles/YYYY-MM-DD.json` (format: `Puzzle` in [src/shared/puzzle.ts](../src/shared/puzzle.ts)). They are drafted offline with the Gemini free tier, reviewed by hand, then committed. The server bundles them at build time; the client never sees them.

## The data rule (SPEC §5.3)

The scripts in `tools/` use the **Gemini free tier**, which lets Google use what we send to improve its products. So:

- Their **only inputs** are seed themes you write and our own puzzle files.
- They **never** read Redis, the Reddit API, player answers, the non-pool answer log, answer counts, usernames or anything else that came from Reddit. Don't paste any of that into a seed either.
- Each script starts with a guard comment saying so. Keep it there.
- The Devvit server never uses the free key; its only key is the paid `geminiApiKey` secret.

## Setup

Put these in `.env` (gitignored; never commit or print it):

```
GEMINI_FREE_API_KEY=...   # from a Google project with NO billing
GEMINI_FREE_MODEL=gemini-3.8-flash
```

`gemini-3.8-flash` is on the free tier (pricing page, checked 21 Nov 2026). Free-tier rate limits are per project and are only shown in AI Studio (aistudio.google.com/rate-limit); daily quotas reset at midnight Pacific. A draft takes several minutes. The script streams the response (a plain call hits Node's 300s fetch timeout while the model thinks) and retries network errors, 429 and 5xx up to 6 times with exponential backoff, using the server's `retryDelay` when it gives one. If a date still fails, run it again.

## Workflow

1. **Draft:** `npm run puzzle:generate -- --date 2026-11-22 --seed "Name something round"`
   - `--seed` is optional (a theme or first clue). The puzzle number comes from the date, counting from the committed puzzles.
   - The model returns 10 clues and every answer with its depth (the deepest layer it survives); the script expands that into one pool per layer and runs the shared validator. If validation fails, it sends the errors back and asks for a fix, up to 2 times.
   - Output: `content/puzzles/drafts/YYYY-MM-DD.json`. It is written even when still invalid (the script exits non-zero), so you can fix it by hand.
2. **Review:** `npm run review -- 2026-11-22` prints each layer's clue, answers by commonness (with aliases) and what the clue ruled out. Answer `y` to move it to `content/puzzles/`. Edit the JSON first if anything is off: an unfair clue, a missing common answer, a wrong commonness label.
3. **Validate:** `npm run validate:puzzles` checks every file in `content/puzzles/` (not drafts): the shared validator, file name = date, unique numbers. CI runs it on every push.
4. Commit the approved puzzle.

What reviewers check: early clues are generous; each clue adds one yes/no constraint; no trivia; nothing subjective; layer 10 leaves exactly one answer; common answers are in the pool (pool hits need no AI, and until LLM approval anything else gets "Couldn't check that").

## Fake answer counts for dev installs

Devvit Redis can only be reached from app code (the `devvit` CLI 0.15.4 has no Redis command), so seeding goes through a moderator menu item:

1. `npm run dev` (playtests under your personal `DEVVIT_APP_NAME`).
2. In the playtest subreddit's mod menu, choose **Seed fake answer counts (dev)**.

It writes 600 made-up runs for today's puzzle (or the latest bundled one): `answers:{date}:{layer}` sorted sets (canonical → count, pool answers only, weighted by commonness) and the `ends:{date}` hash (deepest layer → runs ended there). The previous keys for that day are cleared first. The numbers come from `Math.random` and our puzzle file, never from Reddit data or AI. It refuses on the canonical app (`unearth-daily`).
