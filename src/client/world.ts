// The Phaser world: one continuous vertical cross-section of earth, Surface to Uranium. Ten strata,
// each with its own printed texture, with a shaft cut through them that narrows one notch per layer.
// The current clue is carved on the rock face; cleared layers are a core sample embedded in the shaft;
// other players' answers sit in the walls as fossils. Everything is dark except the headlamp cone and
// the Uranium glow. Look and rules: docs/DESIGN.md.
//
// Performance: strata textures are drawn only when the camera is near them (the rest while idle),
// light is one sprite plus four rectangles (no per-pixel lighting), nothing is recomputed while the
// camera is still, Phaser renders at 30fps when nothing moves (60 during camera and light moves), and
// the only particles are a capped handful of dust motes.
import * as Phaser from 'phaser';
import type { Fossil } from '../shared/api';
import { MINERALS } from '../shared/game';
import {
  darkness,
  mix,
  shaftWidth,
  STRATA_COUNT,
  STRATUM as S,
} from './geometry';
import { drawStratum, STRATA } from './strata';
import { labelAt, STRIKE, WRONG, type Look } from './feel';

export const DISPLAY = '"EB Garamond Variable", Georgia, serif';
export const BODY =
  '"Atkinson Hyperlegible Next", ui-sans-serif, system-ui, sans-serif';

/** Canvas pixels per CSS pixel. Capped at 2: sharp rock on phones without a 9x fill cost at DPR 3. */
export const K = Math.min(window.devicePixelRatio || 1, 2);

/** One link of the core sample: a clue, and the player's answer once cleared. */
export type CoreLink = { clue: string; answer: string | null };

const TILE = 512;
const SKY = 900;
/** Rock and sky run this far past each side so a pulled-back camera never shows void. */
const BLEED = 4000;
/** Strata this close to the current layer are drawn at once; the rest wait for idle prefetch. */
const EAGER = 1;
/** Strata further than this from the current layer are hidden. */
const NEAR = 4;
/** Radius, in lamp-texture px, of the lit hole in the darkness sprite. */
const HOLE = 120;
const PULSE_MS = 1800;
const DEPOSIT_H = 56;
const MAX_MOTES = 14;
/** Fossils per stratum (the four spots on the walls); game.ts lists the same ones as text. */
export const FOSSILS_SHOWN = 4;
/** Rock showing (px) below which the clue moves from the rock face back into the recess. */
const MIN_CARVE = 170;
/** Below this scale (a long clue squeezed into a narrow deep shaft) the recess shows the clue instead. */
const MIN_CLUE_SCALE = 0.8;
/** Room the core segment leaves between itself and each wall, which fossils may use. */
const MARGIN = 14;
const BONE = '#efe6d2';
const URANIUM = 0x3fd08f;

const Z = {
  back: -10,
  rock: 0,
  edge: 2,
  core: 5,
  text: 6,
  fossil: 7,
  dark: 50,
  // Fossils sit above the darkness, or they'd be all but invisible: the rows of cleared layers are
  // outside the headlamp. Drawn faint instead, so they still read as embedded in the rock.
  fossilLit: 54,
  motes: 52,
  glow: 60,
  tag: 70,
};

const hex = (s: string) => Phaser.Display.Color.HexStringToColor(s).color;
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

