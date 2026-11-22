# QA (step 11)

Run 23 Nov 2026 (Sydney) / 22 Nov UTC on branch `chore/submission`. Puzzle under test: #15 (2026-11-22, "Name an animal").

## How it was tested

| Where                                                                                                                                                             | What it covers                                                                                                                              | Status                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Headless Chrome 131, scripted** (`qa.mjs` in the session scratchpad, puppeteer-core) against the real `/api` routes on a local Vite server with in-memory Redis | Phone emulation 390×780 at DPR 3, touch, Android UA, **CPU throttled 4×** as a stand-in for a mid-range phone; desktop 1440×900 unthrottled | Done, results below                                                                                                        |
| Unit and route tests (`npm run test`, 98 tests)                                                                                                                   | Every SPEC rule, the judge with a stubbed `fetch`, no-judge mode, timeouts, races                                                           | Green                                                                                                                      |
| **Reddit desktop (logged in and logged out)**                                                                                                                     | The uploaded canonical app in r/UnearthDaily                                                                                                | **Not done here.** The session's built-in browser refuses reddit.com and Claude in Chrome was not connected. See "By hand" |
| **Reddit app, iOS and Android**                                                                                                                                   | Webview, keyboard, audio, haptics, real frame rate                                                                                          | **Not done here.** No Android emulator image exists on this machine and no iOS device. See "By hand"                       |

Local numbers come from a fast desktop CPU with throttling, served unbundled by Vite's dev server. They show relative cost and catch regressions; they are not a phone measurement.

## Results

### Load time

|                                                                        |          Size (gzip) |                                                                          Local, 4× CPU throttle |
| ---------------------------------------------------------------------- | -------------------: | ----------------------------------------------------------------------------------------------: |
| Feed card (`splash.html` + `default.js` + `default.css` + `strata.js`) |                ~8 KB |                                                  text on screen in **444 ms** (cold dev server) |
| Game (`game.js`, Phaser included)                                      | 375 KB (1.44 MB raw) | input usable in **837 ms** after navigation, including `/api/start` with 300 ms of fake latency |
| Fonts (4 latin `.woff2`)                                               |              ~150 KB |                                                              loaded before the rock is lettered |

