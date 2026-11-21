# UNEARTH: Visual Reference Brief

Read this whole file before opening any image in `images/`.

Each reference is here for **one or two specific qualities**. Everything else in the image is irrelevant and must not leak into Unearth. For every image you'll find:

- **TAKE**: the exact quality to borrow.
- **IGNORE**: what to leave out, even though it's visible.
- **USE IN**: which Unearth screen or element it informs.

If you can't say which TAKE line a design choice came from, it probably came from the wrong part of an image.

---

## 0. Ground rules (apply to every image)

1. **The game spec decides the mechanics and the flow.** `docs/SPEC.md` decides what exists and how it behaves. References only decide how it *looks and feels*. Never add a feature because a reference has one (no timers, no "unlimited mode", no shops, no mascots).
2. **Krillion is the primary reference for flow and feel.** It sets the pacing, the tone, the HUD restraint, and how descent and reveals are staged. Every other reference supplies *materials and details* (texture, light, ore, type, labels). If two references conflict, Krillion wins on *experience*; the geology and mineral references win on *material and colour*.
3. **Unearth is NOT pixel art.** Krillion, Dome Keeper and Balatro are pixel/retro. Borrow their structure and timing, never their rendering style. The target look is a **hand-tinted geological survey print lit by a headlamp**: illustrated strata with printed lithology patterns, watercolour-like flat fills with darker edge lines, and painterly light and glow on top.
4. **Never copy identity.** Don't reuse:
   - Krillion's ocean theme, creatures, tier names (Plankton, Schooler, Rare, Deep Cut, One in a Krillion), CRT/scanline/chromatic effects, or its font
   - any game characters, logos, HUD art, mascots, card/casino themes
   - any actual image pixels, which must not ship in the game

   Unearth's tiers stay its own: Dirt → Uranium, and Common / Seam / Vein / Mother Lode.
5. **Colour from minerals, structure from games.** The mineral photos set each tier's colour and surface quality. Game screenshots set layout, motion and hierarchy.
6. **When in doubt, simplify.** Every screen must stay legible at 390px wide inside the Reddit app.

---

## 1. Krillion (krillion.io): primary reference for flow and feel

Captured from a real run of Dive #129 on 21 Nov 2026.

### 01-krillion-start-screen.jpg
- **TAKE:**
  - The **horizon split**: a bright surface world above, dark depth below, with the call to action sitting right on the boundary. It tells you "you're about to go down" before you read anything.
  - The one-line rules under the title: "7 prompts · 25 seconds each · rarer answers sink deeper".
  - A **single dominant button** ("▼ BEGIN DESCENT ▼") with directional arrows.
- **IGNORE:** pixel clouds and sun, the boat, chromatic-aberration title, Puffer Party promo, the ad bar, secondary buttons.
- **USE IN:** Feed/start view. Surface strip at top, strata stack below, first clue and "Start digging ▼" on the ground line, rules in one line ("10 clues · each narrows the last · rarer answers dig deeper").

### 02-krillion-prompt-card.jpg
- **TAKE:**
  - **HUD restraint**: only depth (top-left), score (top-right) and progress pips (top-centre), all small.
  - The **depth ruler on the right edge** with a "YOU" marker.
  - The clue reads as a calm panel; the input is docked at the bottom with one accent-coloured action button.
  - The small helper line under the clue ("▼ rarer answers sink deeper ▼").
- **IGNORE:** the countdown timer ring (Unearth has no timer), monospace pixel font, the boat.
- **USE IN:** Play screen HUD:
  - pickaxes and score top corners
  - 10 progress pips top-centre, coloured by mineral once cleared
  - a vertical ruler on the right edge marked Dirt…Uranium with a "YOU" notch
  - helper line "every clue still applies"

### 03-krillion-descent-light-cone.jpg
- **TAKE:**
  - The moment after submitting: the world goes almost black, and the **answer label sinks through a single circular pool of light**, with faint particles drifting.
  - Darkness is the default; light is local and meaningful.
