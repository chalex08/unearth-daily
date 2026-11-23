---
name: write-puzzle
description: Write an UNEARTH daily puzzle draft (10-clue ladder, per-layer answer pools funnelling from 500+ answers to 5-10) for a given UTC date, check it with an independent critic subagent, and leave it in content/puzzles/drafts/ for human review. Use for "/write-puzzle", "write a puzzle", "draft tomorrow's puzzle".
argument-hint: <YYYY-MM-DD> [optional seed theme]
---

# Write an UNEARTH puzzle

Arguments: `$ARGUMENTS`. The first word is the date (`YYYY-MM-DD`, required; stop and ask if missing or malformed). Anything after it is an optional seed theme (a topic or a first clue).

## Data rule (SPEC §5.3), applies to you and every subagent

Read only SPEC.md, our own puzzle files and the seed theme. **Never** read `.env*`, Redis, the Reddit API, player answers, the non-pool answer log, answer counts, usernames or anything else from Reddit. If the user offers any of that, refuse and say why.

## The shape of a puzzle (SPEC §2)

Most players are casual, so a puzzle is a **funnel of answers anyone can give**, not a hunt for something obscure:

- **Layer 1 has 500 or more** valid answers. **Layer 10 has 5 to 10.**
- **Each layer keeps 35% to 85%** of the layer above. A good run is about 520, 330, 200, 125, 75, 47, 29, 18, 11, 7. `npm run puzzle:build` fails if a layer is outside these bounds.
- **Every answer is familiar to an average adult.** Later clues are more _specific_, never more _obscure_. The pool is long at layer 1 because the category is wide, not because it is full of rarities.
- A valid answer at layer N must satisfy clues 1..N, and each later pool is a subset of the one above.

## Steps

### 1. Context and don't-repeat list

- Read `docs/SPEC.md` §2 (core loop and funnel), §4.1 and §5.1, and the `Puzzle` type, `validatePuzzle` and `poolShapeErrors` in `src/shared/puzzle.ts`.
- Run `npm run puzzle:taken`. It prints every puzzle and draft as `date  an example final answer  |  clue 1`. Do not reuse the same clue 1 or the same theme (category) as any of them, and avoid a clue 1 used in the last 7 days even when the ending differs.
- If `content/puzzles/drafts/<date>.json` already exists, ask before overwriting it.

### 2. Design

1. **Pick a clue 1 whose category holds 500 real, everyday answers** ("Name an animal", "Name a food", "Name a city", "Name a sport or game", "Name a drink"). If you can't honestly list 500 answers a typical adult would recognise, widen the category (a capital city becomes a city; a chemical element, which has only 118, becomes a drink).
2. **Plan the funnel from the inside out.** Choose the final 5 to 10 answers first: real, familiar things that satisfy every clue. Then decide which clue lets each group of answers drop out. That gives the groups to write in step 3.
3. **Each later clue is `…that X`** and adds **exactly one** constraint that is:
   - **clear and checkable:** anyone who knows a candidate can say yes or no for it. Prefer a clear category or a plain fact ("has a backbone", "is a mammal", "lives in Africa", "is a boot", "contains alcohol", "is in the Northern Hemisphere");
   - **not subjective:** no "pretty", "popular", "fun", "big" without a measurable bar;
   - **no dates, records or statistics:** "invented before 1850", "the fastest" are out;
   - **single:** no "and", no two facts in one clue;
   - **under 8 words** (count them; clue 1 too).
4. **Every clue removes a steady share.** Roughly a third to two thirds of the pool at early layers, less at the end, and never nothing. The build step enforces 15% to 65% removed per layer.
5. **The last two clues may be about the name** ("…whose name is one word", "…with fewer than nine letters") when no clean fact leaves the right handful. These are easy for players to check and are a good way to land a final group of 5 to 10. Use at most two of them, and only at layers 8 to 10.
6. **No made-up, disputed or offensive answers, no brand names, no living people.** Everything must be real and checkable against all 10 clues.

### 3. Pools

Write a **compact depth list** to `content/puzzles/drafts/<date>.ladder.txt` (gitignored). `depth` is the deepest layer an answer still satisfies, so a section `== 6` holds the answers valid at layers 1..6 that **fail clue 7**.

```text
# comments start with #
1: Name an animal
2: …that has a backbone
...
10: …with white markings on its face

== 10
springbok
gemsbok = oryx
sable antelope = sable
== 9
common eland = eland, cape eland
red hartebeest = hartebeest ~
== 1
sea star = starfish ~
tardigrade = water bear !
```

