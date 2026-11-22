// The Phaser world: one tinted, patterned stratum per mineral (Surface + 10) stacked down a vertical
// cross-section, a camera that descends one layer at a time, chiselled answers and other players'
// fossils. Look from docs/DESIGN.md; lighting, narrowing walls and the Uranium glow come in step 7.
import * as Phaser from 'phaser';
import type { Fossil } from '../shared/api';
import { MINERALS } from '../shared/game';
import { drawStratum, STRATA } from './strata';

const STRATUM = 220;
const TILE = 512;
export const DISPLAY = '"EB Garamond Variable", Georgia, serif';
// Where fossils sit: the sides of each stratum, clear of the chiselled answer in the middle.
const SPOTS = [
  [0.06, 0.27],
  [0.94, 0.27],
  [0.06, 0.8],
  [0.94, 0.8],
] as const;

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class World extends Phaser.Scene {
  private strata: Phaser.GameObjects.TileSprite[] = [];
  private bedrock: Phaser.GameObjects.Rectangle | null = null;
  private answers: Phaser.GameObjects.Text[] = [];
  private fossilTexts: Phaser.GameObjects.Text[] = [];
  private fossils: Fossil[][] = [];
  private layer = 0;
  private whole = false;
  private ready = false;
  /** The rock left showing on screen, [top, bottom] in px: between the HUD and the panel (game.ts). */
  gap = (): [number, number] => [0, this.scale.height * 0.4];

  constructor() {
    super('World');
  }

  create() {
    MINERALS.forEach((m, i) => {
      const tex = this.textures.createCanvas(`stratum-${i}`, TILE, STRATUM);
      if (tex) {
        drawStratum(tex.getContext(), i, TILE, STRATUM);
        tex.refresh();
      }
      const y = i * STRATUM;
      this.strata.push(
        this.add.tileSprite(0, y, 1, STRATUM, `stratum-${i}`).setOrigin(0)
      );
      // Smith-style lettering along the layer: number, then the name in italic.
      this.add.text(12, y + 12, `${i}  ${m.name}`, {
        fontFamily: DISPLAY,
        resolution: window.devicePixelRatio,
        fontStyle: 'italic',
        fontSize: '17px',
        color: STRATA[i]!.letter,
      });
      this.answers.push(
        this.add
          .text(0, y + STRATUM / 2, '', {
            fontFamily: DISPLAY,
            resolution: window.devicePixelRatio,
            fontSize: '26px',
            color: STRATA[i]!.letter,
          })
          .setOrigin(0.5)
      );
    });
    // A tap on empty rock closes an open fossil label.
    this.input.on('pointerdown', (_p: unknown, hit: unknown[]) => {
      if (hit.length === 0) this.drawFossils();
    });
    // Dark rock under Uranium so the shaft never ends in a void (the glow comes in step 7).
    this.bedrock = this.add
      .rectangle(
        0,
        MINERALS.length * STRATUM,
        1,
        STRATUM * 4,
        Phaser.Display.Color.HexStringToColor(STRATA.at(-1)!.edge).color
      )
      .setOrigin(0);
    this.scale.on('resize', () => this.layout(false));
    this.ready = true;
    this.drawFossils();
    this.layout(false);
  }

  /** Puts each cleared answer in its stratum and moves the camera to `layer` (0 = Surface). */
  dig(layer: number, cleared: string[], animate = true) {
    this.layer = layer;
    this.whole = false;
    this.answers.forEach((t, i) =>
      t.setText(i >= 1 ? (cleared[i - 1] ?? '') : '')
    );
    if (this.ready) this.layout(animate);
  }

  /** End of run: pull back to show the whole core sample (SPEC §6.6). */
  pullBack(cleared: string[]) {
    this.dig(0, cleared, false);
    this.whole = true;
    if (this.ready) this.layout(true);
  }

  /** Other players' answers at cleared layers, most found first (GET /api/stats). */
  setFossils(fossils: Fossil[][]) {
    this.fossils = fossils;
    if (this.ready) this.drawFossils();
  }

  private drawFossils(open?: Fossil) {
    this.fossilTexts.forEach((t) => t.destroy());
    this.fossilTexts = [];
    const { width } = this.scale;
    this.fossils.forEach((layer, i) =>
      layer.slice(0, SPOTS.length).forEach((f, j) => {
        const [sx, sy] = SPOTS[j]!;
        const unnamed = f.answer === 'something else';
        const shown = f === open;
        const t = this.add
          .text(
            sx * width,
            (i + 1) * STRATUM + sy * STRATUM,
            shown ? `${f.answer}  ${f.percent}%` : f.answer,
            {
              fontFamily: DISPLAY,
              resolution: window.devicePixelRatio,
              fontStyle: unnamed ? 'normal' : 'italic',
              // Sized by popularity: 15px for a rare one up to 28px for the answer everyone gave.
              // "something else" stays smallest: it is a bucket, not an answer.
              fontSize: `${unnamed ? 13 : Math.round(Math.min(28, 13 + Math.sqrt(f.percent) * 2.2))}px`,
              color: STRATA[i + 1]!.letter,
              padding: { x: 8, y: 10 },
            }
          )
          .setOrigin(sx < 0.5 ? 0 : 1, 0.5)
          .setAlpha(shown ? 1 : unnamed ? 0.35 : 0.6)
          .setInteractive({ useHandCursor: true });
        t.on('pointerdown', () => this.drawFossils(shown ? undefined : f));
        this.fossilTexts.push(t);
      })
    );
  }

  private layout(animate: boolean) {
    const { width, height } = this.scale;
    this.strata.forEach((r) => r.setSize(width, STRATUM));
    this.bedrock?.setSize(width, STRATUM * 4);
    this.answers.forEach((t) => t.setX(width / 2));
    this.drawFossils();
    // RESIZE mode resizes the canvas but not the camera viewport.
    this.cameras.resize(width, height);
    const cam = this.cameras.main;
    const total = MINERALS.length * STRATUM;
    // Centre the current stratum (or, pulled back, the whole column) in the rock left showing.
    const [top, bottom] = this.gap();
    const zoom = this.whole ? Math.min(1, ((bottom - top) * 0.92) / total) : 1;
    const target = this.whole ? total / 2 : this.layer * STRATUM + STRATUM / 2;
    const y = target + (height / 2 - (top + bottom) / 2) / zoom;
    if (animate && !reducedMotion()) {
      cam.zoomTo(zoom, 600, 'Sine.easeInOut', true);
      cam.pan(width / 2, y, 600, 'Sine.easeInOut', true);
    } else {
      cam.resetFX();
      cam.setZoom(zoom).centerOn(width / 2, y);
    }
  }
}
