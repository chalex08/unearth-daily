import { requestExpandedMode } from '@devvit/web/client';

// Plain feed view until PLAN step 10 (strata teaser, first clue, player count).
document.getElementById('start-button')?.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});
