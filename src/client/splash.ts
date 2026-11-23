import { requestExpandedMode } from '@devvit/web/client';
import type { FeedResponse } from '../shared/api';
import { drawStratum, STRATA } from './strata';

// The feed card (SPEC §6.1): only a tap on Play opens the game; nothing here is tracked.
document.getElementById('start-button')?.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

const text = (id: string, value: string) => {
  const e = document.getElementById(id);
  if (e) e.textContent = value;
};

// Number, date, players and clue 1. If this fails the card keeps its tagline and Play still works.
void fetch('/api/feed')
  .then(async (r): Promise<FeedResponse | null> => (r.ok ? r.json() : null))
  .then((f) => {
    if (!f) return;
    text('number', `#${f.puzzleNumber}`);
    text(
      'date',
      new Date(f.date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    );
    text(
      'players',
      f.closed
        ? 'Closed, today’s dig has its own post'
        : f.players === 0
          ? 'Be the first digger today'
          : `${f.players} ${f.players === 1 ? 'digger' : 'diggers'} so far`
    );
    text('clue', f.clue);
    const label = document.getElementById('clue-label');
    if (label) label.hidden = false;
    if (f.closed) text('start-button', 'See your dig');
  })
  .catch(() => undefined);

// Clue 1 sits on Dirt's ore bar, the first segment of the core sample in the game.
document.body.style.setProperty('--ore', STRATA[1]!.ore);

// The strata column, drawn by the same code as the world, one band per mineral.
const canvas = document.getElementById('strata');
if (canvas instanceof HTMLCanvasElement) {
  const draw = () => {
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const band = canvas.height / STRATA.length;
    STRATA.forEach((_, i) => {
      ctx.save();
      ctx.translate(0, Math.round(i * band));
      drawStratum(ctx, i, canvas.width, Math.ceil(band));
      ctx.restore();
    });
  };
  new ResizeObserver(draw).observe(canvas);
}
