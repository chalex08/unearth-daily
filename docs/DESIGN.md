# UNEARTH: design system

The look and feel of the game. [SPEC.md](SPEC.md) decides what exists and how it behaves; this file decides how it looks. Sources and what each one is for are in [references/REFERENCES.md](references/REFERENCES.md). Agreed 22 Nov 2026 (PLAN step 6), with the adjustments listed under each section.

**The idea:** a hand-tinted geological survey plate, read by headlamp. The rock is a flat watercolour tint with a darker edge line and a printed lithology pattern. Darkness is the default. Ore is the only saturated colour on screen.

Code: palette and patterns in [`src/client/strata.ts`](../src/client/strata.ts), tokens in [`src/client/tokens.css`](../src/client/tokens.css), screens in [`src/client/game.css`](../src/client/game.css), world in [`src/client/world.ts`](../src/client/world.ts).

## 1. Strata

Each of the 10 layers (plus Surface) has its own tint, edge, ore and pattern, so a new layer changes the whole palette at once (Dome Keeper, ref 14). The pattern means the layer never depends on colour alone (lithology chart, ref 19). Patterns are drawn in code on a canvas, seeded so every device draws the same rock.

| #   | Stratum | Tint      | Ore       | Pattern                                      | Ore detail                                |
| --- | ------- | --------- | --------- | -------------------------------------------- | ----------------------------------------- |
| 0   | Surface | `#a8925f` | `#8fb05a` | grass ticks along the top, soil speckle      |                                           |
| 1   | Dirt    | `#5e4330` | `#c08a5c` | speckle                                      |                                           |
| 2   | Clay    | `#87573a` | `#e09a58` | fine horizontal lines                        |                                           |
| 3   | Stone   | `#5d5b57` | `#c4c0b6` | brick (limestone)                            |                                           |
| 4   | Coal    | `#222026` | `#a497ea` | dense dark bands                             | flecks in oil-slick violet, blue and gold |
| 5   | Copper  | `#4f3a33` | `#ec9a7c` | small branching ticks (dendrites)            | green patina flecks                       |
| 6   | Iron    | `#3a2e2c` | `#e07a5c` | pebbles                                      |                                           |
| 7   | Silver  | `#3a3d42` | `#e3e8ee` | curling wire lines                           |                                           |
| 8   | Gold    | `#3b352a` | `#f0c64a` | small hexagonal plates                       |                                           |
| 9   | Diamond | `#2b3036` | `#cfe3ea` | rough octahedra, not the brilliant-cut shape |                                           |
| 10  | Uranium | `#1f2b26` | `#3fd08f` | stacked tabular plates                       | rich blue-green, never neon lime          |

- **Rock stays muted;** the tint darkens with depth. A 2px edge line in the darker shade runs along the top of each stratum, with a soft darker band under it.
- **Ore** appears as a few small flecks per stratum, and is reused for the HUD pip, the band block, the strike tint and the lit edge of the recess.
- **Lettering on the rock** (stratum name, chiselled answers, fossils) is EB Garamond in bone (`#efe6d2`) on every stratum except Surface, where it's dark. The layer number goes before the italic name, as Smith wrote altitudes ("4 Coal"). Lowest contrast: 4.9:1 on Clay; Coal is 13:1.

## 2. Type

