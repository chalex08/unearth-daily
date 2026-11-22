import { describe, expect, it } from 'vitest';
import { labelAt, STRIKE, WRONG_MS, type Look } from './feel';

const BANDS: Look[] = ['Common', 'Seam', 'Vein', 'Mother Lode'];

describe('feel timings', () => {
  it('lets you type again in under 600ms after a wrong answer', () => {
    expect(WRONG_MS).toBeLessThan(600);
  });

  it('lingers longer on rarer bands, and the label fits before the hold ends', () => {
    for (const [i, band] of BANDS.entries()) {
      const next = BANDS[i + 1];
      if (next) {
        expect(STRIKE.hold[next]).toBeGreaterThan(STRIKE.hold[band]);
        expect(STRIKE.oreMs[next]).toBeGreaterThan(STRIKE.oreMs[band]);
        expect(STRIKE.shakeBy[next]).toBeGreaterThan(STRIKE.shakeBy[band]);
      }
      expect(
        labelAt(band) + STRIKE.labelIn + STRIKE.labelOut
      ).toBeLessThanOrEqual(STRIKE.hold[band]);
    }
  });
});
