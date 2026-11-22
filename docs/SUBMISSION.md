# Devpost submission

Paste-ready text for the Devpost form, the demo video script, and the checklist.

## Tagline

A daily word puzzle you dig into: ten clues, each narrowing the last, from Dirt down to Uranium.

## Inspiration

Every morning the same handful of daily puzzles gets posted, solved and argued about in the comments. We wanted one that belonged on Reddit: one shared puzzle, with the comments as the conversation afterwards. We also wanted it to reward knowing odd things, not only being fast. "Name something orange" has thousands of answers; "…that's a citrus fruit, smaller than a tennis ball, with no letter E, not usually eaten raw" has very few. Digging felt like the right picture for that: the deeper you go, the rarer what you find.

## What it does

Unearth posts one puzzle a day at 00:00 UTC, pinned in the subreddit. It's a chain of ten clues. Your answer at each layer has to fit every clue so far, and each answer can be used only once per run. Layer 10 has exactly one answer.

You have three pickaxes; a wrong answer breaks one. Each layer is a mineral worth more the deeper it is, and each answer gets a rarity bonus from how many of today's players gave the same one: Rubble, Nugget, Pocket, Vein, or the Mother Lode.

The run happens in one continuous cross-section of earth. The camera descends as you dig, the shaft narrows, the light fades to a headlamp, and a green glow waits at the bottom. Correct answers are chiselled into the rock with ore that shows their rarity. Other players' answers sit in the rock as fossils you can tap.

At the end you get the full chain revealed, the day's graveyard (where everyone stopped), a spoiler-free share text, a button to post it in the comments as yourself, streaks, and optional flair with your streak and deepest mineral.

## How we built it

- **Devvit Web** with a **Hono** server and Devvit **Redis** for runs, answer counts and streaks. A scheduler job makes the daily post.
- **Phaser 4** for the world. Strata are painted in code; lighting is a lamp mask instead of per-pixel lights so it holds frame rate on phones.
- A thin **DOM overlay** for the HUD, input and end screen, so phone keyboards, focus and screen readers work properly.
- Game rules are plain TypeScript shared by client and server and covered by Vitest. The server never sends future clues or answers to the browser.
- Puzzles are written with a Claude Code skill from hand-written seed themes, checked by a second critic agent that sees only the clues, then reviewed by hand. At play time **Google Gemini (paid tier)** only judges answers that aren't on the hand-written list. Pool answers never need it, and if it fails you lose nothing.
- **Devvit Journeys** track run started, layer progress and run finished. Sounds are synthesised by a script and released CC0.

## Challenges we ran into

- **Free text on Reddit.** Players can type anything, but the rules ask apps to limit free expression. Other players only ever see answers from the hand-reviewed list; anything the AI accepted counts toward rarity but shows to others as "something else".
- **Never let the AI block play.** We built the whole game to work with no AI at all first, then added the judge behind an 8-second timeout that costs no pickaxe.
- **Phone keyboards.** iOS doesn't shrink the layout viewport, so the world, HUD and input follow `visualViewport`, and tapping Dig keeps the keyboard open.
- **A canvas on phones.** Rendering at device pixel ratio, lazy stratum textures and a lowered frame cap when nothing moves kept it smooth.
- **Midnight.** A run started at 23:59 UTC finishes on its own puzzle, because each post carries its day.

## Accomplishments that we're proud of

- It looks like a place, not a form, and every visual has a reduced-motion version.
- Rarity scoring means there's no single right path: an obscure answer at layer 3 can beat a common one at layer 5.
- The game plays fully without AI, and the rules around Reddit data are enforced in code and CI.
- Sounds, art and puzzles are all our own.

## What we learned

Daily puzzles are mostly about the minute after you finish: what you share and who you compare with. Building for that moment, with the graveyard, the share text and the comment under the pinned post, mattered as much as the puzzle itself.

## What's next for Unearth

- A puzzle archive so new players can dig past days, without touching streaks.
- Community-submitted seed themes, reviewed by hand.
- Weekly themed "deep digs" with longer chains.
- Moving the moderator review of AI-accepted answers into a menu screen, so good ones join the pool faster.

## Built with

devvit, reddit, typescript, phaser, hono, redis, gemini, howler.js, vite, vitest

## Demo video script (under 1 minute)

