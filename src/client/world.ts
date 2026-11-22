// The Phaser world: one continuous vertical cross-section of earth, Surface to Uranium. Ten strata,
// each with its own printed texture, with a shaft cut through them that narrows one notch per layer.
// The current clue is carved on the rock face; cleared layers are a core sample embedded in the shaft;
// other players' answers sit in the walls as fossils. Everything is dark except the headlamp cone and
// the Uranium glow. Look and rules: docs/DESIGN.md.
//
// Performance: strata textures are drawn only when the camera is near them, light is one sprite plus
// four rectangles (no per-pixel lighting), nothing is redrawn while the camera is still, and the only
// particles are a capped handful of dust motes.
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
/** Strata further than this from the current layer have no texture yet. */
const NEAR = 3;
/** Radius, in lamp-texture px, of the lit hole in the darkness sprite. */
const HOLE = 120;
const PULSE_MS = 1800;
const DEPOSIT_H = 56;
const MAX_MOTES = 14;
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
      .setDepth(Z.back - 1);
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
    this.scale.on('resize', () => this.layout(false));
    // The canvas is K times the size of its box; keep it matched to the box.
    new ResizeObserver(() => {
      const box = this.game.canvas.parentElement;
      if (box && box.clientWidth > 0 && box.clientHeight > 0)
        this.scale.resize(
          Math.round(box.clientWidth * K),
          Math.round(box.clientHeight * K)
        );
    }).observe(this.game.canvas.parentElement ?? document.body);
    this.ready = true;
    document.body.dataset.carved = 'true';
    this.layout(false);
  }

  /** Moves to `layer` (1 to 10): the cleared links so far, and the clue to carve on this layer. */
  dig(layer: number, links: CoreLink[], clue: string | null, animate = true) {
    this.layer = layer;
    this.whole = false;
    this.links = links;
    this.clue = clue;
    // The first placement (a fresh load, or a resumed run) cuts to the layer instead of sliding there.
    if (this.ready) this.layout(animate && this.digs++ > 0);
  }

  /** End of run: light up and pull back to show the whole core sample (SPEC §6.6). `links` is all ten. */
  pullBack(links: CoreLink[]) {
    this.links = links;
    this.clue = null;
    this.layer = Math.max(1, links.filter((l) => l.answer).length);
    this.whole = true;
    if (this.ready) this.layout(true);
  }

  /** Other players' answers at cleared layers, most found first (GET /api/stats). */
  setFossils(fossils: Fossil[][]) {
    this.fossils = fossils;
    if (this.ready) this.drawFossils();
  }

  // ---- textures, all drawn in code ----

  private canvas(key: string, w: number, h: number, draw: DrawFn) {
    const tex = this.textures.createCanvas(key, w * K, h * K);
    if (!tex) return;
    const ctx = tex.getContext();
    ctx.scale(K, K);
    draw(ctx, w, h);
    tex.refresh();
  }

  private makeTextures() {
    // Daylight above the Surface: pale paper up high, warm at the horizon.
    this.canvas('sky', 4, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#d9d2b6');
      g.addColorStop(1, '#f2c47e');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
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
    this.canvas('glow', 256, 256, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // Black everywhere except a soft round hole: stretched to an ellipse it is the headlamp cone.
    this.canvas('lamp', 512, 512, (ctx, w, h) => {
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
    });
    this.canvas('solid', 4, 4, (ctx, w, h) => {
      ctx.fillStyle = '#070605';
      ctx.fillRect(0, 0, w, h);
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
    if (reducedMotion()) {
      this.glow.setAlpha(0.7);
      this.glowCore.setAlpha(0.8);
    } else {
      this.tweens.add({
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
    }
  }

  /** Draws a stratum's texture the first time the camera comes near it. */
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
    if (i === STRATA_COUNT - 1) this.makeDeposit();
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

  private layout(animate: boolean) {
    const vw = this.scale.width / K;
    const vh = this.scale.height / K;
    // RESIZE-less scaling resizes the canvas but not the camera viewport.
    this.cameras.resize(this.scale.width, this.scale.height);
    const [top, bottom] = this.gap();
    this.gapC = (top + bottom) / 2;

    for (let i = 0; i < STRATA_COUNT; i++) {
      if (this.whole || Math.abs(i - this.layer) <= NEAR) this.ensure(i);
      const rock = this.rocks[i];
      if (!rock) continue;
      const near = this.whole || Math.abs(i - this.layer) <= NEAR + 1;
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
    // One stratum ahead, once the camera has settled, so the next descent never stalls to draw.
    this.time.delayedCall(700, () => this.ensure(this.layer + NEAR + 1));

    this.sky.setPosition(vw / 2, 0).setDisplaySize(BLEED * 2 + vw, SKY);
    this.back.setSize(BLEED * 2 + vw, STRATA_COUNT * S + 3600);
    this.back.setPosition(-BLEED, -1200);
    this.bedrock
      .setPosition(-BLEED, STRATA_COUNT * S)
      .setSize(vw + BLEED * 2, S * 8);
    this.drawEdges(vw);
    this.drawCore(vw);
    this.aimLight(vw);
    this.drawFossils();

    // Pulled back: the whole column fits the rock left showing, lit. Otherwise the current stratum
    // is centred in it.
    const total = STRATA_COUNT * S;
    const zoom = this.whole ? Math.min(1, ((bottom - top) * 0.92) / total) : 1;
    const target = this.whole ? total / 2 : this.layer * S + S / 2;
    this.moveCamera(zoom, target, vw, vh, animate);
    this.setLift(this.whole ? 1 : 0, animate);
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
    animate: boolean
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
      duration: 600,
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
      const cw = Math.min(s - 28, 380);
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

      seg.label.setText(`${j}  ${MINERALS[j]!.name}`);
      seg.clue.setText(link?.clue ?? this.clue ?? '');
      seg.answer.setText(state === 'cleared' ? (link?.answer ?? '') : '');
      const current = state === 'current';
      seg.clue
        .setFontStyle(current ? 'bold' : 'normal')
        .setFontSize(current ? 21 : 14)
        .setColor(state === 'unreached' ? '#b8ae98' : BONE)
        .setAlpha(state === 'cleared' ? 0.85 : 1)
        .setWordWrapWidth(tw);
      seg.answer.setWordWrapWidth(tw);
      seg.clue.setShadow(0, 2, '#000000', current ? 3 : 0, false, true);

      // Stack label, clue, answer; shrink the stack to fit the segment on narrow shafts.
      const parts = [
        seg.label,
        seg.clue,
        ...(seg.answer.text ? [seg.answer] : []),
      ];
      const gapPx = 8;
      const stack = parts.reduce((n, t) => n + t.height + gapPx, -gapPx);
      const f = Math.min(1, (h - 20) / stack);
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
    const cam = this.cameras.main;
    if (!this.ready || (!this.dirty && cam.scrollY === this.lastY)) return;
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
      .setVisible(d > 0.01);
    this.warm
      .setPosition(vw / 2, lampY)
      .setAlpha(0.14 * (d / 0.96))
      .setVisible(d > 0.01);
    this.motes?.setPosition(vw / 2, lampY).setVisible(this.lift < 0.5);
    // The back wall takes the colour of the stratum the camera is passing through.
    const p = clamp(t, 0, STRATA_COUNT - 1.001);
    const i = Math.floor(p);
    this.back.setTint(
      mix(hex(STRATA[i]!.tint), hex(STRATA[i + 1]!.tint), p - i)
    );
  }

  // ---- fossils: other players' answers, as small objects in the walls ----

  private drawFossils(open?: Fossil) {
    this.fossilObjs.forEach((o) => o.destroy());
    this.fossilObjs = [];
    const vw = this.scale.width / K;
    this.fossils.forEach((layer, n) => {
      const i = n + 1;
      const s = shaftWidth(i, vw);
      const wall = (vw - s) / 2;
      // Beside the shaft where the lamp reaches, not out at the screen edge in the dark.
      const inset = Math.min(wall / 2, 56);
      layer.slice(0, 4).forEach((f, j) => {
        const unnamed = f.answer === 'something else';
        const left = j % 2 === 0;
        const x = left ? wall - inset : vw - wall + inset;
        const y = i * S + (j < 2 ? 0.3 : 0.72) * S;
        // Size by popularity; "something else" is a bucket, always the smallest pebble.
        const r = unnamed
          ? 6
          : clamp(
              6 + Math.sqrt(f.percent) * 1.9,
              6,
              Math.min(18, wall / 2 - 3)
            );
        const kind = unnamed ? 3 : Math.abs(hash(f.answer)) % 3;
        const key = this.fossilTexture(kind);
        const shown = f === open;
        const obj = this.add
          .image(x, y, key)
          .setDisplaySize(r * 2, r * 2)
          .setRotation(((hash(f.answer) % 60) * Math.PI) / 90)
          .setAlpha(shown ? 1 : unnamed ? 0.5 : 0.78)
          .setDepth(Z.fossil);
        // A padded circle, 44px across at least, so a thumb can find a small fossil.
        const hit = Math.max(r + 10, 22) * (64 / (r * 2));
        obj.setInteractive(
          new Phaser.Geom.Circle(32, 32, hit),
          Phaser.Geom.Circle.Contains
        );
        obj.on('pointerdown', () => this.drawFossils(shown ? undefined : f));
        this.fossilObjs.push(obj);

        const room = Math.min(wall - 10, 110);
        if (room >= 80 && !shown) {
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
                wordWrap: { width: room },
              })
              .setOrigin(0.5, 0)
              .setAlpha(unnamed ? 0.4 : 0.65)
              .setDepth(Z.fossil)
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
