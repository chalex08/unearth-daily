// The look of each stratum (docs/DESIGN.md): a flat tint, a darker edge line, a printed lithology
// pattern, and the saturated ore colour used for flecks, HUD pips, band blocks and strike tints.
// Index = mineral (0 = Surface), same as MINERALS. Hex, because Phaser and canvas both take it.

export type Stratum = {
  /** Flat watercolour tint of the rock. Muted on purpose: only ore is saturated. */
  tint: string;
  /** Darker contour along the top edge and the pattern marks. */
  edge: string;
  /** The ore: flecks in the rock, the HUD pip, the band block, the strike tint. */
  ore: string;
  /** Stratum name and chiselled answers lettered on the rock. */
  letter: string;
  pattern: Pattern;
};

type Pattern =
  | 'grass'
  | 'speckle'
  | 'lines'
  | 'brick'
  | 'bands'
  | 'dendrite'
  | 'pebbles'
  | 'wire'
  | 'plates'
  | 'octahedra'
  | 'stack';

const BONE = '#efe6d2';

export const STRATA: readonly Stratum[] = [
  {
    tint: '#a8925f',
    edge: '#7a6a3f',
    ore: '#8fb05a',
    letter: '#2a2216',
    pattern: 'grass',
  },
  {
    tint: '#5e4330',
    edge: '#3d2b1e',
    ore: '#c08a5c',
    letter: BONE,
    pattern: 'speckle',
  },
  {
    tint: '#87573a',
    edge: '#5e3b26',
    ore: '#e09a58',
    letter: BONE,
    pattern: 'lines',
  },
  {
    tint: '#5d5b57',
    edge: '#3f3e3b',
    ore: '#c4c0b6',
    letter: BONE,
    pattern: 'brick',
  },
  {
    tint: '#222026',
    edge: '#121115',
    ore: '#a497ea',
    letter: BONE,
    pattern: 'bands',
  },
  {
    tint: '#4f3a33',
    edge: '#33251f',
    ore: '#ec9a7c',
    letter: BONE,
    pattern: 'dendrite',
  },
  {
    tint: '#3a2e2c',
    edge: '#231b1a',
    ore: '#e07a5c',
    letter: BONE,
    pattern: 'pebbles',
  },
  {
    tint: '#3a3d42',
    edge: '#24262a',
    ore: '#e3e8ee',
    letter: BONE,
    pattern: 'wire',
  },
  {
    tint: '#3b352a',
    edge: '#25201a',
    ore: '#f0c64a',
    letter: BONE,
    pattern: 'plates',
  },
  {
    tint: '#2b3036',
    edge: '#1a1d21',
    ore: '#cfe3ea',
    letter: BONE,
    pattern: 'octahedra',
  },
  {
    tint: '#1f2b26',
    edge: '#111915',
    ore: '#3fd08f',
    letter: BONE,
    pattern: 'stack',
  },
];

/** Copper's green patina spots and coal's oil-slick sheen (REFERENCES §7). */
const PATINA = '#5fb39a';
const SHEEN = ['#8d7bd6', '#5f8fd0', '#c9a94a'];

// Small seeded RNG so every stratum draws the same way on every device.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws one tileable-across stratum: tint, edge line, pattern, ore flecks. */
export function drawStratum(
  ctx: CanvasRenderingContext2D,
  index: number,
  w: number,
  h: number
) {
  const s = STRATA[index]!;
  const r = rng(index * 7919 + 1);
  ctx.fillStyle = s.tint;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = s.edge;
  ctx.fillStyle = s.edge;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = 0.55;
  const dot = (x: number, y: number, rad: number) => {
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  switch (s.pattern) {
    case 'grass':
      for (let x = 2; x < w; x += 6) line(x, 10, x + r() * 4 - 2, 3 + r() * 4);
      for (let i = 0; i < (w * h) / 260; i++)
        dot(r() * w, 14 + r() * (h - 14), 0.5 + r() * 0.6);
      break;
    case 'speckle':
      for (let i = 0; i < (w * h) / 90; i++) dot(r() * w, r() * h, 0.6 + r());
      break;
    case 'lines':
      for (let y = 8; y < h; y += 5 + r() * 3) line(0, y, w, y);
      break;
    case 'brick':
      for (let y = 8, row = 0; y < h; y += 22, row++) {
        line(0, y, w, y);
        for (let x = row % 2 ? 0 : 24; x < w; x += 48) line(x, y, x, y + 22);
      }
      break;
    case 'bands':
      ctx.globalAlpha = 0.9;
      for (let y = 6; y < h; y += 9 + r() * 10) {
        ctx.lineWidth = 2 + r() * 4;
        line(0, y, w, y);
      }
      break;
    case 'dendrite':
      for (let i = 0; i < (w * h) / 900; i++) {
        const x = r() * w;
        const y = r() * h;
        line(x, y, x + 6, y - 6);
        line(x + 3, y - 3, x + 7, y - 1);
      }
      break;
    case 'pebbles':
      // Filled, as conglomerate is printed on a lithology column.
      ctx.globalAlpha = 0.4;
      for (let i = 0; i < (w * h) / 1000; i++) {
        ctx.beginPath();
        ctx.ellipse(
          r() * w,
          r() * h,
          3 + r() * 5,
          2 + r() * 3,
          r() * 3,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      break;
    case 'wire':
      for (let y = 10; y < h; y += 16) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 4)
          ctx.lineTo(x, y + Math.sin((x + y * 3) / 9) * 3);
        ctx.stroke();
      }
      break;
    case 'plates':
      for (let i = 0; i < (w * h) / 1900; i++) {
        const x = r() * w;
        const y = r() * h;
        const k = 6 + r() * 4;
        ctx.beginPath();
        for (let a = 0; a < 6; a++)
          ctx.lineTo(
            x + k * Math.cos((a * Math.PI) / 3),
            y + k * Math.sin((a * Math.PI) / 3)
          );
        ctx.closePath();
        ctx.stroke();
      }
      break;
    case 'octahedra':
      for (let i = 0; i < (w * h) / 1600; i++) {
        const x = r() * w;
        const y = r() * h;
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        ctx.moveTo(x - 4, y);
        ctx.lineTo(x + 4, y);
        ctx.stroke();
      }
      break;
    case 'stack':
      // Tabular plates of random length in loose stacks, so it never reads as Stone's brick.
      for (let y = 8; y < h; y += 12) {
        let x = r() * 20;
        while (x < w) {
          const len = 30 + r() * 50;
          ctx.strokeRect(x, y + r() * 3, len, 4);
          x += len + 10 + r() * 30;
        }
      }
      break;
  }
  // Edge line along the top, as on a hand-tinted section.
  ctx.globalAlpha = 1;
  ctx.fillStyle = s.edge;
  ctx.fillRect(0, 0, w, 2);
  ctx.globalAlpha = 0.35;
  ctx.fillRect(0, 2, w, 6);
  // Ore flecks: the only saturated marks in the rock.
  ctx.globalAlpha = 1;
  if (index > 0)
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle =
        index === 4 ? SHEEN[i % 3]! : index === 5 && i % 2 ? PATINA : s.ore;
      ctx.fillRect(Math.round(r() * w), Math.round(16 + r() * (h - 24)), 3, 2);
    }
}
