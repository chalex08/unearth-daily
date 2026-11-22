# UNEARTH — Game Spec

This is the source of truth for what UNEARTH is and how it behaves. Code follows this file. To change behaviour, change this file first (in the same PR), never silently diverge.

Platform facts referenced here were checked against the Devvit docs on 21 Nov 2026; see [DECISIONS.md](DECISIONS.md) for the tech choices and anything still unverified.

## 1. Hackathon constraints

- **Deadline:** Tue 8 Dec 2026, 6:00pm PT (= Wed 9 Dec 2026, ~1:00pm Sydney / 02:00 UTC 9 Dec). Internal target: submission-ready by Sun 6 Dec.
- Runs on Reddit via **Devvit Web**.
- Judged from a **public demo post** in a **public test subreddit with fewer than 200 members**.
- **Upload only, never publish.** Must comply with the Devvit Rules.
- External fetch only to **allowlisted domains**, and the app needs **Terms** and **Privacy** pages.
- Judging: four equally weighted criteria — **Delightful UX**, **Polish**, **Reddit-y**, **Daily Content**.
- Bonus credit for **Devvit Journeys**, **streaks**, **flair** and **comments**.
- Must **not look AI-generated**.

## 2. Core loop

- One shared puzzle per **UTC day**: a chain of **10 clues**.
- Clue 1 is broad. Each later clue adds a constraint, so an answer at layer N must satisfy clues 1..N.
- Clue 10 has **exactly one** valid answer.
- **Answers get nicher with depth.** Early layers are full of everyday answers; by layers 7–9 most survivors are things only enthusiasts know; the layer-10 answer is **niche**: real and checkable, but unknown to most adults.
- Each answer may be used **once per run**.
- **Puzzle number** = UTC days since the launch day **2026-11-08** + 1 (2026-11-21 is #14). Each puzzle file's `number` must match; a test checks every bundled file.
- **3 pickaxes** (lives). An invalid answer breaks one. Repeated or empty input does not.
- The run ends when layer 10 is cleared or all pickaxes are broken.
- **One run per Reddit user per UTC day**, resumable mid-run.
- Each daily post belongs to its UTC day. A run in progress at 00:00 UTC finishes on its original puzzle; a past day's post never starts a new run.

## 3. Scoring

### 3.1 Mineral tiers

Rank = deepest layer cleared.

| Layer | Mineral | Base points | Share emoji |
| ----: | ------- | ----------: | :---------: |
|     0 | Surface |           0 |     🌱      |
|     1 | Dirt    |          10 |     🟫      |
|     2 | Clay    |          20 |     🟧      |
|     3 | Stone   |          30 |     🪨      |
|     4 | Coal    |          50 |     ⬛      |
|     5 | Copper  |          75 |     🟠      |
|     6 | Iron    |         100 |     🔩      |
|     7 | Silver  |         150 |     🥈      |
|     8 | Gold    |         200 |     🥇      |
|     9 | Diamond |         300 |     💎      |
|    10 | Uranium |         500 |     ☢️      |

### 3.2 Rarity bonus (layers 1–9)

**Share** = valid answers at that layer with the same canonical answer ÷ all valid answers at that layer today.

Five bands, named for how much of a find it was, each bigger and more joined-up than the last: loose bits, one chunk, a cluster, a line, the whole deposit. They describe the find, never the layer, so none is a mineral name.

| Band        | Rarity     | Share    | Bonus         | Colour | Text glow |
| ----------- | ---------- | -------- | ------------- | ------ | --------- |
| Rubble      | Everywhere | over 25% | +0            | grey   | none      |
| Nugget      | Plenty     | 10–25%   | +25% of base  | orange | a little  |
| Pocket      | Scarce     | 4–10%    | +50% of base  | blue   | more      |
| Vein        | Hidden     | 1–4%     | +100% of base | purple | more      |
| Mother Lode | Fabled     | under 1% | +200% of base | gold   | the most  |

- Bonus is rounded to the nearest integer.
- Rarity is **locked at the moment of answering** (later answers by other players don't change it).
- Boundaries: each band includes its upper bound except Rubble (exactly 25% is Nugget, 10% is Nugget, 4% is Pocket, 1% is Vein).
- Layer 10 has a single answer and gets no rarity bonus.
- Band colours say how rare the find was. They never paint the rock: stratum ore colours say which layer you are in.
- **Cold start:** until a layer has **50 valid answers**, use the puzzle file's commonness label (`common` → Rubble, `uncommon` → Nugget, `rare` → Pocket) and mark the result **"estimated"**. A valid answer not in the pool (accepted by the AI judge) defaults to **Pocket (estimated)**.

### 3.3 Other scoring

- **+50 per unbroken pickaxe** at the end of a run.
- **Total** = Σ (base + rarity bonus) for each cleared layer + pickaxe bonus.
- **Streak** = consecutive UTC days with a finished run (cleared or caved in). Missing a UTC day resets it to 0.
- **Rare finds** = answers in the Pocket, Vein or Mother Lode bands (estimated or not).

Worked example (the share text in §6.6): caved in at Gold with all 3 pickaxes broken = 635 base (10+20+30+50+75+100+150+200) + 218 rarity bonus + 0 pickaxe bonus = 853.

## 4. Answer validation

Pipeline, in order, stopping at the first decision:

1. **Normalise:** lowercase, trim, collapse internal whitespace to one space, strip punctuation, max **40 characters** (longer input is rejected as invalid input, no penalty).
2. **Empty** after normalising → ignored, no penalty.
3. **Reuse** within this run → rejected, **no penalty**.
4. **Pool lookup:** the puzzle's layer pool and aliases for the current layer (no AI). Hit → valid, with the pool's canonical answer and commonness.
5. **Verdict cache** in Redis, keyed by puzzle, layer and normalised answer. Hit → use the cached verdict.
6. **Runtime AI judge** (§5.2). Only reached on a cache miss.
7. **Cache every AI verdict.**

Failure handling:

- AI error or timeout (~**8s**): show **"Couldn't check that, try again"**, break **no** pickaxe, cache nothing.
- **AI not available** (Devvit LLM approval not granted yet, or no runtime key set, §5.3): an answer that misses the pool and the verdict cache gets the same **"Couldn't check that, try again"**, breaks **no** pickaxe and caches nothing. The game must be fully playable this way: pool answers validate with no AI at all.
- **Offensive** answers are rejected (pickaxe breaks as for any invalid answer) and are **never displayed to other players** (not in fossils, stats or graveyard).
- The client never receives future clues or answer pools; all validation runs on the server.

### 4.1 Displaying answers

- Only **hand-reviewed pool answers** (their canonical form) are ever displayed as other players' fossils or named in public stats (fossil %, graveyard, any community counts). A valid answer that only the AI accepted is shown to others as "something else".
- **All valid answers** (pool and AI-approved) still count toward rarity percentages, the graveyard and totals. Only the displayed text is restricted.
- A player always sees **their own answer** in their own run, end screen and core sample, even if it isn't in the pool.
- **Non-pool valid answers are logged** per puzzle and layer with how often they were given, most frequent first (the members of `answers:{day}:{layer}` that aren't pool canonicals, §8.1), so they can be reviewed by hand and added to the pool later. Reviewing this log is manual or uses the paid key only (§5.3).

## 5. AI

There are two separate AI uses. Only the runtime judge calls an AI API; puzzles are written in a Claude Code session on the developer's machine.

### 5.1 Puzzle authoring (Claude Code, offline)

- Puzzles are written by Claude in a Claude Code session with the project skill `/write-puzzle` (`.claude/skills/write-puzzle/`). No API key and no Gemini call is involved.
- **Input is only optional hand-written seed themes and our own puzzle files.** Never Reddit data (§5.3).
- Produces the 10-clue chain and per-layer answer pools, with **aliases** and a **commonness label** (`common` / `uncommon` / `rare`) for each answer, as a draft in `content/puzzles/drafts/`.
- **Every puzzle is reviewed by hand** before it is committed to `content/puzzles/`.

### 5.2 Runtime judge (inside Devvit, Gemini paid tier)

- Devvit only allows **OpenAI** and **Google Gemini** as AI providers.
- Use a cheap **Gemini Flash / Flash-Lite-class** model via its allowlisted domain. The key comes from a **separate Google project with billing enabled** (Gemini API paid tier) and is stored only as a **Devvit secret setting** (`geminiApiKey`).
- Behind an `AnswerJudge` interface so OpenAI can be swapped in.
- **Input:** all clues up to and including the current layer, plus the normalised answer.
- **Output:** strict JSON `{ valid, canonical, offensive, reason }`.
  - `canonical`: the canonical form of the answer (used for rarity grouping and reuse checks).
  - `reason`: under 8 words, player-facing and playful.
- Low temperature. The answer is treated strictly as **data** (prompt-injection safe): delimited, never interpreted as instructions; malformed output counts as an AI failure.

### 5.3 Data rules (hard rules)

Devvit Rules forbid using Reddit data to train or improve AI models, or letting third parties do so. Gemini's free tier may use submitted content to improve Google's products; the paid tier does not. So Reddit-derived data only ever reaches the paid-tier runtime judge.

- **No AI tool or session used for content may ever receive Reddit data of any kind**: player answers, the §4.1 non-pool answer log, answer counts, usernames, or anything read from Redis or the Reddit API. Content sessions may only read hand-written seed themes and our own puzzle files.
- The **paid-tier key is the only key the Devvit server may use.** It must come from a billed Google project, never a free-tier one. No free-tier Gemini key is used anywhere in the project.
- Reviewing the §4.1 non-pool answer log and adding answers to pools is **manual only**.
- Devvit requires **prior approval for LLM use** (granted 22 Nov 2026). Play must still never depend on AI: when the judge can't be reached, the game must fully work: pool answers validate without AI, and unknown answers get "Couldn't check that, try again" with no pickaxe lost (§4).

## 6. Experience flow

The world is **one continuous vertical cross-section of earth** that the camera descends through. **Not** a form in a card, **not** pill chips, **not** modal popups.

### 6.1 Feed / start view

- Strata-stack teaser, puzzle number, date, player count (runs started on this puzzle).
- The **first clue is readable before tapping** (it's the hook in the feed).
- A **Play** button.

### 6.2 First-run onboarding

Two in-world hints (not modals):

- "Every clue builds on the last"
- "Each answer can only be used once"

Shown under the clue until the player dismisses them ("Got it"), then never again for that player.

### 6.3 Play

- The current clue is **carved into the rock face**. Earlier clues and answers stay visible above as a **chained core sample**.
- The shaft walls **narrow** with each layer.
- Lighting **darkens with depth** to a headlamp cone; a green **Uranium glow** sits at the bottom.
- Other players' answers for cleared layers appear as **fossils** in the rock (tap for %). While the run is still going, any fossil that is also valid at the current layer shows as "something else": pools nest, so naming it would give away an answer for the current or a deeper layer. Once the run ends, all pool fossils are named.
- The answer input is a **real DOM input over the canvas** (mobile keyboards, accessibility).

### 6.4 Strike (correct answer)

- Pickaxe impact, screen shake, debris; the answer is **chiselled into the stratum**.
- Rarity appears as ore in the rock:
  - Rubble → dull rubble
  - Nugget → one glinting chunk
  - Pocket → a small cluster of glinting chunks
  - Vein → a bright cracked vein
  - Mother Lode → glowing ore that lights the walls
- A transient in-world label shows: mineral, base, band, bonus, "% of players", new total.
- The reveal names the **band** in its band colour, with glow growing from none (Rubble) to the most (Mother Lode). Directly under the band name: the **rarity** in plain words (Everywhere, Plenty, Scarce, Hidden, Fabled) and the **points** scored for that layer (base plus bonus).
- The camera then descends.

### 6.5 Wrong answer

- The word bounces off with a clink, the rock cracks, a HUD pickaxe snaps, and the short reason appears.
- Input stays focused. Playful, not punishing.

### 6.6 End of run

- The camera pulls back to show the **whole core sample**.
- Hero mineral, total points, rare finds, pickaxes left.
- The **full chain revealed**: your answers and bands, unreached clues, and the final answer.
- **Graveyard:** runs ended per mineral; players reaching each mineral.
- Spoiler-free **share text** with a copy button:

  ```
  Unearth #14 — 🥇 Gold · 853 pts
  🟫🟧🪨⬛🟠🔩🥈🥇
  ✨ 3 rare finds · 💥💥💥
  ```

  - Line 1: puzzle number, hero mineral emoji and name, total points.
  - Line 2: one emoji per layer cleared (Surface 🌱 alone if none cleared).
  - Line 3: rare finds count, then one 💥 per **broken** pickaxe.

- "You dug deeper than X% of today's other diggers" (finished runs that ended shallower ÷ all other finished runs today).
- "Discuss in comments" (posts the share text as the player under the app's stickied comment, one explicit press) and a subreddit-join prompt shown once, after the player's first finished run.
- Streak on the end screen; an opt-in button sets streak and best-mineral flair.
- Each failed attempt is listed under its layer in the chain.

### 6.7 Already played today

Show the end screen plus a **countdown to the next puzzle** (next 00:00 UTC).

### 6.8 Sound and motion

- Sounds: strike, clink, descend, Uranium hum. **Mute toggle**.
- Respect **`prefers-reduced-motion`** (no shake, shorter/no camera moves, same information).

## 7. Community and daily operations

- A **Devvit scheduler** job creates the daily post at **00:00 UTC**, titled **"Unearth #N — <first clue>"**, pinned in sticky slot 1, with the stickied comment for shared results. Idempotent: one post per UTC day. Moderators can run it by hand from the subreddit menu ("Create today's Unearth post").
- **Streak flair** on the subreddit, set only when the player presses the end-screen flair button (DECISIONS "Step 9").
- **Devvit Journeys** events: run started; layer progress (layer/10); finished or caved in. **No events for individual inputs.** Journeys are gated by Reddit's server-side allowlist; events only record on an allowlisted, non-playtest version (DECISIONS "Journeys setup").

## 8. Tech

Confirmed or changed in [DECISIONS.md](DECISIONS.md).

- Devvit Web, TypeScript, started from the Phaser template.
- Phaser for the world, with a thin DOM overlay for HUD, input and end-screen lists.
- GSAP only if Phaser tweens aren't enough. Howler.js for sound.
- The template's server framework (Hono), routes under `/api/*`.
- Devvit Redis; Vitest.
- **The client never receives future clues or answer pools.**

### 8.1 Server API and Redis

Routes (types in `src/shared/api.ts`; all but `/feed` need a logged-in user, and all need a puzzle for the post's day: `postData.day` on daily posts, else today):

| Route                 | Returns                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/start`     | Starts or resumes the run for this post's day (new runs only on today's post, else 410): current clue, chain so far, lives, score, onboarding flag (true until the hints are dismissed). |
| `POST /api/onboarded` | Marks the first-run hints dismissed.                                                                                                                                                     |
| `GET /api/feed`       | Feed view: puzzle number, date, clue 1, player count, closed (a past day's post).                                                                                                        |
| `POST /api/answer`    | `{ answer, layer }` → `AnswerResult`. A `layer` that isn't the current one, or a second submit while one is being checked, gets 409 and changes nothing.                                 |
| `GET /api/result`     | End-screen payload with the full chain and final answer. 409 until the run has ended.                                                                                                    |
| `GET /api/stats`      | Players, graveyard, players reaching each mineral, and fossils only for layers this player has cleared (§4.1 display rules; mid-run hiding in §6.3).                                     |
| `POST /api/comment`   | Posts the share text as the player (`runAs: USER`), a reply to the app's stickied comment on the post. Once per run; 409 until the run has ended.                                        |
| `POST /api/subscribe` | Joins the subreddit as the player. 409 until the run has ended.                                                                                                                          |
| `POST /api/flair`     | Sets the player's flair to `🔥 <streak> · <emoji> <best mineral>`. 409 until the run has ended.                                                                                          |

Redis keys (`src/server/core/keys.ts`). `{day}` is the UTC day key, `{userId}` the Reddit `t2_` id (never the username). Every key gets a **30-day** TTL, refreshed on write, except the lock.

| Key                      | Type       | Holds                                                                                                                      |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| `run:{day}:{userId}`     | hash       | `state`: the RunState JSON. Created with `HSETNX`, so one run per user per day. `journey`: the Journeys id.                |
| `lock:{day}:{userId}`    | counter    | Submit lock, 15s TTL, deleted when the submit finishes.                                                                    |
| `answers:{day}:{layer}`  | sorted set | Canonical answer → valid answers at that layer (pool and AI-approved).                                                     |
| `totals:{day}`           | hash       | Layer → all valid answers at that layer (the rarity denominator).                                                          |
| `ends:{day}`             | hash       | Mineral (deepest layer cleared, 0–10) → runs that ended there (graveyard).                                                 |
| `reached:{day}`          | hash       | Mineral → players who reached it; `0` = runs started (the player count).                                                   |
| `verdicts:{day}:{layer}` | hash       | Normalised answer → cached judge verdict JSON. Failures are never cached.                                                  |
| `user:{userId}`          | hash       | `count`, `lastDay`: the streak; `best`: deepest mineral ever; `prompted`: join prompt shown; `onboarded`: hints dismissed. |
| `daily:{day}`            | hash       | `post`: the day's post id (`creating` for up to 120s while it's made). One post per day.                                   |
| `sticky:{postId}`        | hash       | `id`: the app's stickied comment that shared results reply to.                                                             |

## 9. Sample puzzle #14

Used in tests and seed data.

| Layer | Clue                                 |
| ----: | ------------------------------------ |
|     1 | Name something orange                |
|     2 | …that you can eat                    |
|     3 | …that grows on a plant               |
|     4 | …that's a fruit                      |
|     5 | …that grows on a tree                |
|     6 | …that's a citrus fruit               |
|     7 | …smaller than a tennis ball          |
|     8 | …whose name has no letter E          |
|     9 | …not usually eaten raw               |
|    10 | …mostly grown in Italy: **chinotto** |