// Small string hash, so a fossil keeps the same shape on every device and every reload.
const hash = (s: string) =>
  [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

type Rock = {
  left: Phaser.GameObjects.TileSprite;
  right: Phaser.GameObjects.TileSprite;
};

type Seg = {
  label: Phaser.GameObjects.Text;
  clue: Phaser.GameObjects.Text;
  answer: Phaser.GameObjects.Text;
};

export class World extends Phaser.Scene {
  private rocks: (Rock | undefined)[] = [];
  private segs: Seg[] = [];
  private edges!: Phaser.GameObjects.Graphics;
  private core!: Phaser.GameObjects.Graphics;
  private back!: Phaser.GameObjects.TileSprite;
  private sky!: Phaser.GameObjects.Image;
  private bedrock!: Phaser.GameObjects.Rectangle;
  private dark!: Phaser.GameObjects.Container;
  private lamp!: Phaser.GameObjects.Image;
  private lampRects: Phaser.GameObjects.Image[] = [];
  private warm!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Image;
  private glowCore!: Phaser.GameObjects.Image;
  private deposit: Phaser.GameObjects.Image | null = null;
  private motes: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private fossilObjs: Phaser.GameObjects.GameObject[] = [];
  private fossils: Fossil[][] = [];
  private links: CoreLink[] = [];
  private clue: string | null = null;
  private layer = 1;
  private whole = false;
  private ready = false;
  private lift = 0;
  private dirty = true;
  private placed = false;
  private digs = 0;
  private camZ = 1;
  private camT = 0;
  private gapC = 0;
  private lastY = Number.NaN;
  private move: Phaser.Tweens.Tween | null = null;
  private liftTween: Phaser.Tweens.Tween | null = null;
  private intro: Phaser.Time.TimerEvent | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;
  /** What each text last rendered, so a layout only re-renders text that actually changed. */
  private painted = new Map<Phaser.GameObjects.Text, string>();
  /** World width and data the fossils were last drawn for. */
  private fossilKey = '';
  /** Whether the current clue is carved on the rock (true) or shown in the recess (too little rock showing). */
  private carved = false;
  private prefetching = false;
  /** Whether the first placement should open on the Surface (a fresh run, from game.ts). */
  private opening = false;
  private pulse: Phaser.Tweens.Tween | null = null;
  /** Whether the loop currently runs at 60fps (something moving) rather than 30. */
  private fast = true;
  /** The gap the last layout aimed at, so a panel resize that doesn't change it costs nothing. */
  private gapKey = '';
  /** Height (px) the carved clue's label and text need, and the scale they fit at; from drawCore. */
  private need = 0;
  private clueScale = 1;
  private fossilData = '';
  /** Transient strike and wrong-answer objects and timers, cleared when the next layer or answer comes. */
  private temp: Phaser.GameObjects.GameObject[] = [];
  private timers: Phaser.Time.TimerEvent[] = [];
  /** Ore marks stay in the rock for the run. shortcut: not re-laid out if the width changes, fine for a phone run. */
  private marks: Phaser.GameObjects.GameObject[] = [];
  /** The loop runs at 60fps until this time (ms, scene clock) while a strike or bounce plays. */
  private busyUntil = 0;

  /** The rock left showing on screen, [top, bottom] in CSS px: between the HUD and the panel (game.ts). */
  gap = (): [number, number] => [0, (this.scale.height / K) * 0.4];

  constructor() {
    super('World');
  }

  create() {
    this.makeTextures();
    this.sky = this.add
      .image(0, 0, 'sky')
      .setOrigin(0.5, 1)
      // In front of the back wall, which runs up past the ground line because it scrolls slower.
      .setDepth(Z.back + 1);
    this.back = this.add
      .tileSprite(0, -1200, 1, 1, 'back')
      .setOrigin(0)
      .setTileScale(1 / K)
      .setScrollFactor(1, 0.86)
      .setDepth(Z.back);
    this.bedrock = this.add
      .rectangle(
        0,
        STRATA_COUNT * S,
        1,
        S * 8,
        mix(hex(STRATA.at(-1)!.edge), 0, 0.4)
      )
      .setOrigin(0)
      .setDepth(Z.rock);
    this.edges = this.add.graphics().setDepth(Z.edge);
    this.core = this.add.graphics().setDepth(Z.core);

    const text = (style: Phaser.Types.GameObjects.Text.TextStyle) =>
      this.add
        .text(0, 0, '', { resolution: K, ...style })
        .setOrigin(0.5, 0)
        .setDepth(Z.text)
        .setVisible(false);
    for (let j = 1; j < STRATA_COUNT; j++)
      this.segs[j] = {
        label: text({
          fontFamily: DISPLAY,
          fontStyle: 'italic',
          fontSize: '17px',
          color: STRATA[j]!.ore,
        }),
        clue: text({
          fontFamily: BODY,
          fontSize: '14px',
          color: BONE,
          align: 'center',
        }),
        answer: text({
          fontFamily: DISPLAY,
          fontSize: '26px',
          color: BONE,
          align: 'center',
        }),
      };

    this.makeLight();
    // A tap on empty rock closes an open fossil label.
    this.input.on('pointerdown', (_p: unknown, hit: unknown[]) => {
      if (hit.length === 0) this.drawFossils();
    });
    // Phaser also fires this from its own window resize listener, so a keyboard opening mid-descent
    // lands here: a running move retargets from where it is instead of snapping to its end.
    this.scale.on('resize', () => this.layout(this.animating()));
    // The canvas is K times the size of its box; keep it matched to the box. Debounced: a mobile
    // keyboard animates the box height for ~300ms, and reallocating the canvas every frame of that
    // would stutter. Meanwhile the old canvas is just clipped or short by a few px.
    new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        const box = this.game.canvas.parentElement;
        if (box && box.clientWidth > 0 && box.clientHeight > 0)
          this.scale.resize(
            Math.round(box.clientWidth * K),
            Math.round(box.clientHeight * K)
          );
      }, 100);
    }).observe(this.game.canvas.parentElement ?? document.body);
    this.ready = true;
    this.layout(false);
    if (this.digs > 0) this.startIntro();
  }

  /** Moves to `layer` (1 to 10): the cleared links so far, and the clue to carve on this layer. */
  dig(
    layer: number,
    links: CoreLink[],
    clue: string | null,
    animate = true,
    opening = false
  ) {
    this.clearTemp();
    this.layer = layer;
    this.whole = false;
    this.links = links;
    this.clue = clue;
    this.intro?.remove();
    this.intro = null;
    // The first placement (a fresh load, or a resumed run) cuts to the layer instead of sliding
    // there. Counted even before the scene exists, since /api/start can answer before Phaser starts.
    const first = this.digs++ === 0;
    if (first) this.opening = opening;
    if (!this.ready) return;
    this.layout(animate && !first);
    if (first) this.startIntro();
  }

  /**
   * A fresh run (game.ts says which) opens in daylight on the Surface, then the camera sinks into
   * layer 1, so the change from daylight to headlamp is seen once. Resumed runs and reduced motion go
   * straight to the layer. While the opening waits, layout() keeps the camera on the Surface, so a
   * resize (or the ResizeObserver's first call) doesn't cut it short.
   */
  private startIntro() {
    if (!this.opening || reducedMotion()) return;
    this.opening = false;
    this.intro = this.time.delayedCall(450, () => {
      this.intro = null;
      this.layout(true, 1600);
    });
    this.layout(false);
  }

  /** The panels changed height (a wrapped line, the reveal): re-aim only if the rock showing changed. */
  relayout() {
    if (this.ready && this.gap().join() !== this.gapKey)
      this.layout(this.animating());
  }

  private animating() {
    return Boolean(this.move?.isPlaying() || this.liftTween?.isPlaying());
  }

  /** End of run: light up and pull back to show the whole core sample (SPEC §6.6). `links` is all ten. */
  pullBack(links: CoreLink[]) {
    this.clearTemp();
    this.links = links;
    this.clue = null;
    this.layer = Math.max(1, links.filter((l) => l.answer).length);
    this.whole = true;
    this.intro?.remove();
    this.intro = null;
    if (this.ready) this.layout(true);
  }

  /** Other players' answers at cleared layers, most found first (GET /api/stats). */
  setFossils(fossils: Fossil[][]) {
    // Stats are fetched after every strike; most of the time nothing a player can see has changed.
    const data = JSON.stringify(fossils);
    if (data === this.fossilData) return;
    this.fossilData = data;
    this.fossils = fossils;
    this.fossilKey = '';
    if (this.ready) this.drawFossils();
  }

  // ---- textures, all drawn in code ----

  /** A canvas texture drawn at `k` px per world px (K by default; 1 for smooth gradients). */
  private canvas(key: string, w: number, h: number, draw: DrawFn, k = K) {
    const tex = this.textures.createCanvas(key, w * k, h * k);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.scale(k, k);
    draw(ctx, w, h);
    tex.refresh();
  }

  private makeTextures() {
    // Daylight above the Surface: pale paper up high, warm at the horizon.
    this.canvas(
      'sky',
      4,
      256,
      (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#d9d2b6');
        g.addColorStop(1, '#f2c47e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
      1
    );
    // The back wall of the shaft, seen through the opening and moving slower than the walls
    // (parallax). Grey on purpose: it is tinted with the stratum colour as the camera descends.
    this.canvas('back', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8a857e';
      ctx.fillRect(0, 0, w, h);
      let seed = 12345;
      const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // Every mark is drawn again one tile over each way, so the tile has no seam.
      const wrap = (draw: (dx: number, dy: number) => void) => {
        for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) draw(dx, dy);
      };
      for (let i = 0; i < 46; i++) {
        ctx.globalAlpha = 0.08 + r() * 0.12;
        ctx.fillStyle = r() < 0.5 ? '#000' : '#fff';
        const [x, y, rx, ry, a] = [
          r() * w,
          r() * h,
          10 + r() * 30,
          6 + r() * 18,
          r() * 3,
        ];
        wrap((dx, dy) => {
          ctx.beginPath();
          ctx.ellipse(x + dx, y + dy, rx, ry, a, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = '#000';
      for (let i = 0; i < 12; i++) {
        const pts: [number, number][] = [[r() * w, r() * h]];
        for (let k = 0; k < 4; k++) {
          const [px, py] = pts.at(-1)!;
          pts.push([px + r() * 22 - 11, py + 6 + r() * 14]);
        }
        wrap((dx, dy) => {
          ctx.beginPath();
          pts.forEach(([px, py]) => ctx.lineTo(px + dx, py + dy));
          ctx.stroke();
        });
      }
    });
    this.canvas(
      'glow',
      256,
      256,
      (ctx, w, h) => {
        const g = ctx.createRadialGradient(
          w / 2,
          h / 2,
          0,
          w / 2,
          h / 2,
          w / 2
        );
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
      1
    );
    // Black everywhere except a soft round hole: stretched to an ellipse it is the headlamp cone.
    this.canvas(
      'lamp',
      512,
      512,
      (ctx, w, h) => {
        ctx.fillStyle = '#070605';
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'destination-out';
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, HOLE);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(0.4, 'rgba(0,0,0,0.92)');
        g.addColorStop(0.75, 'rgba(0,0,0,0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
      1
    );
    this.canvas(
      'solid',
      4,
      4,
      (ctx, w, h) => {
        ctx.fillStyle = '#070605';
        ctx.fillRect(0, 0, w, h);
      },
      1
    );
    // A rock chip for debris and rubble: a rough white polygon, tinted per use.
    this.canvas('chip', 6, 6, (ctx) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0.5, 2);
      ctx.lineTo(3, 0);
      ctx.lineTo(5.5, 3);
      ctx.lineTo(3.5, 6);
      ctx.lineTo(1, 5);
      ctx.closePath();
      ctx.fill();
    });
    // The pickaxe, the HUD icon's shape, in bone with a dark rim.
    this.canvas('pick', 64, 64, (ctx) => {
      ctx.lineCap = 'round';
      for (const [colour, width] of [
        ['rgba(0,0,0,0.6)', 9],
        [BONE, 5],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(8, 24);
        ctx.quadraticCurveTo(32, -2, 56, 24);
        ctx.moveTo(32, 12);
        ctx.lineTo(32, 60);
        ctx.stroke();
      }
    });
    this.canvas('mote', 6, 6, (ctx) => {
      ctx.fillStyle = BONE;
      ctx.beginPath();
      ctx.arc(3, 3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  private makeLight() {
    this.lamp = this.add.image(0, 0, 'lamp');
    // Same texture pipeline as the lamp sprite, so the fill matches it exactly at any alpha.
    this.lampRects = [0, 1, 2, 3].map(() => this.add.image(0, 0, 'solid'));
    this.dark = this.add
      .container(0, 0, [this.lamp, ...this.lampRects])
      .setDepth(Z.dark);
    this.warm = this.add
      .image(0, 0, 'glow')
      .setTint(0xffc27a)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Z.dark + 1);
    // The Uranium glow: additive, above the darkness, so it lights the rock around it.
    this.glow = this.add
      .image(0, 0, 'glow')
      .setTint(URANIUM)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Z.glow);
    this.glowCore = this.add
      .image(0, 0, 'glow')
      .setTint(0x8ff5cf)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(Z.glow);
    this.pulse = this.tweens.add({
      targets: [this.glow, this.glowCore],
      alpha: { from: 0.5, to: 0.85 },
      duration: PULSE_MS,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
    this.motes = this.add
      .particles(0, 0, 'mote', {
        lifespan: 4500,
        frequency: 380,
        maxAliveParticles: MAX_MOTES,
        speed: { min: 2, max: 9 },
        angle: { min: 200, max: 340 },
        scale: { start: 0.7 / K, end: 0.2 / K },
        alpha: { start: 0.5, end: 0 },
        x: { min: -150, max: 150 },
        y: { min: -110, max: 110 },
      })
      .setDepth(Z.motes);
    // Reduced motion: a steady glow and no dust. Followed live, if the setting changes mid-run.
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (query.matches) {
        this.pulse?.pause();
        this.glow.setAlpha(0.7);
        this.glowCore.setAlpha(0.8);
        this.motes?.stop(true);
      } else {
        this.pulse?.resume();
        this.motes?.start();
      }
    };
    query.addEventListener('change', apply);
    apply();
  }

  /** Draws a stratum's texture the first time the camera comes near it (or idle prefetch reaches it). */
  private ensure(i: number) {
    if (this.rocks[i] || i < 0 || i >= STRATA_COUNT) return;
    this.canvas(`stratum-${i}`, TILE, S, (ctx, w, h) =>
      drawStratum(ctx, i, w, h)
    );
    const tile = () =>
      this.add
        .tileSprite(0, i * S, 1, S, `stratum-${i}`)
        .setOrigin(0)
        .setTileScale(1 / K)
        .setDepth(Z.rock);
    this.rocks[i] = { left: tile(), right: tile() };
    this.placeRock(i, this.scale.width / K);
    if (i === STRATA_COUNT - 1) {
      this.makeDeposit();
      this.drawCore(this.scale.width / K);
    }
  }

  /** Sizes stratum `i`'s two walls either side of the shaft, and shows them only near the camera. */
  private placeRock(i: number, vw: number) {
    const rock = this.rocks[i];
    if (!rock) return;
    const near = this.whole || Math.abs(i - this.layer) <= NEAR;
    const s = shaftWidth(i, vw);
    const l = (vw - s) / 2;
    rock.left
      .setVisible(near)
      .setPosition(-BLEED, i * S)
      .setSize(l + BLEED, S)
      .setTilePosition(-BLEED * K, 0);
    rock.right
      .setVisible(near)
      .setPosition(l + s, i * S)
      .setSize(vw - l - s + BLEED, S)
      .setTilePosition((l + s) * K, 0);
  }

  /**
   * Draws the strata the player hasn't reached yet, one at a time with gaps between, while the camera
   * is still. So no descent waits on a texture, and the end-of-run pull-back doesn't draw seven at once.
   */
  private prefetch() {
    if (this.move?.isPlaying() || this.intro) {
      this.time.delayedCall(400, () => this.prefetch());
      return;
    }
    // Nearest first, deeper before shallower.
    const missing = [...Array(STRATA_COUNT).keys()]
      .filter((i) => !this.rocks[i])
      .sort(
        (a, b) => Math.abs(a - this.layer) - Math.abs(b - this.layer) || b - a
      );
    if (missing.length === 0) return;
    this.ensure(missing[0]!);
    this.time.delayedCall(250, () => this.prefetch());
  }

  /** Stacked tabular plates of Uranium at the foot of the last shaft (REFERENCES §7, torbernite). */
  private makeDeposit() {
    this.canvas('uranium', 260, DEPOSIT_H, (ctx, w, h) => {
      const rows = 5;
      const rh = h / rows;
      for (let r = 0; r < rows; r++) {
        const inset = (rows - 1 - r) * 22 + (r % 2) * 8;
        const y = h - (r + 1) * rh;
        const shear = 10;
        ctx.beginPath();
        ctx.moveTo(inset + shear, y);
        ctx.lineTo(w - inset, y);
        ctx.lineTo(w - inset - shear, y + rh - 2);
        ctx.lineTo(inset, y + rh - 2);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, y, 0, y + rh);
        g.addColorStop(0, '#6fe8b4');
        g.addColorStop(1, '#14805a');
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = '#0a3a2a';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(inset + shear + 4, y + 1, 26, 2);
      }
    });
    this.deposit = this.add
      .image(0, 0, 'uranium')
      .setOrigin(0.5, 1)
      .setDepth(Z.fossil);
  }

  // ---- layout: size, state, camera ----

  private layout(animate: boolean, duration = 600) {
    const vw = this.scale.width / K;
    const vh = this.scale.height / K;
    // RESIZE-less scaling resizes the canvas but not the camera viewport.
    this.cameras.resize(this.scale.width, this.scale.height);

    for (let i = 0; i < STRATA_COUNT; i++) {
      if (this.whole || Math.abs(i - this.layer) <= EAGER) this.ensure(i);
      this.placeRock(i, vw);
    }
    // The core first: it measures what the carved clue needs, which decides where the clue goes.
    this.drawCore(vw);
    const [top, bottom] = this.fitClue(vw);
    this.gapC = (top + bottom) / 2;
    this.gapKey = [top, bottom].join();
    if (!this.prefetching) {
      this.prefetching = true;
      this.time.delayedCall(700, () => this.prefetch());
    }

    this.sky.setPosition(vw / 2, 0).setDisplaySize(BLEED * 2 + vw, SKY);
    this.back.setSize(BLEED * 2 + vw, STRATA_COUNT * S + 3600);
    this.back.setPosition(-BLEED, -1200);
    this.bedrock
      .setPosition(-BLEED, STRATA_COUNT * S)
      .setSize(vw + BLEED * 2, S * 8);
    this.drawEdges(vw);
    this.aimLight(vw);
    this.drawFossils();

    // Pulled back: the whole column fits the rock left showing, lit. Waiting to open a fresh run:
    // the Surface. Otherwise the current stratum is centred in the rock left showing.
    const total = STRATA_COUNT * S;
    const zoom = this.whole ? Math.min(1, ((bottom - top) * 0.92) / total) : 1;
    const target = this.whole
      ? total / 2
      : this.intro
        ? -S * 0.15
        : this.layer * S + S / 2;
    this.moveCamera(zoom, target, vw, vh, animate, duration);
    this.setLift(this.whole ? 1 : 0, animate);
  }

  /**
   * Carves the clue on the rock only when enough rock is showing to read it (a phone with its keyboard
   * up can leave ~100px), and only when it doesn't have to shrink much to fit its niche. Otherwise
   * the recess shows the DOM clue, as before step 7. Returns the gap, measured again if the recess
   * changed height. Stable: showing the DOM clue only shrinks the gap.
   */
  private fitClue(vw: number): [number, number] {
    let gap = this.gap();
    const fits =
      gap[1] - gap[0] >= Math.max(MIN_CARVE, this.need) &&
      this.clueScale >= MIN_CLUE_SCALE;
    if (fits !== this.carved) {
      this.carved = fits;
      document.body.toggleAttribute('data-carved', fits);
      gap = this.gap();
      this.drawCore(vw);
    }
    return gap;
  }

  /**
   * Sets a text's content and style. Renders once when only one of them changed (the usual case),
   * twice when both did, and not at all when neither did.
   */
  private paint(
    t: Phaser.GameObjects.Text,
    text: string,
    style: Phaser.Types.GameObjects.Text.TextStyle
  ) {
    if (t.text !== text) t.setText(text);
    const key = JSON.stringify(style);
    if (this.painted.get(t) === key) return;
    this.painted.set(t, key);
    // With updateText on, setStyle recomputes the font metrics before it renders; with it off, a
    // font-size change would lay out with the old size's line height.
    t.style.setStyle(style, true);
  }

  /**
   * One tween moves zoom and centre together, so a pull-back never shows bedrock mid-way. Plain lerps of
   * (zoom, target); the screen offset to the middle of the gap is recomputed from the zoom each frame.
   */
  private moveCamera(
    z: number,
    target: number,
    vw: number,
    vh: number,
    animate: boolean,
    duration = 600
  ) {
    this.move?.stop();
    const cam = this.cameras.main;
    const apply = (zz: number, tt: number) => {
      this.camZ = zz;
      this.camT = tt;
      cam.setZoom(K * zz);
      cam.centerOn(vw / 2, tt + (vh / 2 - this.gapC) / zz);
      this.dirty = true;
    };
    const [z0, t0] = [this.camZ, this.camT];
    if (!animate || !this.placed || reducedMotion()) {
      this.placed = true;
      return apply(z, target);
    }
    this.move = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        const k = tw.getValue() ?? 1;
        apply(z0 + (z - z0) * k, t0 + (target - t0) * k);
      },
    });
  }

  private setLift(to: number, animate: boolean) {
    this.liftTween?.stop();
    if (!animate || reducedMotion()) {
      this.lift = to;
      this.dirty = true;
      return;
    }
    const from = this.lift;
    this.liftTween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 900,
      ease: 'Sine.easeInOut',
      onUpdate: (tw) => {
        this.lift = from + (to - from) * (tw.getValue() ?? 1);
        this.dirty = true;
      },
    });
  }

  /** Shaft edges: a darker carved lip and an inner shadow, and a lit ledge where the shaft steps in. */
  private drawEdges(vw: number) {
    const g = this.edges.clear();
    for (let i = 0; i < STRATA_COUNT; i++) {
      const st = STRATA[i]!;
      const y = i * S;
      const s = shaftWidth(i, vw);
      const l = (vw - s) / 2;
      g.fillStyle(0x000000, 0.32)
        .fillRect(l, y, 14, S)
        .fillRect(l + s - 14, y, 14, S);
      g.fillStyle(hex(st.edge), 1)
        .fillRect(l - 3, y, 3, S)
        .fillRect(l + s, y, 3, S);
      if (i > 0) {
        const prev = (vw - shaftWidth(i - 1, vw)) / 2;
        g.fillStyle(mix(hex(st.tint), 0xffffff, 0.3), 0.6)
          .fillRect(prev - 3, y, l - prev + 3, 2)
          .fillRect(vw - l, y, l - prev + 3, 2);
      }
    }
  }

  /** The core sample in the shaft: a segment per layer, joined; the current clue carved in its niche. */
  private drawCore(vw: number) {
    const g = this.core.clear();
    this.need = 0;
    this.clueScale = 1;
    for (let j = 1; j < STRATA_COUNT; j++) {
      const seg = this.segs[j]!;
      const link = this.links[j - 1];
      const state = link?.answer
        ? 'cleared'
        : !this.whole && j === this.layer && this.clue !== null
          ? 'current'
          : this.whole && link
            ? 'unreached'
            : 'none';
      for (const t of [seg.label, seg.clue, seg.answer])
        t.setVisible(state !== 'none');
      if (state === 'none') continue;

      const st = STRATA[j]!;
      const s = shaftWidth(j, vw);
      const cw = Math.min(s - MARGIN * 2, 380);
      const x = (vw - cw) / 2;
      const h = j === STRATA_COUNT - 1 ? S - DEPOSIT_H : S;
      const y = j * S;
      const ore = hex(st.ore);
      const tw = cw - 26;
      if (state === 'cleared') {
        g.fillStyle(mix(hex(st.tint), 0x000000, 0.5), 1).fillRect(x, y, cw, h);
        g.fillStyle(ore, 1).fillRect(x, y, 5, h);
        g.fillStyle(0xefe6d2, 0.2).fillRect(x + 5, y, cw - 5, 1);
      } else if (state === 'current') {
        // The niche the clue is cut into: dark enough that it reads the same on every stratum.
        g.fillStyle(0x000000, 0.58).fillRect(x, y, cw, h);
        g.lineStyle(2, ore, 1).strokeRect(x + 1, y + 1, cw - 2, h - 2);
      } else {
        g.lineStyle(2, 0xefe6d2, 0.3).strokeRect(x + 1, y + 1, cw - 2, h - 2);
      }

      const current = state === 'current';
      this.paint(seg.label, `${j}  ${MINERALS[j]!.name}`, {});
      this.paint(seg.clue, link?.clue ?? this.clue ?? '', {
        fontStyle: current ? 'bold' : 'normal',
        fontSize: current ? '21px' : '14px',
        color: state === 'unreached' ? '#b8ae98' : BONE,
        wordWrap: { width: tw },
        shadow: {
          offsetX: 0,
          offsetY: 2,
          color: '#000000',
          blur: current ? 3 : 0,
          fill: current,
        },
      });
      this.paint(seg.answer, state === 'cleared' ? (link?.answer ?? '') : '', {
        wordWrap: { width: tw },
      });
      seg.clue.setAlpha(state === 'cleared' ? 0.85 : 1);
      const gapPx = 8;
      if (current) {
        // What the carved label and clue need, measured even while the recess has the clue.
        const tall = seg.label.height + gapPx + seg.clue.height;
        this.clueScale = Math.min(
          1,
          (h - 20) / tall,
          tw / Math.max(seg.label.width, seg.clue.width)
        );
        this.need = tall * this.clueScale + 20;
      }
      // Too little rock showing to read the carved clue: the recess shows it instead.
      seg.clue.setVisible(!current || this.carved);

      // Stack label, clue, answer; shrink the stack to fit the segment's height, and its width
      // too, since word wrap never breaks a long single word ("pomegranate" on a 320px phone).
      const parts = [
        seg.label,
        ...(seg.clue.visible ? [seg.clue] : []),
        ...(seg.answer.text ? [seg.answer] : []),
      ];
      const stack = parts.reduce((n, t) => n + t.height + gapPx, -gapPx);
      const f = Math.min(
        1,
        (h - 20) / stack,
        tw / Math.max(...parts.map((t) => t.width))
      );
      let cy = y + (h - stack * f) / 2;
      for (const t of parts) {
        t.setScale(f).setPosition(x + 5 + (cw - 5) / 2, cy);
        cy += (t.height + gapPx) * f;
      }
    }
    this.deposit
      ?.setPosition(vw / 2, STRATA_COUNT * S - 2)
      .setDisplaySize(
        Math.min(shaftWidth(STRATA_COUNT - 1, vw) * 0.92, 260),
        DEPOSIT_H
      );
  }

  /** Sizes the headlamp cone to the current shaft and puts the Uranium glow at the foot of the last. */
  private aimLight(vw: number) {
    const rx = shaftWidth(this.layer, vw) * 0.5 + 140;
    const ry = S * 1.05;
    const [sx, sy] = [rx / HOLE, ry / HOLE];
    this.lamp.setDisplaySize(512 * sx, 512 * sy);
    const [hw, hh] = [256 * sx, 256 * sy];
    const far = 6000;
    const rects: [number, number, number, number][] = [
      [0, -hh - far / 2, far * 6, far],
      [0, hh + far / 2, far * 6, far],
      [-hw - far / 2, 0, far, hh * 2],
      [hw + far / 2, 0, far, hh * 2],
    ];
    this.lampRects.forEach((r, i) => {
      const [x, y, w, h] = rects[i]!;
      r.setPosition(x, y).setDisplaySize(w, h);
    });
    this.warm.setDisplaySize(rx * 2.4, ry * 2.4);
    const base = STRATA_COUNT * S;
    this.glow.setPosition(vw / 2, base - 20).setDisplaySize(1100, 900);
    this.glowCore.setPosition(vw / 2, base - 24).setDisplaySize(300, 220);
    this.dirty = true;
  }

  /** Every frame the camera moves: the lamp follows the gap, and darkness, back-wall colour and dust follow depth. */
  override update() {
    if (!this.ready) return;
    // Half the frames (and GPU energy) while nothing moves: most of a run is spent typing. The
    // glow pulse and the dust still read fine at 30. Checked here so no path can forget to switch.
    const fast =
      this.animating() || this.intro !== null || this.time.now < this.busyUntil;
    if (fast !== this.fast) {
      this.fast = fast;
      this.game.loop.setFPSLimit(fast ? 60 : 30);
    }
    const cam = this.cameras.main;
    if (!this.dirty && cam.scrollY === this.lastY) return;
    this.dirty = false;
    this.lastY = cam.scrollY;
    const vw = this.scale.width / K;
    const vh = this.scale.height / K;
    const z = cam.zoom / K;
    const lampY = cam.scrollY + cam.height / 2 + (this.gapC - vh / 2) / z;
    const t = lampY / S;
    const d = darkness(t) * (1 - 0.92 * this.lift);
    this.dark
      .setPosition(vw / 2, lampY)
      .setAlpha(d)
      .setVisible(d > 0.08);
    this.warm
      .setPosition(vw / 2, lampY)
      .setAlpha(0.14 * (d / 0.96))
      .setVisible(d > 0.08);
    this.motes?.setPosition(vw / 2, lampY).setVisible(this.lift < 0.5);
    // The back wall takes the colour of the stratum the camera is passing through.
    const p = clamp(t, 0, STRATA_COUNT - 1.001);
    const i = Math.floor(p);
    this.back.setTint(
      mix(hex(STRATA[i]!.tint), hex(STRATA[i + 1]!.tint), p - i)
    );
  }

  // ---- feel: strike and wrong answer (timings in feel.ts, written up in DESIGN §13) ----

  private after(ms: number, fn: () => void) {
    this.timers.push(this.time.delayedCall(ms, fn));
  }

  private keep<T extends Phaser.GameObjects.GameObject>(o: T) {
    this.temp.push(o);
    return o;
  }

  private clearTemp() {
    this.timers.forEach((t) => t.remove());
    this.timers = [];
    for (const o of this.temp) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.temp = [];
  }

  /** Fades `o` from 0 to `to` and does nothing else: the reduced-motion version of every pop and slide. */
  private fadeIn(
    o: Phaser.GameObjects.Components.AlphaSingle,
    to: number,
    ms: number
  ) {
    o.setAlpha(0);
    this.tweens.add({ targets: o, alpha: to, duration: ms });
  }

  /**
   * A correct answer at `layer`: the pickaxe swings in and hits, the screen shakes, chips fly, the
   * answer is chiselled into the stratum, the band shows as ore in the rock, then a short score label.
   * The camera descends when game.ts calls dig() after STRIKE.hold. `label` is the label's lines.
   */
  strike(layer: number, answer: string, look: Look, label: string[]) {
    if (!this.ready) return;
    this.clearTemp();
    const reduce = reducedMotion();
    const vw = this.scale.width / K;
    const [cx, top] = [vw / 2, layer * S];
    const cy = top + S / 2;
    const st = STRATA[layer]!;
    const ore = hex(st.ore);
    const rank = ['Common', 'Seam', 'Vein', 'Mother Lode'].indexOf(look);
    const hold = STRIKE.hold[look];
    this.busyUntil = this.time.now + hold;

    // The pickaxe swings in from the upper right.
    const pick = this.keep(
      this.add
        .image(cx + 70, cy - 70, 'pick')
        .setDisplaySize(56, 56)
        .setDepth(Z.tag)
    );
    if (reduce) {
      pick.setPosition(cx + 8, cy - 6).setRotation(0.2);
      this.fadeIn(pick, 1, STRIKE.impact);
    } else {
      pick.setRotation(-1.2);
      this.tweens.add({
        targets: pick,
        x: cx + 8,
        y: cy - 6,
        rotation: 0.2,
        duration: STRIKE.impact,
        ease: 'Cubic.easeIn',
      });
    }

    this.after(STRIKE.impact, () => {
      this.tweens.add({ targets: pick, alpha: 0, duration: 150 });
      if (!reduce) {
        this.cameras.main.shake(STRIKE.shake, STRIKE.shakeBy[look]);
        const spark = this.keep(
          this.add
            .image(cx, cy, 'glow')
            .setTint(0xfff2cf)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(40, 40)
            .setDepth(Z.tag)
        );
        this.tweens.add({
          targets: spark,
          alpha: { from: 1, to: 0 },
          displayWidth: 120,
          displayHeight: 120,
          duration: 170,
        });
        // Rock chips in the stratum's colours, with ore among them once there is any.
        const chips = this.keep(
          this.add
            .particles(cx, cy, 'chip', {
              emitting: false,
              lifespan: 480,
              speed: { min: 90, max: 240 },
              angle: { min: 200, max: 340 },
              gravityY: 700,
              rotate: { min: 0, max: 360 },
              scale: { start: 1.3 / K, end: 0.4 / K },
              alpha: { start: 1, end: 0 },
              tint: [
                mix(hex(st.tint), 0xffffff, 0.25),
                hex(st.edge),
                ...(rank ? [ore, ore] : []),
              ],
            })
            .setDepth(Z.tag)
        );
        chips.explode(10 + rank * 5);
      }
      // The answer is chiselled into the stratum: the niche becomes a cleared segment.
      this.links = [
        ...this.links.slice(0, layer - 1),
        { clue: this.clue ?? '', answer },
      ];
      this.clue = null;
      this.drawCore(vw);
      const text = this.segs[layer]!.answer;
      const to = text.scale;
      text.setAlpha(0);
      this.tweens.add({
        targets: text,
        alpha: 1,
        ...(reduce ? {} : { scale: { from: to * 1.3, to } }),
        duration: STRIKE.chisel,
        ease: 'Cubic.easeOut',
      });
    });

    this.after(STRIKE.ore, () =>
      this.showOre(layer, answer, look, cx, vw, reduce)
    );
    this.after(labelAt(look), () => {
      const s = shaftWidth(layer, vw);
      const text = this.keep(
        this.add
          .text(cx, cy, label.join('\n'), {
            resolution: K,
            fontFamily: BODY,
            fontSize: '15px',
            color: BONE,
            align: 'center',
            lineSpacing: 3,
            wordWrap: { width: Math.min(s - 40, 300) },
          })
          .setOrigin(0.5)
          .setDepth(Z.tag + 1)
      );
      const plate = this.keep(
        this.add
          .rectangle(cx, cy, text.width + 24, text.height + 16, 0x070605, 0.94)
          .setStrokeStyle(2, ore, 1)
          .setDepth(Z.tag)
      );
      for (const o of [plate, text]) {
        this.fadeIn(o, o === plate ? 0.94 : 1, STRIKE.labelIn);
        this.after(hold - STRIKE.labelOut, () =>
          this.tweens.add({ targets: o, alpha: 0, duration: STRIKE.labelOut })
        );
      }
      if (!reduce)
        this.tweens.add({
          targets: [plate, text],
          y: { from: cy + 6, to: cy },
          duration: STRIKE.labelIn,
          ease: 'Cubic.easeOut',
        });
    });
  }

  /** The band, as ore in the rock: rubble, a seam, a cracked vein, or glowing ore that lights the walls. */
  private showOre(
    layer: number,
    answer: string,
    look: Look,
    cx: number,
    vw: number,
    reduce: boolean
  ) {
    const st = STRATA[layer]!;
    const ore = hex(st.ore);
    const ms = STRIKE.oreMs[look];
    const s = shaftWidth(layer, vw);
    const half = s / 2 + 90;
    const y = layer * S + S * 0.8;
    let seed = Math.abs(hash(answer)) || 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const mark = <T extends Phaser.GameObjects.GameObject>(o: T) => {
      this.marks.push(o);
      return o;
    };

    if (look === 'Common') {
      // Dull rubble on the floor of the segment.
      for (let i = 0; i < 8; i++) {
        const size = 4 + rnd() * 5;
        const chip = mark(
          this.add
            .image(
              cx + (rnd() * 2 - 1) * (s / 2 - MARGIN),
              layer * S + S - 8 - rnd() * 12,
              'chip'
            )
            .setDisplaySize(size, size)
            .setRotation(rnd() * 6)
            .setTint(mix(hex(st.tint), 0x000000, 0.2 + rnd() * 0.3))
            .setDepth(8)
        );
        this.fadeIn(chip, 0.9, ms);
      }
      return;
    }

    if (look === 'Seam') {
      // A thin coloured line across the shaft and into both walls.
      const seam = mark(
        this.add
          .rectangle(cx, y, half * 2, 3, ore)
          .setRotation(0.03)
          .setDepth(8)
      );
      if (reduce) this.fadeIn(seam, 1, ms);
      else
        this.tweens.add({
          targets: seam,
          scaleX: { from: 0, to: 1 },
          duration: ms,
          ease: 'Cubic.easeOut',
        });
      return;
    }

    // Vein and Mother Lode: a bright cracked vein, drawn lit (above the darkness) and additive.
    const g = mark(
      this.add.graphics().setDepth(Z.glow).setBlendMode(Phaser.BlendModes.ADD)
    );
    for (let v = 0; v < (look === 'Vein' ? 1 : 2); v++) {
      const vy = y - v * 26;
      const pts: [number, number][] = Array.from({ length: 10 }, (_, i) => [
        cx - half + ((half * 2) / 9) * i,
        vy + (i === 0 || i === 9 ? 0 : (rnd() - 0.5) * 22),
      ]);
      const cracks = [3, 6].map((i): [number, number, number, number] => {
        const [bx, by] = pts[i]!;
        return [
          bx,
          by,
          bx + (rnd() - 0.5) * 40,
          by + (rnd() < 0.5 ? -1 : 1) * (14 + rnd() * 14),
        ];
      });
      for (const [w, a] of [
        [9, 0.25],
        [3, 1],
      ] as const) {
        g.lineStyle(w, ore, a)
          .beginPath()
          .moveTo(...pts[0]!);
        pts.slice(1).forEach(([px, py]) => g.lineTo(px, py));
        g.strokePath();
        for (const [x0, y0, x1, y1] of cracks)
          g.beginPath().moveTo(x0, y0).lineTo(x1, y1).strokePath();
      }
    }
    // The bright horizontal seam line across the whole screen (DESIGN §10).
    const line = mark(
      this.add
        .rectangle(cx, y, vw + 400, 2, ore)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(Z.glow)
    );
    this.fadeIn(g, 1, ms);
    this.fadeIn(line, 0.9, ms);
    this.tweens.add({ targets: line, alpha: 0.35, delay: ms, duration: 400 });

    if (look === 'Mother Lode') {
      // The lode lights the walls: a wide ore-coloured glow that flares, then settles.
      const lode = mark(
        this.add
          .image(cx, y, 'glow')
          .setTint(ore)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(s + 520, S * 1.8)
          .setDepth(Z.glow)
      );
      this.fadeIn(lode, 0.9, ms);
      this.tweens.add({ targets: lode, alpha: 0.4, delay: ms, duration: 900 });
    }
  }

  /** A wrong answer: the word flies at the wall, clinks, bounces off, and the rock cracks. */
  bounce(word: string) {
    if (!this.ready) return;
    this.clearTemp();
    const reduce = reducedMotion();
    const vw = this.scale.width / K;
    const s = shaftWidth(this.layer, vw);
    const cy = this.layer * S + S / 2;
    // Which wall it hits varies with the word, so repeated misses don't all land in one place.
    const side = Math.abs(hash(word)) % 2 ? 1 : -1;
    const wallX = vw / 2 + side * (s / 2 - 4);
    this.busyUntil = this.time.now + WRONG.hit + WRONG.bounce + 60;
    const text = this.keep(
      this.add
        .text(vw / 2, cy + 40, word, {
          resolution: K,
          fontFamily: DISPLAY,
          fontStyle: 'italic',
          fontSize: '24px',
          color: BONE,
          wordWrap: { width: s - 40 },
        })
        .setOrigin(0.5)
        .setShadow(0, 2, '#000000', 3, false, true)
        .setDepth(Z.tag)
    );
    if (reduce) {
      text.setPosition(wallX, cy);
      this.fadeIn(text, 1, WRONG.hit);
    } else {
      this.tweens.add({
        targets: text,
        x: wallX,
        y: cy,
        duration: WRONG.hit,
        ease: 'Cubic.easeIn',
      });
    }
    this.after(WRONG.hit, () => {
      // The crack fans out into the wall.
      const crack = this.keep(this.add.graphics().setDepth(9));
      let seed = Math.abs(hash(word)) || 1;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const rays = Array.from({ length: 4 }, () => {
        const ang = (rnd() - 0.5) * 2.2 + (side > 0 ? 0 : Math.PI);
        let [x, y] = [wallX + side * 6, cy + (rnd() - 0.5) * 16];
        const pts: [number, number][] = [[x, y]];
        for (let k = 0; k < 3; k++) {
          x += Math.cos(ang + (rnd() - 0.5) * 0.9) * (12 + rnd() * 10);
          y += Math.sin(ang + (rnd() - 0.5) * 0.9) * (12 + rnd() * 10);
          pts.push([x, y]);
        }
        return pts;
      });
      for (const [w, colour, a] of [
        [3, 0x000000, 0.85],
        [1, 0xefe6d2, 0.45],
      ] as const) {
        crack.lineStyle(w, colour, a);
        for (const pts of rays) {
          crack.beginPath().moveTo(...pts[0]!);
          pts.slice(1).forEach(([px, py]) => crack.lineTo(px, py));
          crack.strokePath();
        }
      }
      this.fadeIn(crack, 1, 60);
      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: WRONG.bounce,
        ease: 'Quad.easeOut',
        ...(reduce
          ? {}
          : { x: wallX - side * s * 0.2, y: cy + 46, rotation: -side * 0.5 }),
      });
    });
  }

  // ---- fossils: other players' answers, as small objects in the walls ----

  /** Redraws the fossils only when the width, the data, the open one or the pull-back changed. */
  private drawFossils(open?: Fossil) {
    const vw = this.scale.width / K;
    const key = `${vw}|${this.whole}|${open ? this.fossils.flat().indexOf(open) : -1}`;
    if (key === this.fossilKey) return;
    this.fossilKey = key;
    this.fossilObjs.forEach((o) => o.destroy());
    this.fossilObjs = [];
    this.fossils.forEach((layer, n) => {
      const i = n + 1;
      const s = shaftWidth(i, vw);
      const wall = (vw - s) / 2;
      // The rock plus the strip of shaft beside the core segment. On a phone the upper walls are
      // only ~20px wide, so a fossil may sit half out of the wall, as if eroding from it.
      const room = wall + MARGIN;
      layer.slice(0, FOSSILS_SHOWN).forEach((f, j) => {
        const unnamed = f.answer === 'something else';
        const left = j % 2 === 0;
        // Beside the shaft where the lamp reaches, not out at the screen edge in the dark.
        const off = Math.max(room / 2, wall - 56);
        const x = left ? off : vw - off;
        const y = i * S + (j < 2 ? 0.3 : 0.72) * S;
        // Size by popularity; "something else" is a bucket, always the smallest pebble.
        const r = unnamed
          ? 6
          : clamp(
              6 + Math.sqrt(f.percent) * 1.9,
              6,
              Math.min(18, room / 2 - 2)
            );
        const kind = unnamed ? 3 : Math.abs(hash(f.answer)) % 3;
        const key = this.fossilTexture(kind);
        const shown = f === open;
        const obj = this.add
          .image(x, y, key)
          .setDisplaySize(r * 2, r * 2)
          .setRotation(((hash(f.answer) % 60) * Math.PI) / 90)
          .setAlpha(shown ? 1 : unnamed ? 0.4 : 0.6)
          .setDepth(Z.fossilLit);
        this.fossilObjs.push(obj);
        // Pulled back at the end, the column is ~0.1 scale: a name or a tag there can't be read,
        // so the fossils are only marks in the rock (the end screen and the hidden list have the data).
        if (this.whole) return;
        // A padded circle, 44px across at least, so a thumb can find a small fossil. Phaser tests it
        // in the frame's own pixels, and the frame is 64·K px (canvas() draws at K).
        const hit = (Math.max(r + 10, 22) * 64 * K) / (r * 2);
        obj.setInteractive(
          new Phaser.Geom.Circle(32 * K, 32 * K, hit),
          Phaser.Geom.Circle.Contains
        );
        obj.on('pointerdown', () => this.drawFossils(shown ? undefined : f));

        const labelW = Math.min(wall - 10, 110);
        if (labelW >= 80 && !shown) {
          // Room in the rock: the name sits under the object, faint.
          this.fossilObjs.push(
            this.add
              .text(x, y + r + 3, f.answer, {
                resolution: K,
                fontFamily: DISPLAY,
                fontStyle: unnamed ? 'normal' : 'italic',
                fontSize: '13px',
                color: STRATA[i]!.letter,
                align: 'center',
                wordWrap: { width: labelW },
              })
              .setOrigin(0.5, 0)
              .setAlpha(unnamed ? 0.35 : 0.5)
              .setDepth(Z.fossilLit)
          );
        }
        if (shown) this.fossilObjs.push(...this.tag(f, x, y - r - 6, vw));
      });
    });
  }

  /** The tapped fossil's name and percent, on a small plate above everything, so it is always readable. */
  private tag(f: Fossil, x: number, y: number, vw: number) {
    const label = this.add
      .text(0, 0, `${f.answer}  ${f.percent}%`, {
        resolution: K,
        fontFamily: DISPLAY,
        fontStyle: 'italic',
        fontSize: '17px',
        color: BONE,
        align: 'center',
        wordWrap: { width: vw - 28 },
      })
      .setOrigin(0.5, 1)
      .setDepth(Z.tag + 1);
    const w = label.width + 16;
    const cx = clamp(x, w / 2 + 6, vw - w / 2 - 6);
    label.setPosition(cx, y - 2);
    const plate = this.add
      .rectangle(cx, y + 2, w, label.height + 8, 0x070605, 0.92)
      .setOrigin(0.5, 1)
      .setStrokeStyle(1, 0xefe6d2, 0.5)
      .setDepth(Z.tag);
    return [plate, label];
  }

  /** Four fossil shapes, drawn once on first use: ammonite, trilobite, frond, and a plain pebble. */
  private fossilTexture(kind: number) {
    const key = `fossil-${kind}`;
    if (this.textures.exists(key)) return key;
    this.canvas(key, 64, 64, (ctx) => {
      const draw = (colour: string, grow: number) => {
        ctx.strokeStyle = colour;
        ctx.fillStyle = colour;
        ctx.lineWidth = 5 + grow;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        if (kind === 0) {
          for (let a = 0; a <= Math.PI * 5; a += 0.1)
            ctx.lineTo(
              32 + Math.cos(a) * (2 + a * 1.75),
              32 + Math.sin(a) * (2 + a * 1.75)
            );
          ctx.stroke();
        } else if (kind === 1) {
          ctx.ellipse(32, 34, 13 + grow, 25 + grow, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === 2) {
          ctx.moveTo(32, 60);
          ctx.lineTo(32, 6);
          for (let y = 14; y < 56; y += 9) {
            ctx.moveTo(32, y + 6);
            ctx.lineTo(14, y - 4);
            ctx.moveTo(32, y + 6);
            ctx.lineTo(50, y - 4);
          }
          ctx.stroke();
        } else {
          ctx.moveTo(14, 36);
          ctx.bezierCurveTo(10, 14, 40, 8, 52, 24);
          ctx.bezierCurveTo(60, 42, 34, 58, 18, 50);
          ctx.closePath();
          ctx.fill();
        }
      };
      // Dark rim first, so the bone shape stays readable on every stratum.
      draw('rgba(0,0,0,0.55)', 3);
      draw(BONE, 0);
      if (kind === 1) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 2;
        for (let y = 20; y < 58; y += 7) {
          ctx.beginPath();
          ctx.moveTo(22, y);
          ctx.lineTo(42, y);
          ctx.stroke();
        }
      }
    });
    return key;
  }
}

type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
