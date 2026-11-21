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
- Each answer may be used **once per run**.
- **3 pickaxes** (lives). An invalid answer breaks one. Repeated or empty input does not.
- The run ends when layer 10 is cleared or all pickaxes are broken.
- **One run per Reddit user per UTC day**, resumable mid-run.

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

| Band        | Share    | Bonus         |
| ----------- | -------- | ------------- |
| Common      | over 20% | +0            |
| Seam        | 5–20%    | +25% of base  |
| Vein        | 1–5%     | +50% of base  |
| Mother Lode | under 1% | +100% of base |

- Bonus is rounded to the nearest integer.
- Rarity is **locked at the moment of answering** (later answers by other players don't change it).
- Boundaries: exactly 20% is Seam, exactly 5% is Seam, exactly 1% is Vein (each band includes its upper bound except Common).
- Layer 10 has a single answer and gets no rarity bonus.
- **Cold start:** until a layer has **50 valid answers**, use the puzzle file's commonness label (`common` → Common, `uncommon` → Seam, `rare` → Vein) and mark the result **"estimated"**. A valid answer not in the pool (accepted by the AI judge) defaults to **Vein (estimated)**.

### 3.3 Other scoring

- **+50 per unbroken pickaxe** at the end of a run.
- **Total** = Σ (base + rarity bonus) for each cleared layer + pickaxe bonus.
- **Streak** = consecutive UTC days with a finished run (cleared or caved in). Missing a UTC day resets it to 0.
- **Rare finds** = answers in the Vein or Mother Lode bands (estimated or not).

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
- **Offensive** answers are rejected (pickaxe breaks as for any invalid answer) and are **never displayed to other players** (not in fossils, stats or graveyard).
- The client never receives future clues or answer pools; all validation runs on the server.

### 4.1 Displaying answers

- Only **hand-reviewed pool answers** (their canonical form) are ever displayed as other players' fossils or named in public stats (fossil %, graveyard, any community counts). A valid answer that only the AI accepted is shown to others as "something else".
- **All valid answers** (pool and AI-approved) still count toward rarity percentages, the graveyard and totals. Only the displayed text is restricted.
- A player always sees **their own answer** in their own run, end screen and core sample, even if it isn't in the pool.
- **Non-pool valid answers are logged** per puzzle and layer with how often they were given, most frequent first, so they can be reviewed by hand and added to the pool later.

## 5. AI

There are two separate AI paths.

### 5.1 Offline content pipeline (OpenRouter)

- Runs on the developer's machine, using `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` from `.env` (gitignored).
- Drafts clue chains and per-layer answer pools, with **aliases** and a **commonness label** (`common` / `uncommon` / `rare`) for each answer.
- **Every puzzle is reviewed by hand** before it is committed to `content/puzzles/`.

### 5.2 Runtime judge (inside Devvit)

- Devvit only allows **OpenAI** and **Google Gemini** as AI providers, so OpenRouter cannot be called at runtime.
- Use a cheap **Gemini Flash / Flash-Lite-class** model via its allowlisted domain. The key is a **Devvit secret setting** (`geminiApiKey`).
- Behind an `AnswerJudge` interface so OpenAI can be swapped in.
- **Input:** all clues up to and including the current layer, plus the normalised answer.
- **Output:** strict JSON `{ valid, canonical, offensive, reason }`.
  - `canonical`: the canonical form of the answer (used for rarity grouping and reuse checks).
  - `reason`: under 8 words, player-facing and playful.
- Low temperature. The answer is treated strictly as **data** (prompt-injection safe): delimited, never interpreted as instructions; malformed output counts as an AI failure.

## 6. Experience flow

The world is **one continuous vertical cross-section of earth** that the camera descends through. **Not** a form in a card, **not** pill chips, **not** modal popups.

### 6.1 Feed / start view

- Strata-stack teaser, puzzle number, date, player count.
- The **first clue is readable before tapping** (it's the hook in the feed).
- A **Play** button.

### 6.2 First-run onboarding

Two in-world hints (not modals):

- "Every clue builds on the last"
- "Each answer can only be used once"

### 6.3 Play

- The current clue is **carved into the rock face**. Earlier clues and answers stay visible above as a **chained core sample**.
- The shaft walls **narrow** with each layer.
- Lighting **darkens with depth** to a headlamp cone; a green **Uranium glow** sits at the bottom.
- Other players' answers for cleared layers appear as **fossils** in the rock (tap for %).
- The answer input is a **real DOM input over the canvas** (mobile keyboards, accessibility).

### 6.4 Strike (correct answer)

- Pickaxe impact, screen shake, debris; the answer is **chiselled into the stratum**.
- Rarity appears as ore:
  - Common → dull rubble
  - Seam → a thin coloured seam
  - Vein → a bright cracked vein
  - Mother Lode → glowing ore that lights the walls
- A transient in-world label shows: mineral, base, band, bonus, "% of players", new total.
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

- "Discuss in comments" and a subreddit-join prompt.

### 6.7 Already played today

Show the end screen plus a **countdown to the next puzzle** (next 00:00 UTC).

### 6.8 Sound and motion

- Sounds: strike, clink, descend, Uranium hum. **Mute toggle**.
- Respect **`prefers-reduced-motion`** (no shake, shorter/no camera moves, same information).

## 7. Community and daily operations

- A **Devvit scheduler** job creates the daily post at **00:00 UTC**, titled **"Unearth #N — <first clue>"**.
- **Streak flair** on the subreddit (permissions to be verified; see DECISIONS.md).
- **Devvit Journeys** events: run started; layer progress (layer/10); finished or caved in. **No events for individual inputs.** Request journey approval early.

## 8. Tech

Confirmed or changed in [DECISIONS.md](DECISIONS.md).

- Devvit Web, TypeScript, started from the Phaser template.
- Phaser for the world, with a thin DOM overlay for HUD, input and end-screen lists.
- GSAP only if Phaser tweens aren't enough. Howler.js for sound.
- The template's server framework (Hono), routes under `/api/*`.
- Devvit Redis; Vitest.
- **The client never receives future clues or answer pools.**

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
|     8 | …whose name doesn't contain "orange" |
|     9 | …usually eaten peel and all          |
|    10 | single answer: **kumquat**           |