Record on a phone (screen recording of the Reddit app), with a 2-second desktop cut at the end. Voice-over in _italics_; on-screen action in plain text.

| Time      | On screen                                                                                           | Voice-over                                                             |
| --------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 0:00–0:05 | Scroll the subreddit to the pinned "Unearth #N" post; the feed card shows the first clue            | _One puzzle a day, the same for everyone. This is Unearth._            |
| 0:05–0:10 | Tap Play. The camera sinks from the Surface to Dirt                                                 | _Ten clues. Each one narrows the last._                                |
| 0:10–0:18 | Type a common answer; strike, shake, "Rubble"; camera descends                                      | _Answer, and you dig a layer deeper._                                  |
| 0:18–0:27 | Next clue appears carved in the rock; type a rare answer; ore glints, "Vein, Hidden, +100%"         | _The rarer your answer among today's players, the more it's worth._    |
| 0:27–0:33 | Type a wrong answer: it bounces, a pickaxe snaps, the reason shows                                  | _Three pickaxes. Every answer has to fit every clue so far._           |
| 0:33–0:40 | Fast cut through a few layers; the light narrows to a headlamp; green glow below                    | _By layer nine, only enthusiasts are left._                            |
| 0:40–0:48 | End screen: camera pulls back over the whole core sample; score, graveyard                          | _At the end you see the whole chain, and where everyone else stopped._ |
| 0:48–0:55 | Tap Copy, then "Discuss in comments"; the comment appears under the pinned comment                  | _Share it spoiler-free, and compare in the comments._                  |
| 0:55–0:59 | Desktop view of the same post; title card "Unearth, new dig every day at 00:00 UTC, r/UnearthDaily" | _New dig tomorrow._                                                    |

Keep the real username visible only if you're happy to show it. Record with sound on (strike, clink, descend).

## Checklist

| Item                                     | Status                                                                                                                                  | Link or note                                                                                                |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| App listing link                         | Uploaded 23 Nov (v0.0.1), **not published**                                                                                             | https://developers.reddit.com/apps/unearth-daily                                                            |
| Public demo subreddit, under 200 members | Canonical app installed in r/UnearthDaily. **Confirm public and the member count by hand** (couldn't open Reddit from this session)     | https://www.reddit.com/r/UnearthDaily/                                                                      |
| Live demo post                           | Made by the install trigger (logs show no error). **Confirm it's there, logged out, and on the app.** Puzzles end 29 Nov: see "Must do" | Link the subreddit, not one post: each day's post closes at 00:00 UTC                                       |
| Terms and Privacy                        | Written (`site/`), published by GitHub Pages                                                                                            | https://chalex08.github.io/unearth-daily/terms.html · https://chalex08.github.io/unearth-daily/privacy.html |
| README                                   | Rewritten                                                                                                                               | https://github.com/chalex08/unearth-daily#readme                                                            |
| Repo link                                | Public                                                                                                                                  | https://github.com/chalex08/unearth-daily                                                                   |
| Demo video (under 1 min)                 | **To record** (script above)                                                                                                            | —                                                                                                           |
| Feedback survey                          | **To fill in by hand** (link in the hackathon briefing)                                                                                 | —                                                                                                           |

## Must do before submitting

1. **Puzzles through the judging window.** Files end on 2026-11-29. Write and hand-review one per day to at least 31 Dec with `/write-puzzle <date>`, commit, `npm run deploy:prod`, then upgrade the install. Without them, no post is made after 29 Nov and every existing post says "This dig has closed".
2. **Set the canonical app's Gemini key** (paid tier), if you haven't yet: `$env:DEVVIT_APP_NAME='unearth-daily'; npx devvit settings set geminiApiKey`. Until then non-pool answers get "Couldn't check that".
3. **Paste the Terms and Privacy links** into the app details form (Developer Portal, the app's page, the "Terms and conditions" and "Privacy policy" fields).
4. **Remove the dev app from r/UnearthDaily** (`unearth-dev-alex` is installed there too): its own midnight job will post a second "Unearth #N" each day and fight for the pinned slot. Move the dev lane to a private test subreddit.
5. Run the "By hand" table in [QA.md](QA.md) on desktop (logged out), iOS and Android.
6. Record the video, fill in the feedback survey.
