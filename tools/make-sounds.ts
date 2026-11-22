// Synthesises the five game sounds into public/sounds/*.wav. Original work, released CC0 (README credits).
// Run: node tools/make-sounds.ts. Mono 16-bit at a low sample rate keeps each file under ~60KB.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../public/sounds/', import.meta.url));
const TAU = Math.PI * 2;

let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** Renders `secs` of audio at `rate`, sample by sample: f(time, progress 0..1) in -1..1. */
function render(
  secs: number,
  rate: number,
  f: (t: number, p: number) => number
) {
  const n = Math.round(secs * rate);
  const pcm = Buffer.alloc(44 + n * 2);
  pcm.write('RIFF', 0);
  pcm.writeUInt32LE(36 + n * 2, 4);
  pcm.write('WAVEfmt ', 8);
  pcm.writeUInt32LE(16, 16);
  pcm.writeUInt16LE(1, 20); // PCM
  pcm.writeUInt16LE(1, 22); // mono
  pcm.writeUInt32LE(rate, 24);
  pcm.writeUInt32LE(rate * 2, 28);
  pcm.writeUInt16LE(2, 32);
  pcm.writeUInt16LE(16, 34);
  pcm.write('data', 36);
  pcm.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, f(i / rate, i / n)));
    pcm.writeInt16LE(Math.round(s * 32000), 44 + i * 2);
  }
  return pcm;
}

const decay = (t: number, k: number) => Math.exp(-t * k);
const sine = (t: number, hz: number) => Math.sin(TAU * hz * t);

mkdirSync(out, { recursive: true });
const sounds: Record<string, Buffer> = {
  // A pick biting rock: a low thump under a short burst of grit.
  strike: render(0.3, 22050, (t) => {
    const low = noise();
    return (
      0.7 * sine(t, 150 - t * 160) * decay(t, 14) +
      0.5 * low * decay(t, 30) +
      0.2 * noise() * decay(t, 12)
    );
  }),
  // Steel skittering off stone: a few inharmonic partials, ringing out fast.
  clink: render(0.28, 22050, (t) => {
    const e = decay(t, 18);
    return (
      e *
      (0.4 * sine(t, 2210) + 0.3 * sine(t, 3170) + 0.25 * sine(t, 4630)) *
      Math.min(1, t * 900)
    );
  }),
  // The camera sinking: a falling rumble with a breath of dust.
  descend: render(0.55, 22050, (t, p) => {
    const env = Math.sin(Math.PI * p) ** 1.5;
    return env * (0.5 * sine(t, 130 - 80 * p) + 0.25 * noise() * (1 - p) ** 2);
  }),
  // Mother Lode: a small bell, three partials.
  chime: render(1.0, 22050, (t) => {
    const e = Math.min(1, t * 400);
    return (
      e *
      (0.5 * sine(t, 880) * decay(t, 3.5) +
        0.3 * sine(t, 1320) * decay(t, 5) +
        0.2 * sine(t, 1760) * decay(t, 7))
    );
  }),
  // Uranium: a low, slow beating drone. 1.2s with whole cycles of every partial, so it loops without a click.
  hum: render(1.2, 11025, (t) => {
    const beat = 0.75 + 0.25 * sine(t, 5);
    return beat * (0.5 * sine(t, 55) + 0.3 * sine(t, 110) + 0.1 * sine(t, 165));
  }),
};

for (const [name, wav] of Object.entries(sounds)) {
  writeFileSync(`${out}${name}.wav`, wav);
  console.log(`${name}.wav ${(wav.length / 1024).toFixed(1)}KB`);
}
