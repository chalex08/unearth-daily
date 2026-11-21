---
name: write-puzzle
description: Write an UNEARTH daily puzzle draft (10-clue ladder, per-layer answer pools) for a given UTC date, check it with an independent critic subagent, and leave it in content/puzzles/drafts/ for human review. Use for "/write-puzzle", "write a puzzle", "draft tomorrow's puzzle".
argument-hint: <YYYY-MM-DD> [optional seed theme]
---

# Write an UNEARTH puzzle

Arguments: `$ARGUMENTS`. The first word is the date (`YYYY-MM-DD`, required; stop and ask if missing or malformed). Anything after it is an optional seed theme (a topic or a first clue).

## Data rule (SPEC §5.3), applies to you and every subagent

Read only SPEC.md, our own puzzle files and the seed theme. **Never** read `.env*`, Redis, the Reddit API, player answers, the non-pool answer log, answer counts, usernames or anything else from Reddit. If the user offers any of that, refuse and say why.

## Steps

### 1. Context and don't-repeat list

- Read `docs/SPEC.md` §2 (core loop), §4.1 and §5.1, and the `Puzzle` type and validator in `src/shared/puzzle.ts`.
- Run `npm run puzzle:taken`. It prints every puzzle and draft in `content/puzzles/` and `content/puzzles/drafts/` as `date  final answer  |  clue 1`. Do not reuse any final answer, the same theme (category of the final answer) or the same clue 1. Avoid a clue 1 used in the last 7 days even when the final answer differs.
- If `content/puzzles/drafts/<date>.json` already exists, ask before overwriting it.

### 2. Design backwards

1. **Final answer first.** A thing a normal adult anywhere in the English-speaking world would know and could spell: no niche trivia, brands, people or places that need specialist knowledge. It should be satisfying to reach ("oh, of course").
2. **Build the ladder from broad to narrow.** Clue 1 is a wide, friendly category ("Name something round"). Each later clue is a continuation written as `…that X` and adds **exactly one** constraint that is:
   - **clear and testable:** a stranger can answer yes or no for any candidate without looking it up;
   - **not subjective:** no "pretty", "popular", "fun", "big" without a measurable bar;
   - **not trivia:** no dates, records, statistics or facts most adults wouldn't know;
   - **single:** no "and", no two facts in one clue;
   - **under 8 words** (count them; clue 1 too).
3. **Every clue must remove a meaningful share of the pool** (roughly a third to two thirds at early layers; fewer at the end is fine as long as at least one goes). Sizes must shrink at every layer, and clue 10 must leave exactly one answer.
4. Letter, word-shape and spelling clues ("…whose name has one syllable") are allowed sparingly, at most two, and never as clue 10 unless nothing else works.

### 3. Pools

Write a **depth list** to `content/puzzles/drafts/<date>.ladder.json` (gitignored):

```json
{
  "clues": [
    "Name something round",
    "…that you can hold in one hand",
    "... 10 clues"
  ],
  "answers": [
    {
      "canonical": "golf ball",
      "aliases": ["golf balls", "golfball"],
      "commonness": "uncommon",
      "depth": 10
    },
    {
      "canonical": "orange",
      "aliases": ["oranges"],
      "commonness": "common",
      "depth": 4
    }
  ]
}
```

`depth` is the deepest layer the answer still satisfies (it is valid at layers 1..depth). `npm run puzzle:build -- <date>` expands this into one pool per layer, so the "answer at N is valid at 1..N" rule holds by construction.

- **Layer 1 holds 100+ answers.** Start with the obvious ones players will type first (brainstorm what ten different people would say in five seconds), then the long tail.
- **Every layer, especially 1–3, includes its obvious answers.** Pool hits need no AI; until LLM approval anything not in the pool gets "Couldn't check that, try again".
- `canonical`: lowercase, the most common name. `aliases`: plurals, hyphenation and spacing variants (`golfball`, `golf-ball`), common spellings and misspellings, US/UK spellings, short forms people really type. Never an alias that is itself a different valid answer.
- **Variants of one thing are aliases, not separate answers** (`tennis ball` vs `tennis balls`; `mandarin` vs `mandarin orange`). Genuinely different things stay separate (`tangerine` and `clementine` are both fine if players would see them as different).
- `commonness`: `common` for what many players will type first, `uncommon` for reasonable but less obvious, `rare` for valid but surprising. Expect roughly 25% / 45% / 30% at layer 1.

### 4. Self-check every layer

Go layer by layer, before building:

- Every answer with `depth >= N` truly satisfies **all** clues 1..N. Read each one against each clue; when in doubt about a borderline answer, lower its depth (or drop it) rather than argue.
- Every answer with `depth == N-1` truly fails clue N (otherwise its depth is wrong).
- No clue removes nothing; sizes shrink steadily; layer 10 has exactly one answer.

Then run `npm run puzzle:build -- <date>`. It writes `drafts/<date>.json` and prints each layer's size; it fails on validator errors, bad depths and clues that remove nothing, and warns when layer 1 has fewer than 100 answers. Fix and rerun until it passes with no warning.

### 5. Independent critic (fresh context)

Spawn a subagent with the Agent tool (`subagent_type: "general-purpose"`, not a fork, so it has none of this context). Give it **only the 10 clues** (no pools, no intended answer, no file paths) and this brief:

> You are checking a word-ladder puzzle. Each clue narrows the previous ones: an answer at layer N must satisfy clues 1..N. Do not read any files or use any tools; answer from your own knowledge.
>
> Clues: (1) … (10) …
>
> 1. List **every** answer you can find that satisfies all 10 clues. Try hard to find more than one; for each, say why it fits.
> 2. For layers 1, 2 and 3, list the 30 most obvious answers a typical player would type first (satisfying clues 1..N).
> 3. Flag any clue that is subjective, needs trivia, holds two constraints, or that a player could reasonably read two ways.

Then:

- If it finds a second answer that really satisfies all 10 clues, change the ladder (a sharper clue, or a different clue 10), rebuild, and run a **new** critic (fresh agent again, never one that has seen the old version). Repeat until the final layer has one answer. If you judge its second answer wrong, note it in the review file.
- Add every obvious answer it lists that is missing from the pools, at the right depth. Rebuild.
- Fix clear-cut clue problems it flags; leave real judgement calls for the review file.

### 6. Outputs

- `content/puzzles/drafts/<date>.json`: written by `npm run puzzle:build`; it must pass. Never hand-edit it; edit the ladder and rebuild.
- Delete `drafts/<date>.ladder.json` once the final build passes (it is gitignored, but the JSON is now the source of truth).
- `content/puzzles/drafts/<date>.review.md`: **only** the judgement calls the reviewer should check, each one line, for example a borderline answer and the depth you chose, a clue a player might read two ways, a critic objection you rejected and why, a commonness label you were unsure of. No summary of the puzzle, no list of what passed. If there are none, write `No judgement calls.`
- Reply with the date, the clue ladder with pool sizes (from the build output), the final answer, the critic rounds it took, and the next step: `npm run review -- <date>`.

Do not commit, and do not move the draft into `content/puzzles/`: approving is the reviewer's job.
