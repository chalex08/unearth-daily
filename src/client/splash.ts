import { requestExpandedMode } from '@devvit/web/client';
import { drawStratum, STRATA } from './strata';

// Holding feed view until PLAN step 10 (first clue, number, date, player count).
document.getElementById('start-button')?.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

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
