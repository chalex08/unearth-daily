import { describe, expect, it } from 'vitest';
import {
  applyAnswer,
  BAND_RARITY,
  BANDS,
  checkAnswer,
  currentLayer,
  currentStreak,
  dayKey,
  layerPoints,
  rarityBand,
  runStatus,
  scoreRun,
  shareText,
  startRun,
  updateStreak,
} from './game';
import type { RarityBand, RunState } from './game';
import { puzzle14 } from './fixtures/puzzle-14';

const pool = (run: RunState) => puzzle14.layers[currentLayer(run) - 1]!.pool;

/** Plays one input the way the server will: check, then pool hit or a stand-in judge verdict. */
function play(run: RunState, raw: string, band: RarityBand | 'invalid') {
  const check = checkAnswer(run, raw, pool(run));
  if (check.kind === 'ignored') return { run, result: check };
  if (band === 'invalid')
    return applyAnswer(run, {
      valid: false,
      answer: check.answer,
      reason: 'Not quite',
    });
  const canonical = check.match?.canonical ?? check.answer;
  return applyAnswer(run, {
    valid: true,
    answer: check.answer,
    canonical,
    band,
    estimated: false,
  });
}

describe('rarityBand', () => {
  const band = (count: number, total: number) =>
    rarityBand(count, total, null).band;

  it('uses the share once a layer has 50 answers, with inclusive boundaries', () => {
    expect(rarityBand(14, 50, 'rare')).toEqual({
      band: 'Rubble',
      estimated: false,
    });
    expect(band(25, 100)).toBe('Nugget'); // exactly 25%
    expect(band(10, 100)).toBe('Nugget'); // exactly 10%
    expect(band(9, 100)).toBe('Pocket');
    expect(band(4, 100)).toBe('Pocket'); // exactly 4%
    expect(band(3, 100)).toBe('Vein');
    expect(band(1, 100)).toBe('Vein'); // exactly 1%
    expect(band(1, 101)).toBe('Mother Lode');
    expect(rarityBand(1, 101, null).estimated).toBe(false);
  });

  it('falls back to the commonness label, estimated, under 50 answers', () => {
    expect(rarityBand(1, 49, 'common')).toEqual({
      band: 'Rubble',
      estimated: true,
    });
    expect(rarityBand(1, 49, 'uncommon')).toEqual({
      band: 'Nugget',
      estimated: true,
    });
    expect(rarityBand(1, 49, 'rare')).toEqual({
      band: 'Pocket',
      estimated: true,
    });
    expect(rarityBand(1, 1, null)).toEqual({ band: 'Pocket', estimated: true }); // AI-accepted
  });
});

describe('layerPoints', () => {
  it('adds the band bonus to the base, rounded', () => {
    expect(layerPoints(1, 'Rubble')).toBe(10);
    expect(layerPoints(1, 'Nugget')).toBe(13); // 10 + 2.5 → 3
    expect(layerPoints(4, 'Nugget')).toBe(63); // 50 + 12.5 → 13
    expect(layerPoints(1, 'Pocket')).toBe(15);
    expect(layerPoints(5, 'Vein')).toBe(150);
    expect(layerPoints(5, 'Mother Lode')).toBe(225);
    expect(layerPoints(10, null)).toBe(500);
  });

  it('names every band in order, most to least common', () => {
    expect([...BANDS]).toEqual([
      'Rubble',
      'Nugget',
      'Pocket',
      'Vein',
      'Mother Lode',
    ]);
    expect(BANDS.map((b) => BAND_RARITY[b])).toEqual([
      'Everywhere',
      'Plenty',
      'Scarce',
      'Hidden',
      'Fabled',
    ]);
  });
});