- **IGNORE:** fish, bubbles, the blue hue.
- **USE IN:** The descend transition. The chiselled answer drops through the shaft inside the headlamp cone, the camera follows it, and the next stratum's colour fades in. This is the "headlamp" lighting model for the whole game.

### 04-krillion-tier-reveal-deep-cut.jpg
- **TAKE:** The **reveal hierarchy**, top to bottom:
  1. small tier icon
  2. huge spaced-out tier name
  3. the answer in quotes
  4. one line "+85 PTS · sink 850m"
  5. a dry one-line flavour sentence ("True obscurity. Few go this deep.")
  6. ONE button to continue

  It's shown in-world, not in a modal card.
- **IGNORE:** the anglerfish, purple colour, pixel font, the tier name itself.
- **USE IN:** The strike reveal for Vein and Mother Lode. Band name as headline, mineral icon, "persimmon" in quotes, "+75 base · +75 Mother Lode · 0.4% dug this", then a flavour line per band (write our own, e.g. Mother Lode: "Nobody else dug here."), then "Dig ▼".

### 05-krillion-tier-reveal-plankton.jpg
- **TAKE:**
  - **Common answers get a deliberately modest reveal.** Dimmer colour, smaller fanfare, gently self-deprecating copy ("The answer everyone blurts out."). The contrast with rare reveals is the reward system.
  - The **zone label drifting in the world** ("THE MIDNIGHT ZONE").
  - Faint markers on the depth line showing how many others landed at that depth ("PLANKTON · 18", "TOO CLEVER · 15").
- **IGNORE:** bubbles, the plankton icon, the tier name.
- **USE IN:**
  - Common strikes are quick and understated.
  - Stratum names as in-world labels ("THE COAL SEAM").
  - Other players' answers as faint fossils sitting in the rock at that depth.

### 06-krillion-wrong-answer.jpg
- **TAKE:**
  - The rejection is **one small inline line just above the input**, in the accent colour, with a dry tone: `"teapot": no echo. try again`.
  - No modal, no screen takeover; the input keeps the text so you can edit it.
- **IGNORE:** the timer, the font.
- **USE IN:** Wrong-answer state. Keep the message inline above the input (`"grapefruit": too big for this seam. 2 pickaxes left`), alongside the pickaxe-snap animation in the HUD. Nothing bigger.

### 07-krillion-rare-hit-flash.jpg
- **TAKE:**
  - On a rare answer the **entire screen briefly tints** in the tier colour.
  - A **horizontal line flashes at the depth reached**, with the tier glyph glitching in.
- **IGNORE:** the red colour, glitch/CRT effect.
- **USE IN:** Vein and Mother Lode strikes. A 150–250ms full-screen tint in the *band colour*, plus a bright horizontal seam line across the stratum. Respect `prefers-reduced-motion` by using a soft fade instead.

### 08-krillion-narrowing-rock-walls.jpg ★ key reference
- **TAKE:**
  - **Rock walls close in from both sides**, framing the clue panel in a narrow vertical channel. The narrowing is felt without any explanation.
  - **Small mineral flecks glint inside the rock** (a few pink and teal pixels).
  - The clue panel floats in the gap, and the input sits at the bottom of the channel.
- **IGNORE:** pixel rendering, the specific cobblestone shapes, the colours.
- **USE IN:** The core play composition. The shaft walls step inward one notch per layer, embedded ore flecks catch the headlamp light, and the clue sits in the gap. By layer 9 the gap should feel tight.

### 09-krillion-end-screen.jpg ★ key reference
- **TAKE:**
  - A big score with depth beside it.
  - A **distribution curve of today's players with a "YOU" marker** and "BETTER THAN 77% OF TODAY'S PLAYERS".
  - A **per-prompt log** (vertical drop-lines, each ending in its tier icon).
  - A **tier legend** with ranges and one-line descriptions.
  - **One primary "COPY RESULT" button.**
