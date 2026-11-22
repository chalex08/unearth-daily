# Build plan

Today is Sat 21 Nov 2026. **Submission-ready: Sun 6 Dec.** Hard deadline: Tue 8 Dec, 6:00pm PT. Mon 7 and Tue 8 Dec are buffer only.

Each step is one prompt / one feature branch, merged to `main` when typecheck, lint and tests are green. Behaviour comes from [SPEC.md](SPEC.md); tech choices from [DECISIONS.md](DECISIONS.md).

## Start now (lead time, not code)

- [x] ~~Ask the Devvit team to allowlist Journeys~~ No request now (22 Nov): build it in step 10, then read the receipt on the uploaded canonical app; reach out only if it says `DENIED_NOT_ALLOWLISTED` (DECISIONS open item 2).
- [ ] Confirm r/UnearthDaily is public, has fewer than 200 members, and you moderate it.
- [ ] Draft Terms and Privacy pages (needed for fetch + LLM approval). **By step 4.**
- [ ] Request LLM approval and Journeys approval from Devvit. _LLM approval granted 22 Nov 2026 for both apps; Journeys: see above._

## Steps

### 1. Foundation docs — Sat 21 Nov

- [x] `CLAUDE.md`, `docs/SPEC.md`, `docs/PLAN.md`, `docs/DECISIONS.md` written and merged.
- [x] Devvit APIs checked against current docs; unverified items listed in DECISIONS.md.

### 2. Shared core logic + tests — Sun 22 Nov

Pure TypeScript in `src/shared/`, no Devvit imports.

- [x] Normalisation (lowercase, trim, collapse spaces, strip punctuation, 40-char limit).
- [x] Mineral table, rarity bands with cold start / "estimated", scoring (base + bonus + 50 per pickaxe), share text.
- [x] Run state machine: 10 layers, 3 pickaxes, reuse without penalty, empty input without penalty, end conditions.
- [x] UTC day key and streak update. Puzzle number comes from the puzzle file (`number`).
- [x] Puzzle file type, plus a validator for it.
- **Done when:** Vitest covers every rule in SPEC §2–§4 using puzzle #14, including band boundaries and the 853-point share example.

### 3. Content pipeline + seed data — Mon 23 Nov

- [x] Puzzle drafting: the `/write-puzzle` Claude Code skill (replaced the Gemini free-tier script on 21 Nov) writes a puzzle from an optional hand-written seed theme into `content/puzzles/drafts/` for review, checked by an independent critic subagent. Its only inputs are seed themes and our own puzzle files: no Reddit data (SPEC §5.3).
- [x] Validator: 10 clues, a pool for each layer with aliases and commonness, exactly one answer at layer 10, and every answer at layer N also valid for layers 1..N−1.
- [ ] Puzzle #14 seeded by hand (done: `content/puzzles/2026-11-21.json`), plus at least 6 more reviewed puzzles written with `/write-puzzle`. The five Gemini drafts (22–26 Nov) have long, multi-constraint clues; rewrite them with the skill.
- [x] Dev-only fake answer counts (mod menu item), see [CONTENT.md](CONTENT.md).
- **Done when:** the validator passes on every committed puzzle in CI, nothing in `src/` references a free-tier key (the `GEMINI_FREE` check in CI), and no `tools/` script or content skill reads Redis, the Reddit API or the answer log.

### 4. Server + AI judge — Tue 24 – Wed 25 Nov

- [x] Add `generativelanguage.googleapis.com` to `permissions.http`, plus a "Fetch Domains" section in README; upload the same day to start domain approval.
- [x] `/api/` routes: start/resume a run, submit an answer, get today's state. Remove the template's counter routes.
- [x] Validation pipeline in order: pool → Redis verdict cache → Gemini paid-tier judge (`AnswerJudge`, key only from the `geminiApiKey` secret), 8s timeout, strict JSON, answer handled as data.
- [x] No-AI mode (SPEC §4, §5.3): with no LLM approval or no key, pool answers still validate and unknown answers get "Couldn't check that, try again" with no pickaxe lost.
- [x] Rarity counts per layer in Redis, locked when the answer is given; one run per user per UTC day; 30-day TTL on per-day user data.
- [x] The client only ever receives cleared and current clues.
- [ ] Display rules (SPEC §4.1): public answer text is pool-only, AI-approved answers count but show as "something else", the player's own answers are always returned to them; non-pool answers logged per puzzle and layer with counts, readable by a moderator-only menu item. _Done except the menu item: the log is the non-pool members of `answers:{day}:{layer}`._
- [x] Approvals (22 Nov 2026): `generativelanguage.googleapis.com` fetch domain approved, Devvit LLM approval granted, paid-tier `geminiApiKey` set on the dev app.
- **Done when:** route and judge tests pass with a fake judge; an AI timeout breaks no pickaxe; a full run plays with no judge at all; a test shows an AI-approved answer counted in rarity but never named in another player's response; the real judge works in playtest. _All met except the last: confirm a non-pool answer gets a real Gemini verdict (not "unchecked") in playtest at the start of step 5._

### 5. Minimal playable client on Reddit — Thu 26 Nov (checkpoint)

