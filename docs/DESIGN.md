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
- Scale (1.2 ratio from 16px): 13, 14, 16, 19.2, 23, 27.6, 39.8px. Nothing you play from goes under 14px; the current clue is 23px bold.
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

- **HUD** (Krillion ref 02): pickaxes top-left (drawn as line icons; a broken one dims), ten pips top-centre (empty, outlined for the current layer, filled with the ore colour once cleared), score top-right. It sits on its own dark strip.
- **The recess** is an opaque dark panel cut into the rock, lit along its top edge in the current stratum's ore. _(Adjustment 2.)_ It's opaque so the clue reads at the same contrast on every stratum, Coal, Iron and Uranium included. The clue is never set straight on textured rock.
- **The core sample stays visible** _(adjustment 1)_. Above the current clue, every cleared layer is a row in the recess: its clue, your answer, and "+points band". Each row carries a 6px bar in its stratum's ore, and the bars join into one column that runs down into the current clue's bar (outlined, because it isn't cleared yet). Fragment clues ("…that can't fly") always read with the chain above them, and the helper line says "Every clue above still applies." The chain holds up to 26% of the screen height, scrolls for the rest, and always keeps the newest links (the ones the current clue builds on) in view, including when the mobile keyboard opens.
- **Answer form:** one line of feedback above the input, a 48px input, and one red Dig button. The input keeps focus the whole run.

## 5. Strike reveal and pacing

The reveal replaces the clue in the recess (in place, never a modal), in Krillion's order (ref 04): band name (italic, ore-coloured, 40px), "answer", points, one dry line.

- **Points** (Balatro, ref 15): a base block, then a band block in the ore colour that slams in. The rarer the band, the harder it lands (scale 1.3 Seam, 1.6 Vein, 2 Mother Lode). The HUD score counts up over 600ms.
- **Common is modest on purpose** (ref 05): a small muted band name, the base block only, no slam, no tint.
- **Vein and Mother Lode** tint the whole screen in the ore colour for about 220ms (ref 07).
- **Flavour lines** are our own: Common "The answer most diggers hit first.", Seam "A thin line of something better.", Vein "Few swung their pick this way.", Mother Lode "Almost nobody dug here." Then "N% of diggers found it." when the server sends a percent. "estimated" follows the band name during cold start.
- **Pacing** _(adjustment 3)_: there's no Dig tap between layers. Common strikes (and layer 10, which has no band) move on after about 1s. Seam, Vein and Mother Lode hold for about 2.5s, or until the player taps the reveal or presses Enter. The camera descends and the next clue appears once the reveal ends. The keyboard stays up throughout, so the player can type the next answer during a reveal.

## 6. Wrong answer

One line just above the input, in the accent text colour, dry in tone (ref 06): `“potato”: Not quite, digger. 2 pickaxes left.` The input is cleared (the server has used the guess) and stays focused. The lost pickaxe in the HUD tips over and dims. Neutral feedback (empty, too long, reused, couldn't check) uses the same line in muted ink and costs nothing.

## 7. Fossils

_(Adjustment 4.)_ Other players' answers at layers this player has cleared, from `GET /api/stats`, sit in the rock as faint lettering.

- **Placement:** up to four per stratum, at its sides (top-left, top-right, bottom-left, bottom-right), clear of the chiselled answer in the middle. Most found first.
- **Size by popularity:** EB Garamond italic, 13px + 2.2 × √percent, capped at 28px (about 15px for a 1% answer, 24px at 25%). Opacity 0.6.
- **Tap state:** a tap shows the percent beside the name ("kiwi 12.5%") at full opacity. Tapping again, or tapping empty rock, closes it. Only one is open at a time, and the tap target is padded past the letters.
- **SPEC §4.1:** the server names only hand-reviewed pool answers. Anything only the AI accepted comes back as "something else", which is set in roman (not italic) at opacity 0.4, so it reads as unnamed. During a run, the server also turns any fossil that answers the current layer into "something else". After the run ends, every pool fossil is named. The player's own answer is always their own text in their chain.
- If stats fail to load, the rock simply has no fossils. Play never waits on them.

## 8. End screen

A catalogued specimen in the recess, under the pulled-back core sample: the title in the hero mineral's ore colour ("Struck Gold", "Caved in at Copper"), the total, a row of rare finds, pickaxes left and streak, then the full chain. Each layer gets a painted number tag (red on a pale oval, ref 28), the clue, your answer and "+points band"; unreached layers are muted. Then the final answer, the share text and Copy result, the one primary action.

## 9. Motion

- Only `transform` and `opacity`. Durations: 120ms for press and colour, 220ms for the slam and the strike tint, 420ms for the pickaxe snap, 600ms for camera pans and the score count.
- **Reduced motion:** camera moves cut instantly, the score jumps to its total, the slam and snap show their end state, and the strike tint becomes a soft 600ms fade at 14% instead of a 220ms flash at 35%.

## 10. Still to build

- **Step 7 (world):** the headlamp cone and darkness with depth, shaft walls narrowing one notch per layer, the Uranium glow lighting the lowest strata, clues carved on the rock face, keyboard and screen-reader access to fossils.
- **Step 8 (juice):** pickaxe impact, shake and debris, ore by band in the rock (rubble, seam, cracked vein, glowing lode that lights the walls), the bright horizontal seam line on a rare strike, mineral icons, sound.
- **Step 9 (end):** the graveyard as a distribution with a "YOU" marker (ref 09), "deeper than X% of redditors", the band legend, string-tied tags.
