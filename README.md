# Unearth

**A daily word puzzle you dig into, inside a Reddit post.** Every day there is one new puzzle, the same for everyone: a chain of ten clues. Each clue narrows the last, and you answer each one to dig a layer deeper, from Dirt down to Uranium. The rarer your answer, the more it is worth.

Unearth runs on [Reddit's Developer Platform (Devvit)](https://developers.reddit.com/docs). It is for anyone on Reddit who likes a quick daily puzzle (Wordle, Connections, crosswords) and comparing notes with other players afterwards. A run takes three to five minutes.

[Play it in r/UnearthDaily](https://www.reddit.com/r/UnearthDaily/) · [Terms](https://chalex08.github.io/unearth-daily/terms.html) · [Privacy](https://chalex08.github.io/unearth-daily/privacy.html)

## How to play

1. Open today's post. The first clue is on the card, for example _Name something orange_. Press **Play**.
2. Type an answer that fits the clue and press **Dig**. _Carrot_ works.
3. The next clue adds a constraint: _…that you can eat_. Your answer must now fit **every** clue so far. Carrot still works, but you can't use it twice: each answer only once per run.
4. Keep going. By layer 9 only a handful of answers fit; layer 10 has exactly one (for that puzzle: _chinotto_, a bitter Italian citrus).
5. You have **3 pickaxes**. A wrong answer breaks one. Typing the same thing twice, or nothing, costs nothing. Lose all three and the tunnel caves in.

### Scoring

- Each layer is a mineral worth more the deeper it is: Dirt 10 points, Clay 20, Stone 30, Coal 50, Copper 75, Iron 100, Silver 150, Gold 200, Diamond 300, Uranium 500.
- **Rarity bonus:** how many of today's players gave the same answer at that layer. Everyday answers are _Rubble_ (no bonus); rarer ones are a _Nugget_ (+25%), a _Pocket_ (+50%), a _Vein_ (+100%) or the _Mother Lode_ (+200%). Rarity is fixed the moment you answer.
- +50 for every pickaxe still whole at the end.

## Features

- **One shared puzzle a day**, posted automatically at 00:00 UTC as _Unearth #N — first clue_, pinned in the subreddit.
- **A world, not a form.** The run is one continuous cross-section of earth. The camera descends as you dig, the shaft narrows, the light fades to a headlamp, and a green Uranium glow waits at the bottom. Your answers are chiselled into the rock as a core sample.
- **Strikes you can feel:** impact, shake, debris and ore in the rock that shows the rarity, from dull rubble to a glowing Mother Lode. Wrong answers bounce off with a clink.
- **Fossils:** other players' answers for layers you have cleared appear in the rock. Tap one to see what share of players gave it.
- **End screen:** the full chain revealed, your score, rare finds, the day's graveyard (where everyone stopped) and how you compare.
- **Spoiler-free share text** with one-tap copy, and an optional button to post it in the comments as yourself.
- **Streaks**, and optional subreddit flair showing your streak and deepest mineral.
- **Resume anywhere:** close the post mid-run and pick up where you left off, on any device.
- **Accessible:** a real text input (works with every phone keyboard), full keyboard and screen-reader support, sound with a mute button, and a calmer version when your device asks for reduced motion.

## How answers are checked

Every puzzle is written and checked by hand, with a list of accepted answers for each layer. Most answers are matched against that list instantly. If you type something real that isn't on the list, Unearth asks Google Gemini whether it fits the clues, and remembers the verdict so the same answer is never checked twice. If Gemini can't be reached, you see _Couldn't check that, try again_ and lose nothing.

Other players only ever see answers from the hand-written list. Anything else you type is shown only to you.

## For moderators

Install the app in your subreddit. It creates and pins the day's post at 00:00 UTC on its own. If a post is missing, open the subreddit menu and choose **Create today's Unearth post**; it never makes two in a day. The menu items marked _(dev)_ are for development installs and do nothing on the main app.

The app needs mod permission to pin posts, distinguish its own pinned comment, and set user flair.

## Fetch Domains

The app requests permission to fetch:

- `generativelanguage.googleapis.com`: the Google Gemini API (paid tier), used only to check answers that aren't in the day's hand-written answer list. It receives the day's clues up to the current layer and the player's answer (lowercased, at most 40 characters). No usernames, user IDs or other Reddit data are sent. Google does not use paid-tier requests to train its models.

## Data

The app stores each player's run, streak and a few settings in Devvit Redis, keyed by Reddit user ID (never username), plus anonymous answer counts. Everything expires 30 days after it was last written. Full details in the [privacy policy](https://chalex08.github.io/unearth-daily/privacy.html) (source: [`site/privacy.html`](site/privacy.html)).

---

## How it was built, and why

**Built for Reddit's daily-game format.** A daily puzzle works on Reddit because the comments are the conversation everyone wants after a Wordle. So the post is the game, the share text goes in the comments as you, and the stats are about _today's_ players.

**A chain of clues instead of a single guess.** Each answer has to satisfy every clue so far, so the puzzle gets harder as the possible answers run out, and the deepest layers reward people who know odd things. Scoring by rarity means there is no single right path: an obscure answer at layer 3 can outscore a common one at layer 5.

**Hand-written puzzles, AI only as referee.** Puzzles are drafted with a project skill in Claude Code (from hand-written seed themes and our own past puzzles, never Reddit data) and then reviewed by hand. At play time, Gemini only judges answers that miss the hand-written list. The game works fully without it.

**Tech:**

- **Devvit Web** with a **Hono** server (`src/server/`) and Devvit **Redis** for runs, counts and streaks.
- **Phaser 4** draws the world (`src/client/world.ts`, `strata.ts`): strata are painted in code, lighting is a cheap lamp mask rather than per-pixel lights, so it holds frame rate on phones.
- A thin **DOM overlay** for the HUD, input and end screen, so phone keyboards, focus and screen readers behave.
- **Howler.js** for sound; every sound is synthesised by [`tools/make-sounds.ts`](tools/make-sounds.ts).
- Game rules (`src/shared/`) are plain TypeScript with no Devvit imports, covered by **Vitest**. The server never sends future clues or answer lists to the browser.
- **Devvit Journeys** record run started, layer progress and run finished (no answers, no usernames).

Design and decision notes: [`docs/SPEC.md`](docs/SPEC.md) (the rules), [`docs/DESIGN.md`](docs/DESIGN.md) (the look), [`docs/DECISIONS.md`](docs/DECISIONS.md) (tech choices), [`docs/QA.md`](docs/QA.md) (test results).

## Run it yourself

Requires Node.js 24.18+ (see `.nvmrc`) and a Reddit account connected to [Reddit for Developers](https://developers.reddit.com).

```sh
git clone https://github.com/chalex08/unearth-daily.git
cd unearth-daily
npm install
npx devvit login
cp .env.example .env   # set DEVVIT_APP_NAME and DEVVIT_SUBREDDIT to your own dev app and test subreddit
npm run dev            # playtest on Reddit; prints the playtest URL
```

The answer checker needs a paid-tier Gemini key, stored as a Devvit secret (never in code or `.env`). Without one, the game still plays: listed answers work, others get "Couldn't check that".

```sh
npx devvit settings set geminiApiKey   # after the app has been installed once
```

`devvit.json` names the canonical app **`unearth-daily`** and its subreddit **r/UnearthDaily**; each developer points the CLI at their own app in `.env` ([Multiple Developers](https://developers.reddit.com/docs/guides/tools/multiple_developers)). Details in [CONTRIBUTING.md](CONTRIBUTING.md).

| Command                | What it does                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Playtest on your dev app and subreddit, with live reload                                                 |
| `npm run build`        | Build client and server into `dist/`                                                                     |
| `npm run typecheck`    | TypeScript (strict)                                                                                      |
| `npm run lint`         | ESLint                                                                                                   |
| `npm run test`         | Vitest                                                                                                   |
| `npm run upload:dev`   | Upload your dev app; refuses to target `unearth-daily`                                                   |
| `npm run deploy:prod`  | Upload the canonical app (app owner only). **Does not publish.**                                         |
| `/write-puzzle <date>` | In Claude Code: draft a puzzle into `content/puzzles/drafts/` for review ([CONTENT.md](docs/CONTENT.md)) |

Publishing for Reddit review (`npm run launch:after-hackathon`) is held until the hackathon ends and refuses to run without an explicit flag.

## Credits

- **Sounds** (`public/sounds/`): original, synthesised by [`tools/make-sounds.ts`](tools/make-sounds.ts), released CC0. Played with [Howler.js](https://howlerjs.com/) (MIT).
- **Fonts:** EB Garamond and Atkinson Hyperlegible Next, SIL OFL 1.1, bundled via Fontsource.
- **Engine:** [Phaser](https://phaser.io/) (MIT).
- Unearth is an independent app and is not made or endorsed by Reddit.

License: BSD-3-Clause.
