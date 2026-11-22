// The shape of the shaft and the light in it, as pure functions so they can be tested without Phaser.

/** Height of one stratum, in world px (1 world px = 1 CSS px at zoom 1). */
export const STRATUM = 220;
/** Surface plus ten layers. */
export const STRATA_COUNT = 11;
/** How much narrower the shaft gets per layer: layer 10 is 45% of the Surface mouth. */
const NOTCH = 0.055;
/** The widest the shaft mouth gets, so desktop walls stay thick enough to feel like rock. */
const MAX_SHAFT = 560;

/** Shaft width at stratum `i` on a world `vw` px wide: one notch narrower per layer. */
export function shaftWidth(i: number, vw: number): number {
  const full = Math.min(vw - 24, MAX_SHAFT);
  return Math.round(full * (1 - NOTCH * i));
}

/**
 * How dark the world is at `t`, a depth measured in strata from the top of the Surface (t = layer + 0.5
 * at the middle of a layer). 0 in daylight, easing toward 0.96 so the deep rock is never pure black.
 */
export function darkness(t: number): number {
  return 0.96 * (1 - Math.exp(-Math.max(0, t) / 3.2));
}

/** Mixes two 0xRRGGBB colours. */
export function mix(a: number, b: number, k: number): number {
  const ch = (shift: number) =>
    Math.round(
      ((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * k
    );
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
