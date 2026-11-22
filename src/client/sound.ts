// Sound (Howler) and haptics. Files are original, made by tools/make-sounds.ts (README credits).
// Muting is remembered locally and applies whenever the tab is hidden too.
import { Howl, Howler } from 'howler';

const KEY = 'unearth.muted';
const file = (name: string, volume: number, loop = false) =>
  new Howl({ src: [`sounds/${name}.wav`], volume, loop });

const sfx = {
  strike: file('strike', 0.8),
  clink: file('clink', 0.55),
  descend: file('descend', 0.5),
  chime: file('chime', 0.6),
};
const hum = file('hum', 0.35, true);

let muted = false;
try {
  muted = localStorage.getItem(KEY) === '1';
} catch {
  // Storage can be blocked in a webview; the toggle then lasts for the session.
}
const apply = () => Howler.mute(muted || document.hidden);
document.addEventListener('visibilitychange', apply);
apply();

export const isMuted = () => muted;
export function setMuted(on: boolean) {
  muted = on;
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // see above
  }
  apply();
}

export const play = (name: keyof typeof sfx) => void sfx[name].play();

/** The Uranium hum: loops while the player is on layer 10. Howler queues it until the first tap unlocks audio. */
let humId: number | undefined;
export function setHum(on: boolean) {
  if (on && humId === undefined) humId = hum.play();
  if (!on && humId !== undefined) {
    const id = humId;
    humId = undefined;
    hum.once('fade', () => hum.stop(id), id);
    hum.fade(0.35, 0, 400, id);
  }
}

/** A short vibration where the device supports it (not iOS). Skipped with reduced motion. */
export function buzz(pattern: number | number[]) {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    navigator.vibrate?.(pattern);
}
