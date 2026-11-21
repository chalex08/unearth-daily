# Content pipeline

Daily puzzles live in `content/puzzles/YYYY-MM-DD.json` (format: `Puzzle` in [src/shared/puzzle.ts](../src/shared/puzzle.ts)). Claude writes them in a Claude Code session with the `/write-puzzle` project skill; you review them by hand, then commit. The server bundles them at build time; the client never sees them. No API key is involved: Gemini (paid tier) is used only for in-game answer checking.

## The data rule (SPEC §5.3)

No AI tool or session used for content may ever receive Reddit data:

- Its **only inputs** are seed themes you write and our own puzzle files.
- Never paste or point it at Redis, the Reddit API, player answers, the non-pool answer log, answer counts, usernames or anything else that came from Reddit. Not in a seed theme either.
- Adding answers to pools from the non-pool answer log is **manual only**.
- The scripts in `tools/` start with a guard comment saying so. Keep it there.

## How to write puzzles

1. **Write:** in Claude Code, run `/write-puzzle 2026-11-27` (optionally add a seed theme: `/write-puzzle 2026-11-27 Name something round`). It writes `content/puzzles/drafts/2026-11-27.json`, which passes the validator, and `drafts/2026-11-27.review.md` with the judgement calls for you to check.
2. **Review:** `npm run review -- 2026-11-27` prints each layer's clue, answers by commonness (with aliases) and what each clue ruled out. Settle the points in the `.review.md`, editing the JSON if needed.
3. **Approve:** answer `y` to move the draft to `content/puzzles/`, run `npm run validate:puzzles`, delete the `.review.md` and commit.

What the skill does: reads the existing puzzles so it doesn't repeat a final answer, theme or first clue (`npm run puzzle:taken`); picks the final answer first and builds the 10 clues backwards, broad to narrow, one testable constraint each; writes generous pools (100+ answers at layer 1) as a depth list (`drafts/<date>.ladder.json`, gitignored) that `npm run puzzle:build -- <date>` expands into per-layer pools and checks (validator, clues that remove nothing, pool sizes); then a fresh-context critic subagent sees only the clues and looks for a second final answer and obvious answers missing from the pools.

What reviewers check: early clues are generous; each clue adds one yes/no constraint; answers get nicher with depth and the final answer is niche (most adults wouldn't know it), never a household name; no dates, records or statistics; nothing subjective; layer 10 leaves exactly one answer; common answers are in the pool (pool hits need no AI call, and only pool answers are ever shown to other players; when the AI judge is unavailable anything else gets "Couldn't check that").

`npm run validate:puzzles` checks every file in `content/puzzles/` (not drafts): the shared validator, file name = date, unique numbers. CI runs it on every push.

## Fake answer counts for dev installs

Devvit Redis can only be reached from app code (the `devvit` CLI 0.15.4 has no Redis command), so seeding goes through a moderator menu item:

1. `npm run dev` (playtests under your personal `DEVVIT_APP_NAME`).
2. In the playtest subreddit's mod menu, choose **Seed fake answer counts (dev)**.

It writes 600 made-up runs for today's puzzle (or the latest bundled one): `answers:{date}:{layer}` sorted sets (canonical → count, pool answers only, weighted by commonness) and the `ends:{date}` hash (deepest layer → runs ended there). The previous keys for that day are cleared first. The numbers come from `Math.random` and our puzzle file, never from Reddit data or AI. It refuses on the canonical app (`unearth-daily`).