- `game.js.map` (11 MB) is uploaded too but is only fetched when dev tools are open.
- Feed card budget (DECISIONS: under 1 s, Lighthouse mobile 80+): size is far inside it. **Lighthouse not run** (it needs the post's real webview URL).

### Frame rate (local, 4× throttle, phone viewport at DPR 3)

| Moment                                 | Frames/s |   p95 frame |                             Worst frame |
| -------------------------------------- | -------: | ----------: | --------------------------------------: |
| Opening descent (Surface to layer 1)   |      121 |      8.4 ms |                                  8.5 ms |
| Idle on a layer                        |   82–117 | 8.5–10.2 ms | 387 ms once (lazy stratum texture draw) |
| Strike: shake, debris, chisel, descend |  103–119 | 8.4–10.1 ms |                                 19.6 ms |
| Desktop 1440×900, no throttle          |      104 |     10.1 ms |                                 10.9 ms |

Headless Chrome isn't capped at 60, so frames/s above 60 just means headroom. One 387 ms frame while idle came from drawing an upcoming stratum texture; it's a single hitch at 4× throttle, not seen during strikes. **Real-phone frame rate is still unmeasured** (PLAN step 7 asked for 60 fps on a mid-range phone).

### Keyboard overlap

With the visual viewport cut to 390×440 (an open phone keyboard): input and Dig sit at 380–428 px, inside the 440 px screen; the clue falls back to the DOM copy above them; no horizontal scroll (document width 390).

**Fixed during QA:** tapping Dig moved focus from the input to the button, which on a phone closes the keyboard, jumps the layout, and reopens it a moment later when the answer is checked. Dig now ignores the focus change on `pointerdown` while the input is focused (`src/client/game.ts`). After the fix a touch tap on Dig leaves focus in the input (`blurredDuringTap: false`). Keyboard and screen-reader activation are unchanged.

### Double taps

Two taps on Dig plus Enter inside 100 ms sent **one** `/api/answer` request and cleared one layer (client `busy` flag; the server also locks per user and rejects a stale layer with 409, covered by tests). **Fixed during the audit:** two presses of "Discuss in comments" from two tabs could post twice; the server now claims the comment before posting (`posts one comment when pressed twice at once` test).

### Resume mid-run

Reload at layer 3 with 2 pickaxes: same layer, pickaxes, pips and 2-link core sample come back; the score counts up again from 0 to its value (cosmetic).

### Offline and AI failure

| Case                      | Result                                                 |  Time | Pickaxes  |
| ------------------------- | ------------------------------------------------------ | ----: | --------- |
| No `geminiApiKey` (no AI) | "Couldn’t check that, try again"                       | 0.4 s | unchanged |
| Gemini call hangs         | "Couldn’t check that, try again" after the 8 s abort   | 8.4 s | unchanged |
| Gemini says invalid       | "“quokka reject”: Not quite, digger. 2 pickaxes left." | 0.4 s | one broke |
| Pool answer, no AI at all | strike, layer cleared                                  |     — | unchanged |
| Reused answer             | "Already used this run. Try another."                  |     — | unchanged |
| Empty input               | "Type an answer first."                                |     — | unchanged |

Focus returned to the input after every case. If `/api/start` itself fails (network off), the game shows the error with a "Try again" button; the feed card keeps its Play button when `/api/feed` fails.

### Empty-data cold start

- Empty Redis: the feed card reads "Be the first digger today"; the first run shows the Surface opening and the two first-run hints; no errors.
- **No puzzle for the day:** `/api/feed` 404 → the card shows its tagline and Play; `/api/start` 404 → "No puzzle today" with Try again; the 00:00 UTC job throws "No puzzle for <day>" and makes no post. Nothing crashes, but there's nothing to play. **Puzzle files currently end on 2026-11-29.** See "By hand".

### Accessibility

- **Contrast:** Hallmark render lint at 375/1280/1440/1920 found the answer field's edge at 1.63:1; it now uses `--color-muted` (≥3:1, WCAG 1.4.11). Text contrast passes (lowest 4.9:1, lettering on Clay, from DESIGN.md).
- **Focus:** every control shows a 2 px survey-red ring on keyboard focus (`:focus-visible`), seen on Mute after Tab.
- **Screen-reader names on the HUD and input:** Mute "Mute sound" (`aria-pressed`), input labelled "Your answer" and described by the layer line and clue, Dig "Dig". Pickaxes `role="img"` "2 of 3 pickaxes left". **Fixed:** the layer pips were an unlabelled list of 10 empty items; now `role="img"` "2 of 10 layers cleared". **Fixed:** the score read "pts" as letters; it now says "points" to screen readers. Live regions: `#status-text`, `#result`, `#announce`.
- **Reduced motion:** strike and pacing run without shake or camera sweeps (existing; screenshot `docs/screenshots/11-reduced-motion-uranium-strike.jpg`).
- **Not done:** a pass with VoiceOver or TalkBack on a phone.

## By hand (on Reddit)

Open the demo post on each surface and tick these off:

| Check                                                                     | Desktop (logged out) | Desktop (logged in) | iOS app | Android app |
| ------------------------------------------------------------------------- | -------------------- | ------------------- | ------- | ----------- |
| Feed card shows number, date, clue 1, players, Play                       |                      |                     |         |             |
| Logged out: Play asks to log in, nothing breaks                           |                      | n/a                 |         |             |
| Play opens the game; first input usable in under ~2 s                     |                      |                     |         |             |
| Keyboard: input and Dig stay visible, keyboard stays open between answers | n/a                  | n/a                 |         |             |
| A pool answer strikes; sound plays after the first tap; Mute works        |                      |                     |         |             |
| A non-pool answer gets a real Gemini verdict (not "Couldn’t check")       |                      |                     |         |             |
| Leave mid-run, reopen: run resumes                                        |                      |                     |         |             |
| Finish: end screen, Copy, Discuss in comments, flair                      |                      |                     |         |             |
| Smooth during strikes (no visible stutter)                                |                      |                     |         |             |
| VoiceOver / TalkBack read the pickaxes, pips, clue and input              | n/a                  | n/a                 |         |             |