Both faces are bundled with the app (see DECISIONS: Devvit's CSP blocks external client requests).

- **EB Garamond** (variable, roman and italic): lettering on the rock, band names in the strike reveal, the end-screen title. Italic is for names lettered along layers; roman for chiselled answers.
- **Atkinson Hyperlegible Next** (400, 700): the clue, the chain, the input, the HUD, every number. It's built for legibility, and that comes first for anything you have to read to play.
- Scale (1.2 ratio from 16px): 13, 14, 16, 19.2, 23, 27.6, 39.8px. Nothing you play from goes under 14px; the current clue is 21px bold when carved on the rock (§12) and 23px bold in the recess.
- No tracked capitals and no middle-dot strings. Band names are sentence-case italic ("Mother Lode"), and side notes read "+113 Vein".

## 3. Colour

The shaft UI is dark and warm, in OKLCH (tokens.css). Restrained posture: the accent is a signal, and ore colours are data, not decoration.

| Token                 | Value                 | Use                                                                        | Contrast                   |
| --------------------- | --------------------- | -------------------------------------------------------------------------- | -------------------------- |
| `--color-paper`       | `oklch(17% 0.012 60)` | recess, HUD, end log                                                       |                            |
| `--color-ink`         | `oklch(93% 0.012 85)` | clue, answers                                                              | 15.6:1 on paper            |
| `--color-ink-2`       | `oklch(80% 0.014 80)` | earlier clues                                                              | 10.2:1                     |
| `--color-muted`       | `oklch(68% 0.014 75)` | labels, helper, neutral feedback                                           | 6.6:1                      |
| `--color-accent`      | `oklch(52% 0.19 28)`  | survey red, the painted catalogue number: Dig and Copy buttons, layer tags | white on it 5.7:1          |
| `--color-accent-text` | `oklch(68% 0.17 28)`  | wrong-answer line, focus ring                                              | 6.2:1                      |
| `--color-ore-ink`     | `oklch(22% 0.02 60)`  | text on an ore block                                                       | 5.8:1 or more on every ore |

Every ore colour is at least 6.4:1 on paper, so ore-coloured band names read on the recess.

## 4. Play screen

From top to bottom: HUD, the world, the recess.

- **HUD** (Krillion ref 02): pickaxes top-left (drawn as line icons; a broken one dims), ten pips top-centre (empty, outlined for the current layer, filled with the ore colour once cleared), score top-right. It sits on its own dark strip running edge to edge, with its contents lined up with the 40rem recess on wide screens.
- **Camera:** the current stratum is centred in the rock actually left showing between the HUD and the recess (the recess grows as the chain does), not at a fixed screen height.
- **The recess** is an opaque dark panel cut into the rock, lit along its top edge in the current stratum's ore. _(Adjustment 2.)_ It's opaque so the text in it reads at the same contrast on every stratum, Coal, Iron and Uranium included. Since step 7 the current clue is carved on the rock face in a dark niche (§12), never straight on the textured rock; it falls back to the recess when too little rock is showing to read it.
- **The core sample stays visible** _(adjustment 1)_. Above the current clue, every cleared layer is a row in the recess: its clue, your answer, and "+points band". Each row carries a 6px bar in its stratum's ore, and the bars join into one column that runs down into the current clue's bar (outlined, because it isn't cleared yet). Fragment clues ("…that can't fly") always read with the chain above them, and the helper line says "Every clue above still applies." The chain holds up to 35% of the screen height (all nine links fit at 390×780, one line each where they fit), scrolls for the rest. When it scrolls (short screens, keyboard open), the first clue stays pinned at the top and the newest links stay in view next to the current clue.
- **Answer form:** one line of feedback above the input, a 48px input, and one red Dig button. The input keeps focus the whole run, and is disabled (with Dig) once the final answer or the last pickaxe ends it.

## 5. Strike reveal and pacing

The reveal replaces the clue in the recess (in place, never a modal), in Krillion's order (ref 04): band name (italic, ore-coloured, 40px), "answer", points, one dry line.

- **Points** (Balatro, ref 15): a base block, then a band block in the ore colour that slams in. The rarer the band, the harder it lands (scale 1.3 Seam, 1.6 Vein, 2 Mother Lode). The HUD score counts up over 600ms.
- **Common is modest on purpose** (ref 05): a small muted band name, the base block only, no slam, no tint.
- **Vein and Mother Lode** tint the whole screen in the ore colour for about 220ms (ref 07).
- **The Uranium finish** (layer 10, which has no band) gets the full treatment: the mineral name at full size in Uranium green, the tint, a 2.5s hold, and "You hit the core."
- **Flavour lines** are our own: Common "The answer most diggers hit first.", Seam "A thin line of something better.", Vein "Few swung their pick this way.", Mother Lode "Almost nobody dug here." Then "N% of diggers found it." once the band is measured (not during cold start, where a small-sample percent would contradict the estimated band, and not at layer 10). During cold start the head stays the band name alone and the flavour line adds "Estimated until 50 diggers answer this layer."
- **Pacing** _(adjustment 3)_: there's no Dig tap between layers. Common strikes move on after about 1s. Rarer bands linger a little longer (§13: Seam 1.5s, Vein 2s, Mother Lode and the Uranium finish 2.5s), or until the player taps the reveal or presses Enter. The camera descends and the next clue appears once the reveal ends. The keyboard stays up throughout, so the player can type the next answer during a reveal, and Dig stays live (it skips the reveal).

### Mineral icons

Eleven SVGs in [`public/icons/`](../public/icons/), 32×32, flat fills with a darker edge line like the strata, recognisable at 20px. Shapes follow REFERENCES §7: Surface a grass tuft on soil, Dirt a speckled clod, Clay a banded slab, Stone a faceted rock, Coal a dark lump with violet, blue and gold sheen strokes, Copper salmon dendrites with green patina spots, Iron botryoidal haematite, Silver curling wires, Gold flat hexagonal plates with dark reflections, Diamond a rough octahedron (not the brilliant cut), Uranium stacked tabular plates in emerald green. Used above the band name in the strike reveal and beside the end-screen title; candidates for the share card and app icon later.

## 6. Wrong answer

One line just above the input, in the accent text colour, dry in tone (ref 06): `“potato”: Not quite, digger. 2 pickaxes left.` The input is cleared (the server has used the guess) and stays focused. The lost pickaxe in the HUD tips over and dims. Neutral feedback (empty, too long, reused, couldn't check) uses the same line in muted ink and costs nothing.

## 7. Fossils

_(Adjustment 4; reworked in step 7 from lettering to objects.)_ Other players' answers at layers this player has cleared, from `GET /api/stats`, sit in the shaft walls as small bone-coloured objects with a dark rim: an ammonite, a trilobite or a frond (picked by the answer's hash, so the same on every device), drawn in code.

- **Placement:** up to four per stratum, two on each wall, just beside the shaft where the headlamp reaches (not out at the screen edge in the dark). Most found first. On a phone the upper walls are only ~20px wide, so a fossil may use the 14px strip of shaft beside the core segment too and sit half out of the wall, as if eroding from it.
- **Size by popularity:** the object's radius is 6px + 1.9 × √percent, capped at 18px and at half the wall plus that strip (about 8px for a 1% answer, 15px at 25%; at 375px wide, layer 1 still ranges 6 to 14px).
- **Names:** where the wall is at least 90px wide (desktop, and the upper layers on a phone), the name sits under the object in EB Garamond italic 13px, faint. Where it isn't, the name appears on tap only.
- **Tap state:** a tap shows "kiwi 12.5%" on a dark plate above everything, so it reads on any stratum. Tapping again, or tapping empty rock, closes it. One open at a time. The tap target is a circle at least 44px across.
- **SPEC §4.1:** the server names only hand-reviewed pool answers. Anything only the AI accepted comes back as "something else", always drawn as the smallest plain pebble, whatever its share. Its percent still shows on tap. During a run, the server also turns any fossil that answers the current layer into "something else". After the run ends, every pool fossil is named.
- **Lit:** fossils are drawn above the darkness (they sit on cleared layers, outside the headlamp, where they'd otherwise be all but invisible), at 60% opacity, 40% for "something else", with names at 50%, so they still read as faint marks in the rock.
- **As text:** the canvas is hidden from screen readers and can't be reached by keyboard, so `#fossils` lists the same four per layer with percents. In the desktop side panel it is visible under the form ("Other diggers' answers", a focusable scroll box); on phones, where the rock shows them, it is for screen readers only. Hidden while there are none.
- **Pulled back** at the end, fossils are only marks in the rock: no names, no taps (at ~0.1 scale a tag can't be read).
- If stats fail to load, the rock simply has no fossils. Play never waits on them.

## 8. End screen

A catalogued specimen in the recess, under the pulled-back core sample (the whole column, Surface to Uranium, fitted into the rock left showing above the panel): the mineral icon and title in the hero mineral's ore colour ("Struck Gold", "Caved in at Copper"), the total, then the share text and **Copy result**, the one primary action, high enough to be on screen without scrolling. Below: rare finds, pickaxes left and streak, then the finished core sample, drawn the same way as in play: one joined ore bar per cleared layer, an empty outlined slot for each layer not reached, the layer number in muted text, the clue, your answer and "+points band". If any band was estimated, one note under the list says so. Then the final answer.

Step 9 order, top to bottom: the hero (icon, title and total rise 28px into place as the pull-back ends; no motion under reduced motion), rare finds / pickaxes left / streak, the share text with **Copy result** (the button itself says "Copied" for 2.5s) and an outlined **Discuss in comments**, the countdown, the one-time join prompt (an ore-barred panel), the graveyard table (mineral in ore colour, a bar for the runs that ended there, ended and reached counts, your row bold with "(you)", and "You dug deeper than X% of today’s other diggers" above it), the core sample with each broken-pickaxe answer struck through under its layer and "caved in here" on the layer where the run stopped, the final answer, then the opt-in flair button. Every secondary action is an outlined `button.quiet`, so Copy stays the one red button.

### Feed card (holding version)

The inline view (`splash.html`) uses the same tokens and fonts: the strata column drawn by `drawStratum` filling the card, then the italic Unearth wordmark, one line and a red Play button. PLAN step 10 replaces the line with the first clue, number, date and player count.

## 9. Motion

- Only `transform` and `opacity`. Durations: 120ms for press and colour, 220ms for the slam and the strike tint, 420ms for the pickaxe snap, 600ms for camera pans and the score count.
- **Reduced motion:** camera moves cut instantly, the score jumps to its total, the slam and snap show their end state, and the strike tint becomes a soft 600ms fade at 14% instead of a 220ms flash at 35%.

## 10. Still to build

_Step 7 (world) is built: see §12._

- **Step 7 (world):** the headlamp cone and darkness with depth, shaft walls narrowing one notch per layer, the Uranium glow lighting the lowest strata, clues carved on the rock face, keyboard and screen-reader access to fossils. Also: render the canvas at the device pixel ratio (it's 1× now, so rock patterns look soft on phones; lettering is already sharp), a warm daylight band above Surface, and make the end-screen pull-back pan and zoom move together (the pan currently aims at the final zoom, so the 600ms zoom-out briefly shows bedrock).
- **Step 8 (juice), built: see §13.** Was: pickaxe impact, shake and debris, ore by band in the rock (rubble, seam, cracked vein, glowing lode that lights the walls), the bright horizontal seam line on a rare strike, sound.
- **Step 9 (end):** the graveyard as a distribution with a "YOU" marker (ref 09), "deeper than X% of redditors", the band legend, string-tied tags.

## 11. Step 7 asset list

Nothing here needs commissioned art. Everything is drawn in code from the palette in `strata.ts`, so it stays consistent, costs nothing to ship, and changes with the tokens.

| Asset               | How                | Notes                                                                                                                                                                                                                                                             |
| ------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Strata textures** | Code (done)        | Canvas tile per stratum: tint, edge line, lithology pattern, ore flecks (`drawStratum`). Step 7 adds the shaft walls as darker carved edges stepping in one notch per layer, drawn the same way.                                                                  |
| **Fossils**         | Code (done)        | EB Garamond lettering sized by popularity (§7). Optional later: a small string-tied tag drawn behind an opened fossil (REFERENCES ref 27).                                                                                                                        |
| **Debris**          | Code               | Phaser particles from a few generated chip textures (2–5px polygons) in the stratum's tint and edge colours, plus ore-coloured chips on Seam and above. No particles under reduced motion.                                                                        |
| **Ore glow**        | Code               | A radial-gradient texture generated at runtime, tinted per ore and drawn with additive blending; Mother Lode adds a short-lived light that brightens nearby wall edges. Reduced motion: shown at its final strength, no pulse.                                    |
| **Headlamp**        | Code               | A darkness layer over the world with a soft radial cut-out around the shaft (render texture or mask). Darkness grows with depth; the cone stays still under reduced motion.                                                                                       |
| **Uranium core**    | Code; art optional | Stacked tabular plates built from the Uranium icon's geometry at large scale, with the ore-glow texture lighting the lowest strata green. If we want one hero image for Devpost, a hand-painted core sprite is the only place art would add something code can't. |

## 12. The world (step 7)

Code: [`src/client/world.ts`](../src/client/world.ts); pure shaft and light maths (tested) in [`geometry.ts`](../src/client/geometry.ts).

- **One cross-section:** Surface plus ten strata, each 220px tall with its own texture. A shaft is cut through all of them, and the rock either side is the stratum's texture. The shaft's back wall is a separate grey rock layer, tinted with the stratum colour as the camera passes, and it scrolls at 0.86× (parallax).
- **Narrowing:** the shaft is 100% of its mouth width at the Surface and loses 5.5% per layer in steps (45% at layer 10). The mouth is the screen width minus 24px, capped at 560px. Each step has a lit ledge so the notch is visible.
- **Core sample:** each cleared layer is a dark segment of the stratum, with a 5px ore bar on its left, holding the layer number and name in ore colour, the clue, and the answer chiselled in EB Garamond. Segments join into one column. Layers not reached are outlined slots (shown, with their clue, only on the end screen).
- **The carved clue:** the current layer's segment is a dark niche with an outline in ore, with the clue in Atkinson bold 21px and a drop shadow. It is dark behind the text on every stratum, so the contrast rule holds. The DOM `#clue` stays for screen readers and is visually hidden while the clue is carved (`body[data-carved]`); the recess then shows the chain, the layer line and the form. When the rock showing is shorter than the carved label and clue need (and never under 170px), or the clue would have to shrink below 80% to fit a narrow deep shaft, the niche keeps only its label and the recess shows the clue, as before step 7. It is re-checked whenever the HUD or panels change height. With forced colours or `prefers-contrast: more`, the recess always shows the clue as real text. Screen readers hear each new clue, and each strike, through one always-rendered live region (`#announce`).
- **Light:** a darkness sprite with a soft elliptical hole (width follows the shaft, so the cone narrows as the shaft does), plus four solid images to cover the rest of the screen. Its opacity is `0.96 × (1 − e^(−depth/3.2))`: daylight at the Surface, about 0.9 by layer 7. A warm additive glow sits inside the hole. At the end the darkness lifts over 900ms so the whole core sample is visible.
- **Uranium:** a green additive glow (the Uranium ore colour) pulses between 50% and 85% over 1.8s at the foot of the last shaft, above the darkness, so it lights the rock around it and shows from two layers away. Stacked tabular plates sit on the floor of the shaft. Reduced motion: fixed at 70%.
- **Camera:** one tween (600ms, sine) moves zoom and centre together, so the end-screen pull-back no longer shows bedrock mid-way. A fresh run opens on the Surface in daylight and sinks into layer 1 over 1.6s after a 450ms beat, so the daylight-to-headlamp change is seen once; a resumed run cuts straight to its layer. Reduced motion cuts instantly, skips the opening and has no dust.
- **Sky:** a warm daylight band above the Surface.
- **Sharpness:** the canvas is rendered at the device pixel ratio capped at 2 (shown at 1/K), and rock textures are drawn at K×.
- **Short screens:** the chain is what gives way (it shrinks and scrolls) so the input never ends up under the keyboard, down to 320×300.
- **Performance:** stratum textures are drawn within 1 layer of the camera at once, and the rest one at a time (250ms apart) while the camera is still, so neither a descent nor the pull-back has to draw several in one frame. Nothing is recomputed while the camera is still; a layout re-renders only text and fossils that changed; canvas resizes are debounced 100ms (a mobile keyboard animates the height). The only particles are dust motes in the headlamp, capped at 14 alive. The loop is capped at 60fps (90/120Hz phones would double the work) and drops to 30fps whenever nothing is moving; WebGL antialiasing is off (nothing drawn has geometry edges). Smooth gradients (lamp, glows, sky) are drawn at 1×. Glow pulse and dust follow a reduced-motion change live.
- **Side panel:** from 56rem wide, the HUD, chain and form move to a 26rem column on the right and the whole canvas is rock.

## 13. The feel (step 8)

Code: choreography in [`world.ts`](../src/client/world.ts) (`strike`, `showOre`, `bounce`), timings in [`feel.ts`](../src/client/feel.ts) (tested), sound and haptics in [`sound.ts`](../src/client/sound.ts), wiring in `game.ts`. All times are ms from the server's answer.

### Strike

| t (ms)     | What                                                                                                                                                                                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 to 110   | The pickaxe swings in from the upper right (cubic ease-in).                                                                                                                                                                                                                        |
| **110**    | **Impact:** strike sound, haptic, screen shake 140ms, a spark (170ms), rock chips (10 on Common, +5 per band up, in the stratum's tint and edge, with ore chips from Seam up). The niche becomes a cleared segment and the answer is chiselled in (180ms, scaling down from 130%). |
| 200        | The ore starts to show, in the rock at the foot of the segment, over a band-dependent time (below). The Mother Lode chime starts here.                                                                                                                                             |
| end of ore | The score label fades in (120ms): mineral, band (with "est." while estimated), "+base base, +bonus bonus", "N% of players" (not while estimated or at layer 10), "total T".                                                                                                        |
| hold − 150 | The label fades out (150ms).                                                                                                                                                                                                                                                       |
| **hold**   | The camera descends (600ms) with the descend sound, and the next clue appears. A tap or Enter skips to here.                                                                                                                                                                       |

| Band                                         | Ore                                                                                                                                                  | Ore time | Label in | Shake | Hold |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | ----- | ---- |
| Common                                       | Dull rubble: eight chips in the stratum's darkened tint, fading in                                                                                   | 160      | 360      | 0.3%  | 1000 |
| Seam                                         | A thin 3px line in the ore colour, drawn out from the middle across the shaft and into both walls                                                    | 260      | 460      | 0.4%  | 1500 |
| Vein                                         | A bright cracked vein: a jagged additive line with two side cracks, drawn above the darkness, plus a bright full-width seam line that settles to 35% | 380      | 580      | 0.6%  | 2000 |
| Mother Lode (and Uranium, which has no band) | Two veins, and a wide ore-coloured glow that flares to 90% and settles to 40%, lighting the walls                                                    | 520      | 720      | 0.8%  | 2500 |

The ore stays in the rock for the rest of the run, so the camera passes it on the way down.

### Wrong answer

| t (ms)     | What                                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 0 to 120   | The word (italic, bone) flies sideways at a shaft wall, from the middle of the segment. The wall alternates with the word. |
| **120**    | **Contact:** clink sound, haptic, a crack fans out into the wall (60ms fade-in; it stays until the next answer).           |
| 120 to 420 | The word bounces back, spinning, and fades.                                                                                |
| 0 to 420   | The HUD pickaxe that broke snaps (§9). The reason line appears at 0 in the accent colour.                                  |

The input is never disabled and keeps focus, so you can type from 0ms. The whole beat is 420ms, under the 600ms limit (asserted in `feel.test.ts`).

### Couldn't check

No world effect, no sound, no pickaxe lost. The feedback line (muted ink, not red) gets a 560ms light sweep across it.

### Sound and haptics

Five files in `public/sounds/`, original and synthesised by `tools/make-sounds.ts`: strike 13 KB, clink 12 KB, descend 24 KB, chime 43 KB, hum 26 KB. Strike at impact, clink at contact, descend as the camera moves, chime for Mother Lode (and the Uranium finish), hum looping on layer 10. The HUD speaker button mutes everything and is remembered locally; sound is also muted while the tab is hidden. Haptics: 15ms on a Common strike, 20-30-40ms on a rarer one, 12-40-12ms on a clink, where `navigator.vibrate` exists.

### Reduced motion

No shake, swing, chips, spark, slide, scale, bounce or bar-draw. The pickaxe and the word fade in and out in place; the chiselled answer, ore, crack and label fade in; the shimmer is a soft fade; the camera cuts (as before). The same information shows on the same timings. Sound still plays (it is not motion). Haptics are skipped.