- **IGNORE:** "Keep diving ∞", Archive and Themed packs (out of MVP scope), seaweed, pixel font.
- **USE IN:** End screen:
  - hero mineral and score
  - "deeper than X% of redditors"
  - the core-sample chain as the per-layer log
  - the graveyard as the distribution (where everyone stopped)
  - a mineral/band legend
  - Copy result as the single primary action, then "Discuss in comments"

### Krillion detail worth copying in spirit
Krillion pins **real depth facts** to its descent ruler ("deepest scuba dive ever — 332m", "the Titanic rests here — 3,800m"). Do the same with **verified real geology facts per stratum** (e.g. how deep the deepest mines go, where coal forms). Every fact must be checked against a reliable source before it ships; don't invent numbers.

---

## 2. SteamWorld Dig 2: material and light for digging

### 10-steamworld-dig2-lamplit-tunnels.jpg ★ key reference
- **TAKE:**
  - **Painterly dirt texture** with visible clumps and cracks.
  - Tunnels read as **carved negative space**.
  - A **lamp vignette**: everything beyond the light radius falls to near-black.
  - Ore appears as small coloured clusters embedded in the dirt.
  - Warm pools of light around fixed lamps.
- **IGNORE:** characters, enemies, the HUD, the minimap, steampunk props, the orange-only palette.
- **USE IN:** Stratum rendering for the upper layers (Dirt, Clay), the shaft as carved negative space, and the headlamp vignette strength.

### 11-steamworld-dig2-crystal-cave-glow.jpg
- **TAKE:** **How a glowing material lights the rock around it.** The light bleeds outward, rims nearby edges, and the glow is brightest at its source and softly falls off.
- **IGNORE:** teal as a global palette, plants, mushrooms, the character.
- **USE IN:**
  - The Uranium core glow at the bottom, which lights the lowest strata green.
  - Mother Lode ore, whose glow lights the shaft walls for a moment.

### 12-steamworld-dig2-surface.jpg
- **TAKE:** A warm, sunlit **surface band sitting on a thick layered-ground band**. The top of the world is inviting and daylit, the opposite of the depths.
- **IGNORE:** desert, cacti, signs, cars, the robot, the sky clouds' style.
- **USE IN:** The Surface strip of the feed view and the top of the play world, with a warm daylight start that darkens with depth.

---

## 3. Dome Keeper: ore readability and per-layer palettes

### 13-dome-keeper-ore-nodes.jpg
- **TAKE:**
  - **Ore is instantly readable.** Small, bright, saturated nodes against muted, low-contrast rock.
  - A very restrained palette with a warm light halo around the player only.
- **IGNORE:** pixel art, the top-down maze layout, the HUD counters, the character.
- **USE IN:** Ore and fossil rendering rules. Rock stays muted; anything the player should notice (ore, rare fossils) is the only saturated thing on screen.

### 14-dome-keeper-layer-palette.jpg
- **TAKE:** **A deeper layer swaps its whole palette** (teal-grey rock, pink crystal clusters), so you know you're somewhere new at a glance.
- **IGNORE:** the maze layout, pixel rendering, the specific colours.
- **USE IN:** Each of the 10 strata gets its own palette identity, so the colour change on descending is unmistakable (and matches the tier colours in the HUD pips and share emoji).

---

## 4. Balatro: the score moment

### 15-balatro-score-moment.png ★ key reference
- **TAKE:**
  - **Scoring as spectacle.** Two chunky number blocks ("340" × "21,600") sit side by side, with flames on the multiplier.
  - A "X1.5 Mult" label pops above the play.
  - The numbers feel heavy and count up.
- **IGNORE:** cards, jokers, the casino theme, the swirling psychedelic background, pixel font, the side panel layout.
- **USE IN:** The rarity bonus line on a strike.
  1. Show the base points block ("75").
  2. Slam in the band block ("Mother Lode +100%").
  3. Count the total up into the HUD score.

  The bigger the band, the bigger the slam. Keep it in Unearth's mineral palette, with no flames unless they're ore sparks.

