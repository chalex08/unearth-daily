import { describe, expect, it } from 'vitest';
import { darkness, mix, shaftWidth, STRATA_COUNT } from './geometry';

describe('shaft', () => {
  it('narrows one notch per layer, on a phone and on desktop', () => {
    for (const vw of [320, 390, 1400]) {
      const widths = Array.from({ length: STRATA_COUNT }, (_, i) =>
        shaftWidth(i, vw)
      );
      widths.slice(1).forEach((w, i) => expect(w).toBeLessThan(widths[i]!));
      // Tight by the bottom, but never closed.
      expect(widths.at(-1)! / widths[0]!).toBeGreaterThan(0.4);
      expect(widths.at(-1)! / widths[0]!).toBeLessThan(0.5);
    }
  });

  it('always fits inside the screen with a gutter, capped on wide screens', () => {
    expect(shaftWidth(0, 320)).toBe(296);
    expect(shaftWidth(0, 2000)).toBe(560);
  });
});

describe('darkness', () => {
  it('is daylight at the surface and only darkens with depth', () => {
    expect(darkness(-1)).toBe(0);
    expect(darkness(0)).toBe(0);
    for (let t = 0; t < 11; t += 0.5)
      expect(darkness(t + 0.5)).toBeGreaterThan(darkness(t));
    expect(darkness(11)).toBeLessThan(0.97);
  });
});

describe('mix', () => {
  it('blends colours channel by channel', () => {
    expect(mix(0x000000, 0xffffff, 0)).toBe(0x000000);
    expect(mix(0x000000, 0xffffff, 1)).toBe(0xffffff);
    expect(mix(0x102030, 0x304050, 0.5)).toBe(0x203040);
  });
});