- One answer per line: `canonical [= alias, alias] [~|!]`. No mark means `common`, a trailing `~` is `uncommon`, `!` is `rare`.
- **Write the deepest group first and work outwards.** Order inside a group is free, except that the **first answer in `== 10` is shown as the example final answer**, so put the most recognisable one first.
- **Don't write plain plurals.** `npm run puzzle:build` adds `s` / `es` / `ies` as an alias unless another answer already owns that spelling. Write only irregular plurals (`mouse = mice`), spelling variants (`ladybug = ladybird`), short forms people really type, and `&` / `and` variants.
- **Variants of one thing are aliases, not separate answers** (`tennis ball` vs `tennis balls`). Genuinely different things stay separate. Never give an alias that is itself a different valid answer (the build reports a collision).
- **Generic names belong at the deepest layer they are valid.** `elephant` is valid at "lives in Africa", so it goes there, and `asian elephant` is its own answer one group up. Otherwise the alias `elephant` would match two answers.
- **Include the obvious answers at every layer.** Pool hits need no AI call and are the only answers shown to other players; when the AI judge is unavailable, anything not in the pool gets "Couldn't check that, try again". Brainstorm what ten different people would say in five seconds first, then the long tail.
- **Don't pad.** Every entry must be a real thing a player could type. If you are short of 500 at layer 1, widen the category or add real answers; never invent variants to hit a number.
- `commonness`: `common` for what many players type first, `uncommon` for reasonable but less obvious, `rare` for valid but surprising. It only matters until a layer has 50 answers, but keep it honest.

### 4. Self-check every layer

Run `npm run puzzle:build -- <date>`. It writes `drafts/<date>.json`, prints each layer's size and fails on validator errors, bad depths, clues that remove nothing, and sizes outside the funnel. Fix and rerun until it passes with no errors.

Then read the groups against the clues:

- Every answer with `depth >= N` truly satisfies **all** clues 1..N. Read each against each clue; when in doubt about a borderline answer, lower its depth (or drop it) rather than argue. A borderline answer at a lower depth is safe: it simply isn't guaranteed at the deeper layer.
- Every answer with `depth == N-1` truly fails clue N (otherwise its depth is wrong).
- Nothing is misfiled by category (a non-capital in the capital group, an alcoholic drink in the non-alcoholic group).
- The final group of 5 to 10 is made of things most adults would recognise.

### 5. Independent critic (fresh context)

Spawn a subagent with the Agent tool (`subagent_type: "general-purpose"`, not a fork, so it has none of this context). Give it **only the 10 clues** (no pools, no intended answer, no file paths) and this brief:

> You are checking a word-ladder puzzle. Each clue narrows the previous ones: an answer at layer N must satisfy clues 1..N. Do not read any files or use any tools; answer from your own knowledge.
>
> Clues: (1) … (10) …
>
> 1. List **every** answer you can find that satisfies all 10 clues. Say why each fits.
> 2. For layers 1, 2 and 3, list the 40 most obvious answers a typical player would type first (satisfying clues 1..N).
> 3. For layers 5, 7 and 9, list every answer you can think of.
> 4. Flag any clue that is subjective, relies on dates, records or statistics, holds two constraints, or that a player could reasonably read two ways.
> 5. Say whether an average adult would recognise the layer-10 answers.

Then:

- The final layer must hold **5 to 10** answers. If the critic finds a real answer to all 10 clues that is missing, add it (up to 10). If it finds more than 10, or you judge the final set too big, sharpen a late clue, rebuild, and run a **new** critic (fresh agent again, never one that has seen the old version).
- Add every obvious answer it lists that is missing from the pools, at the right depth. Rebuild.
- If it says most adults wouldn't recognise the layer-10 answers, rework the late clues so the final group is familiar.
- Fix clear-cut clue problems it flags; leave real judgement calls for the review file.

### 6. Outputs

- `content/puzzles/drafts/<date>.json`: written by `npm run puzzle:build`; it must pass. Never hand-edit it; edit the ladder and rebuild.
- Delete `drafts/<date>.ladder.txt` once the final build passes (it is gitignored, but the JSON is now the source of truth).
- `content/puzzles/drafts/<date>.review.md`: **only** the judgement calls the reviewer should check, each one line, for example a borderline answer and the depth you chose, a clue a player might read two ways, a critic objection you rejected and why, a commonness label you were unsure of. No summary of the puzzle, no list of what passed. If there are none, write `No judgement calls.`
- Reply with the date, the clue ladder with pool sizes (from the build output), the final answers, the critic rounds it took, and the next step: `npm run review -- <date>`.

Do not commit, and do not move the draft into `content/puzzles/`: approving is the reviewer's job.