---

## 5. Puzzmo: typographic discipline and inline scoring

Source: Puzzmo's App Store screenshots (puzzmo.com itself couldn't be captured). These are marketing panels, so take only the details listed.

### 16-puzzmo-pileup-inline-scores.jpg
- **TAKE:**
  - **Score annotations sit beside each row** in small type ("$75 FLUSH"), with thin bracket marks grouping them.
  - The scoring explains itself without any popup.
  - A serif game title over a clean sans body.
- **IGNORE:** the mascot blob, cards, the marketing slogan, the yellow background.
- **USE IN:** The core-sample chain. Each cleared stratum gets a small side annotation, e.g. "+113 · VEIN".

### 17-puzzmo-flipart-identity.jpg
- **TAKE:**
  - **Brand discipline.** One small icon in a square frame, a serif wordmark under it, and one confident flat background colour.
  - The identity is simple enough to recognise as a thumbnail.
- **IGNORE:** the mascot, the pastel palette, the puzzle grid.
- **USE IN:** Unearth's wordmark and app icon (a pickaxe or core-sample mark in a frame), and the subreddit icon. Keep it recognisable at 32px.

---

## 6. Vintage geological survey prints: the core art direction

Both images are public domain.

### 18-survey-smith-strata-sketch.jpg ★ key reference
William Smith, *Sketch of the Succession of Strata and their relative Altitudes* (c.1815).
- **TAKE:**
  - **Hand-tinted strata.** Each band is a distinct flat watercolour tint, with a slightly darker edge line and tiny texture marks.
  - **Italic, hand-lettered labels written along the layers.**
  - Small annotated numbers (altitudes) placed directly on the drawing.
- **IGNORE:** the mountain profile and landscape silhouette, the specific place names.
- **USE IN:**
  - The look of every stratum (flat tint + darker contour + subtle texture).
  - Clue text lettered *on* the layer.
  - Small numbers annotated directly on the art (layer number, points).
  - The display typeface direction (an italic or engraved feel, not a generic sans).

### 19-survey-lithology-patterns.jpg ★ key reference
A standard stratigraphic column: limestone (brick), sandstone (dots), conglomerate (pebbles), shale (fine lines), plus a key column on the right.
- **TAKE:**
  - **Lithology patterns as textures.** Each stratum gets a printed pattern that reads even without colour.
  - The **lettered key column** at the side (A, B, C… with names).
- **IGNORE:** the black-and-white-only treatment; the specific rock list.
- **USE IN:**
  - Assign every Unearth stratum its own pattern (Dirt = speckle, Clay = fine horizontal lines, Stone = blocky brick, Coal = dense dark bands, and so on), drawn in code. This is cheap, distinctive, and an accessibility win (meaning never depends on colour alone).
  - The key column becomes the depth ruler and legend.

---

## 7. Mineral specimen photography: tier colour and surface quality

These set each tier's **colour, lustre and crystal shape**. Stylise them into icons and ore; never use photos in-game, and ignore all photo backgrounds and lighting set-ups.

| File | Tier | TAKE |
|---|---|---|
| 20-mineral-uranium-torbernite.jpg | **Uranium** | Deep emerald-to-acid green, flat tabular crystals stacked like plates. The Uranium glow should be *this* green (rich, slightly blue-green at the core), not neon lime. The glow is our stylisation; the real mineral doesn't glow. |
| 21-mineral-gold.jpg | **Gold** | Warm buttery yellow with *dark* reflections inside flat hexagonal plates, plus branching dendritic edges. Gold reads by contrast, not by being all-yellow. |
| 22-mineral-diamond.jpg | **Diamond** | A **rough octahedral** crystal: glassy, slightly cloudy, edges catching light. Use this shape, NOT the brilliant-cut emoji 💎 shape, so the icon feels geological. |
| 23-mineral-copper.jpg | **Copper** | Salmon-brown dendritic metal with small **green patina** spots. The patina is the detail that makes it read as copper, not "orange". |
| 24-mineral-silver.jpg | **Silver** | **Wire silver**: thin curling silver strands. A distinctive icon shape that no other game uses for "silver". |
| 25-mineral-coal-iridescent.jpg | **Coal** | Coal isn't dull black: under the headlamp it shows an **oil-slick iridescent sheen** (violet, blue, gold). Give the coal stratum and icon this sheen when lit. |

