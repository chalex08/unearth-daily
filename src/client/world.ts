// The Phaser world: one placeholder rectangle per stratum (Surface + 10 layers) stacked down a
// vertical cross-section, and a camera that descends one layer at a time. Plain on purpose (PLAN
// step 5); step 7 replaces the rectangles with the real rock.
import * as Phaser from 'phaser';
import { MINERALS } from '../shared/game';

const STRATUM = 220;
// Placeholder greys, lighter at the surface and darker with depth.
const fill = (i: number) =>
  Phaser.Display.Color.GetColor(150 - i * 12, 140 - i * 12, 125 - i * 11);

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class World extends Phaser.Scene {
  private strata: Phaser.GameObjects.Rectangle[] = [];
  private labels: Phaser.GameObjects.Text[] = [];
  private answers: Phaser.GameObjects.Text[] = [];
  private layer = 0;
  private whole = false;
  private ready = false;

  constructor() {
    super('World');
  }

  create() {
    MINERALS.forEach((m, i) => {
      this.strata.push(
        this.add.rectangle(0, i * STRATUM, 1, STRATUM, fill(i)).setOrigin(0)
      );
      this.labels.push(
        this.add.text(12, i * STRATUM + 10, m.name, {
          fontSize: '14px',
          color: '#ffffffaa',
        })
      );
      this.answers.push(
        this.add
          .text(0, i * STRATUM + STRATUM / 2, '', {
            fontSize: '22px',
            color: '#ffffff',
          })
          .setOrigin(0.5)
      );
    });
    this.scale.on('resize', () => this.layout(false));
    this.ready = true;
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

  private layout(animate: boolean) {
    const { width, height } = this.scale;
    this.strata.forEach((r) => r.setSize(width, STRATUM));
    this.answers.forEach((t) => t.setX(width / 2));
    // RESIZE mode resizes the canvas but not the camera viewport.
    this.cameras.resize(width, height);
    const cam = this.cameras.main;
    const total = MINERALS.length * STRATUM;
    // Pulled back, the whole column fits the top 40%; the end panel covers the rest (#end in game.css).
    const zoom = this.whole ? Math.min(1, (height * 0.4) / total) : 1;
    const y = this.whole
      ? total / 2 + (height * 0.3) / zoom
      : // 40% down the screen: the gap between the HUD and the answer panel.
        this.layer * STRATUM + STRATUM / 2 + height * 0.1;
    if (animate && !reducedMotion()) {
      cam.zoomTo(zoom, 600, 'Sine.easeInOut', true);
      cam.pan(width / 2, y, 600, 'Sine.easeInOut', true);
    } else {
      cam.resetFX();
      cam.setZoom(zoom).centerOn(width / 2, y);
    }
  }
}