describe('run state machine', () => {
  it('starts at layer 1 with 3 pickaxes', () => {
    const run = startRun(14);
    expect(currentLayer(run)).toBe(1);
    expect(run.pickaxes).toBe(3);
    expect(runStatus(run)).toBe('playing');
  });

  it('ignores empty, too-long and reused input without breaking a pickaxe', () => {
    let { run } = play(startRun(14), 'Traffic cone', 'Rubble');
    expect(checkAnswer(run, '  ?! ', pool(run))).toEqual({
      kind: 'ignored',
      reason: 'empty',
    });
    expect(checkAnswer(run, 'x'.repeat(41), pool(run))).toEqual({
      kind: 'ignored',
      reason: 'too-long',
    });
    expect(checkAnswer(run, 'x'.repeat(40), pool(run)).kind).toBe('ok');
    expect(checkAnswer(run, 'TRAFFIC CONE', pool(run))).toEqual({
      kind: 'ignored',
      reason: 'reused',
    });
    expect(checkAnswer(run, 'road cone', puzzle14.layers[0]!.pool).kind).toBe(
      'ignored'
    ); // alias of a used answer
    ({ run } = play(run, 'grapefruit', 'invalid'));
    expect(run.pickaxes).toBe(2);
    const again = play(run, 'Grapefruit', 'invalid');
    expect(again.result).toEqual({ kind: 'ignored', reason: 'reused' });
    expect(again.run.pickaxes).toBe(2);
  });

  it('treats a judge canonical already used as reuse', () => {
    const { run } = play(startRun(14), 'cheddar', 'Rubble');
    const out = applyAnswer(run, {
      valid: true,
      answer: 'mature cheddar',
      canonical: 'Cheddar',
      band: 'Pocket',
      estimated: true,
    });
    expect(out.result).toEqual({ kind: 'ignored', reason: 'reused' });
    expect(out.run).toBe(run);
  });

  it('clears all 10 layers with no bonus at layer 10, and refuses more answers', () => {
    let run = startRun(14);
    const answers = [
      'basketball',
      'cheddar',
      'carrot',
      'pumpkin',
      'mango',
      'blood orange',
      'tangerine',
      'mandarin',
      'calamansi',
    ];
    for (const a of answers) ({ run } = play(run, a, 'Rubble'));
    const last = play(run, 'Chinotto', 'Vein');
    expect(last.result).toMatchObject({
      kind: 'valid',
      layer: 10,
      band: null,
      estimated: false,
      points: 500,
    });
    expect(runStatus(last.run)).toBe('cleared');
    expect(scoreRun(last.run).hero.name).toBe('Uranium');
    expect(scoreRun(last.run).total).toBe(1435 + 3 * 50); // all base points, no bonus, 3 pickaxes
    expect(() =>
      applyAnswer(last.run, { valid: false, answer: 'lime', reason: 'x' })
    ).toThrow('run is over');
  });
});

describe('sample run #14', () => {
  const inputs: [string, RarityBand | 'invalid'][] = [
    ['Traffic cone', 'Pocket'],
    ['cheddar', 'Rubble'],
    ['sweet potato', 'Rubble'],
    ['apricot', 'Nugget'],
    ['persimmon', 'Vein'],
    ['navel orange', 'Nugget'],
    ['grapefruit', 'invalid'],
    ['clementine', 'Rubble'],
    ['satsuma', 'Pocket'],
    ['mandarin', 'invalid'],
    ['tangerine', 'invalid'],
  ];

  let run = startRun(14);
  const mid: string[] = [];
  for (const [i, [raw, band]] of inputs.entries()) {
    ({ run } = play(run, raw, band));
    if (i === 6) mid.push(JSON.stringify(run));
  }

  it('caves in at Gold with 853 points, 3 rare finds and 0 pickaxes', () => {
    expect(runStatus(run)).toBe('caved-in');
    expect(run.pickaxes).toBe(0);
    expect(scoreRun(run)).toMatchObject({
      total: 853,
      rareFinds: 3,
      hero: { name: 'Gold' },
    });
    expect(() => play(run, 'chinotto', 'Rubble')).toThrow('run is over');
  });

  it('builds the exact share text from SPEC §6.6', () => {
    expect(shareText(run)).toBe(
      'Unearth #14 — 🥇 Gold · 853 pts\n🟫🟧🪨⬛🟠🔩🥈🥇\n✨ 3 rare finds · 💥💥💥'
    );
  });

  it('resumes from stored JSON to the same end state', () => {
    let resumed = JSON.parse(mid[0]!) as RunState;
    for (const [raw, band] of inputs.slice(7))
      ({ run: resumed } = play(resumed, raw, band));
    expect(resumed).toEqual(run);
  });
});

describe('share text edge cases', () => {
  it('shows Surface alone and no pickaxe marks when nothing happened', () => {
    expect(shareText(startRun(3))).toBe(
      'Unearth #3 — 🌱 Surface · 150 pts\n🌱\n✨ 0 rare finds'
    );
  });
  it('uses the singular for one rare find', () => {
    const { run } = play(startRun(3), 'goldfish', 'Pocket');
    expect(shareText(run).split('\n')[2]).toBe('✨ 1 rare find');
  });
});

describe('days and streaks', () => {
  it('keys days in UTC', () => {
    expect(dayKey(new Date('2026-11-21T23:59:59-05:00'))).toBe('2026-11-22');
  });
  it('counts consecutive UTC days and restarts after a gap', () => {
    let s = updateStreak(null, '2026-11-21');
    expect(s).toEqual({ count: 1, lastDay: '2026-11-21' });
    s = updateStreak(s, '2026-11-21');
    expect(s.count).toBe(1);
    s = updateStreak(s, '2026-11-22');
    expect(s.count).toBe(2);
    expect(
      updateStreak({ count: 5, lastDay: '2026-11-30' }, '2026-12-01').count
    ).toBe(6);
    expect(updateStreak(s, '2026-11-24')).toEqual({
      count: 1,
      lastDay: '2026-11-24',
    });
  });
  it('shows 0 once a day is missed', () => {
    const s = { count: 4, lastDay: '2026-11-21' };
    expect(currentStreak(s, '2026-11-21')).toBe(4);
    expect(currentStreak(s, '2026-11-22')).toBe(4);
    expect(currentStreak(s, '2026-11-23')).toBe(0);
    expect(currentStreak(null, '2026-11-23')).toBe(0);
  });
});