- [x] Plain DOM: clue, input, pickaxes, result line, end summary and share text. No art. Plus a placeholder Phaser world (one rectangle per stratum, camera descends per layer, pull-back at the end), so later steps only add visuals.
- [ ] Full run playable end to end in `npm run dev` on desktop and the Reddit mobile app; resume after reload works. _Verified 22 Nov against the real `/api` routes with in-memory Redis and a fake judge, at phone size, keyboard-height and desktop: start, resume after reload, strike, reuse, empty, too long, wrong, cave-in, end screen, copy, already played. Not yet checked on Reddit itself (desktop or the mobile app)._
- **Done when:** you can play puzzle #14 on Reddit, cave in, come back and see "already played". **Go/no-go:** if this slips past Fri 27 Nov, cut step 7 to a static strata background.

### 6. Design direction (Hallmark) — Fri 27 Nov

- [x] Hallmark + frontend-design: palette per mineral, type, rock textures, HUD, motion rules, reduced-motion variants. _Written in `docs/DESIGN.md` and applied to the real client rather than a throwaway mock: patterned strata, bundled fonts, HUD, the recess with the core-sample chain, strike reveal with pacing, wrong-answer line, fossils, end screen. Checked locally at 390×780, 390×440 (keyboard) and desktop; screenshots of every state in `docs/screenshots/`; Hallmark finish review done. Not yet seen on Reddit. Waiting on your OK of the look._
- **Done when:** a written design direction in `docs/` and one static mock of play and end screens agreed. Nothing looks generic or AI-generated.

### 7. Dynamic world (Phaser) — Sat 28 – Sun 29 Nov

- [x] One continuous vertical cross-section; camera descends per layer; walls narrow; lighting darkens to a headlamp cone; Uranium glow at the bottom. _Built 22 Nov; see DESIGN §12._
- [x] Clues carved into the rock; earlier clues and answers stay above as a core sample; fossils of other players' pool answers (tap for %), with a screen-reader list.
- [x] DOM input stays over the canvas; no scroll traps. Desktop gets a side panel.
- _Checked locally at 320, 375 and 1440 wide against the real routes with a mock Redis. **Not yet checked on Reddit, or for 60fps on a real mid-range phone** (the local preview renders in software, so its frame rate says nothing). Do both before ticking the "Done when" below._
- **Done when:** a run plays fully in the world at 60fps on a mid-range phone, and it's usable with a keyboard and screen reader.

### 8. Juice: strike, ore, wrong answer, sound — Mon 30 Nov – Tue 1 Dec

- [ ] Strike: impact, shake, debris, chiselled answer, ore by band, transient score label, descend.
- [ ] Wrong: bounce, clink, crack, pickaxe snaps, reason shown, focus kept.
- [ ] Howler sounds (strike, clink, descend, Uranium hum), mute toggle, mute on hidden tab; `prefers-reduced-motion` respected.
- **Done when:** every SPEC §6.4, §6.5 and §6.8 item is visible on Reddit mobile and desktop.

### 9. End screen + community features — Wed 2 Dec

- [ ] Pull-back to the full core sample; hero mineral, total, rare finds, pickaxes left; full chain revealed; graveyard stats.
- [ ] Share text with copy button; post the result as a comment as the user; subreddit join button; streak flair.
- [ ] Already-played view with countdown to 00:00 UTC.
- **Done when:** SPEC §6.6 and §6.7 are complete, and flair and comments work in playtest.

### 10. Daily post, onboarding, Journeys, feed view — Thu 3 – Fri 4 Dec

- [ ] Scheduler job at 00:00 UTC creates "Unearth #N — <first clue>"; idempotent; verified to fire at UTC midnight.
- [ ] In-world first-run hints (SPEC §6.2).
- [ ] Journeys: run started, layer progress (layer/10), finished or caved in; no per-input events; receipts checked. Setup notes in DECISIONS "Journeys setup": the package's telemetry router is Express, our server is Hono; playtest versions always get `DENIED_PLAYTEST`, so check receipts on an uploaded version.
- [ ] Inline feed view: strata teaser, number, date, player count, first clue, Play. Under 1s, Lighthouse mobile above 80. Optional `_direct_launch`.
- **Done when:** a new post appears on its own at midnight UTC and the feed view meets the inline rules.

### 11. Polish, audits, compliance, submission — Sat 5 – Sun 6 Dec

- [ ] Accessibility, performance and Devvit-rules audits; data deletion on account deletion; README rewritten (non-template).
- [ ] Terms and Privacy published and linked in the app details form (Privacy names Gemini paid tier as the only processor of player answers); fetch domain approved; LLM approval granted, or the no-AI mode verified on the canonical app. _Domain and LLM approval granted 22 Nov for both the dev and canonical apps. Still to do: the app owner sets the canonical app's `geminiApiKey`._
- [ ] AI data audit (SPEC §5.3): the canonical app's `geminiApiKey` is from the billed project; no free-tier key exists in the project; no Reddit data reached any content-authoring AI session.
- [ ] Enough reviewed puzzles (written with `/write-puzzle`, reviewed by hand) queued to cover every day through judging (the judging window isn't in the briefing; aim for 31 Dec).
- [ ] Canonical app uploaded with `npm run deploy:prod` (upload only, **never publish**); public demo post live in r/UnearthDaily; demo video if required.
- **Done when:** a stranger can open the demo post on mobile, play, share and come back tomorrow, and every item in SPEC §1 is satisfied.