Tiers with no photo (Surface, Dirt, Clay, Stone, Iron) are drawn in code from the lithology patterns (image 19) and the palette.

---

## 8. Museum and field-guide labels: the core sample, end screen and share card

### 26-label-krantz-specimen-tag.jpg
- **TAKE:**
  - A **small printed label with a thin border** holding a number and dealer name.
  - A separate **handwritten name label**.
  - A big **number tag** ("66.").
  - Layered paper labels on a specimen box.
- **IGNORE:** the yellowed box, German text.
- **USE IN:** Each stratum entry in the end-screen chain. A bordered tag with layer number and mineral, the answer in a handwritten-feeling face, and the puzzle number as a big tag.

### 27-label-tied-specimen-tags.jpg
- **TAKE:**
  - **Tags tied on with string.**
  - A typed catalogue card with a formal number ("143.052.011").
  - A plain grid backdrop.
  - Handwritten entries in fields (Loc., Dat., Cat. no.).
- **IGNORE:** the bird, the museum name.
- **USE IN:**
  - The share card styled as a catalogued specimen (catalogue line "UNEARTH · No. 014 · LAYER 8 · GOLD", grid backdrop).
  - Optional string-tied tags on fossils when tapped.

### 28-label-painted-catalogue-number.jpg
- **TAKE:** A **catalogue number painted directly onto the specimen** (red on a white oval).
- **IGNORE:** the tray, the specific rock.
- **USE IN:** Marking the chiselled answer onto its stratum, and a small painted layer number on each cleared layer of the core sample.

---

## 9. What to hand to `/hallmark:hallmark study`

Don't study all 28. Study only the starred core set, one at a time, with this brief open:

1. `08-krillion-narrowing-rock-walls.jpg`: play composition
2. `09-krillion-end-screen.jpg`: end-screen structure
3. `04-krillion-tier-reveal-deep-cut.jpg`: reveal hierarchy
4. `10-steamworld-dig2-lamplit-tunnels.jpg`: material and light
5. `18-survey-smith-strata-sketch.jpg`: art direction and type
6. `19-survey-lithology-patterns.jpg`: strata textures
7. `15-balatro-score-moment.png`: score spectacle

Use the rest as supporting detail when building the specific element listed in its USE IN line.

---

## 10. Credits and licences

These files are **design references only**. Don't ship any of them in the game. If the repo is public, either keep `docs/references/images/` out of git or keep this credits section with it.

- **Game screenshots** (all © their owners, used here for internal reference only):
  - Krillion (krillion.io), captured by us
  - SteamWorld Dig 2 (Image & Form / Thunderful), Steam store
  - Dome Keeper (Bippinbits / Raw Fury), Steam store
  - Balatro (LocalThunk / Playstack), Steam store
  - Puzzmo (Puzzmo Inc.), App Store
- **Wikimedia Commons:**
  - 18, 19: William Smith, public domain
  - 20, 23, 24: Robert M. Lavinsky, CC BY-SA 3.0
  - 21: Peter D. Tillman, CC BY-SA 2.0
  - 22: James St. John, CC BY 2.0
  - 25: John Krygier, public domain
  - 26: Oliver Zauzig, CC BY-SA 3.0
  - 27: Naturalis Biodiversity Center, CC0
  - 28: கவிக்குமார் ப, CC BY-SA 4.0

  Source pages are listed in `fetch-originals.sh`.
