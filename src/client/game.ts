// Expanded-mode game: start/resume → answer → strike reveal → descend → end screen → "already played".
// The server owns every rule; this file only shows what /api/* returns. Look: docs/DESIGN.md.
import * as Phaser from 'phaser';
import { navigateTo, showToast } from '@devvit/web/client';
import type {
  ActionResponse,
  AnswerResult,
  ChainLink,
  ErrorResponse,
  ResultResponse,
  RunResponse,
  StatsResponse,
} from '../shared/api';
import { BAND_RARITY, type RarityBand } from '../shared/game';
import { LAYER_COUNT } from '../shared/puzzle';
import {
  COLD_START_THRESHOLD,
  mineral,
  MINERALS,
  PICKAXES,
} from '../shared/game';
import { BODY, DISPLAY, FOSSILS_SHOWN, K, World } from './world';
import { STRATA } from './strata';
import { STRIKE, WRONG } from './feel';
import { buzz, isMuted, play, setHum, setMuted } from './sound';

function el<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} missing`);
  return e;
}
const $ = (id: string) => el(id, HTMLElement);

const ui = {
  hud: $('hud'),
  pickaxes: $('pickaxes'),
  pips: el('pips', HTMLOListElement),
  score: $('score'),
  mute: el('mute', HTMLButtonElement),
  flash: $('flash'),
  status: $('status'),
  statusText: $('status-text'),
  retry: el('retry', HTMLButtonElement),
  play: $('play'),
  chain: el('chain', HTMLOListElement),
  current: $('current'),
  layer: $('layer'),
  clue: $('clue'),
  helper: $('helper'),
  hints: $('hints'),
  hintsOk: el('hints-ok', HTMLButtonElement),
  reveal: $('reveal'),
  revealIcon: el('reveal-icon', HTMLImageElement),
  revealBand: $('reveal-band'),
  revealRarity: $('reveal-rarity'),
  revealPts: $('reveal-pts'),
  revealAnswer: $('reveal-answer'),
  revealBase: $('reveal-base'),
  revealBonus: $('reveal-bonus'),
  revealFlavour: $('reveal-flavour'),
  form: el('answer-form', HTMLFormElement),
  input: el('answer', HTMLInputElement),
  dig: el('dig', HTMLButtonElement),
  result: $('result'),
  end: $('end'),
  endIcon: el('end-icon', HTMLImageElement),
  endTitle: $('end-title'),
  endTotal: $('end-total'),
  endStats: $('end-stats'),
  endChain: el('end-chain', HTMLOListElement),
  endNote: $('end-note'),
  finalAnswer: $('final-answer'),
  share: el('share', HTMLTextAreaElement),
  copy: el('copy', HTMLButtonElement),
  next: $('next'),
  comment: el('comment', HTMLButtonElement),
  commentNote: $('comment-note'),
  join: $('join'),
  joinTitle: $('join-title'),
  joinYes: el('join-yes', HTMLButtonElement),
  joinSkip: el('join-skip', HTMLButtonElement),
  deeper: $('deeper'),
  graveRows: $('grave-rows'),
  flairBox: $('flair-box'),
  flair: el('flair', HTMLButtonElement),
  flairNote: $('flair-note'),
  fossils: $('fossils'),
  fossilList: $('fossil-list'),
  announce: $('announce'),
};

const world = new World();
// The recess grows with the chain, so aim the camera at whatever rock is left showing.
// Wide screens put the HUD and the panel in a side column, so the whole canvas is rock.
const sideColumn = window.matchMedia('(min-width: 56rem)');
world.gap = () => {
  const box = el('world', HTMLElement).getBoundingClientRect();
  if (sideColumn.matches) return [0, box.height];
  const panel = ui.play.hidden ? ui.end : ui.play;
  return [
    ui.hud.hidden ? 0 : ui.hud.getBoundingClientRect().bottom,
    panel.hidden ? box.height : panel.getBoundingClientRect().top,
  ];
};
// Phaser letters the rock in the bundled faces, so wait for them (or their failure) first.
void Promise.allSettled([
  document.fonts.load(`20px ${DISPLAY}`),
  document.fonts.load(`italic 20px ${DISPLAY}`),
  document.fonts.load(`400 14px ${BODY}`),
  document.fonts.load(`700 20px ${BODY}`),
]).then(() => {
  const box = $('world');
  // The canvas is K times its box and shown at 1/K, so rock and lettering are sharp on phones.
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'world',
    backgroundColor: '#1b1714',
    scale: {
      mode: Phaser.Scale.NONE,
      zoom: 1 / K,
      width: Math.round(box.clientWidth * K),
      height: Math.round(box.clientHeight * K),
    },
    scene: [world],
    // 90/120Hz phones would otherwise render up to twice the frames; World drops to 30 when idle.
    fps: { limit: 60 },
    // Everything is axis-aligned quads or alpha-edged textures: multisampling buys nothing visible.
    render: { antialiasGL: false },
  });
});
// The world only re-measures on its own resize; the panels change height on their own too (a wrong
// answer line wrapping, the strike reveal, the end screen), which changes how much rock shows.
const panels = new ResizeObserver(() => world.relayout());
for (const panel of [ui.hud, ui.play, ui.end]) panels.observe(panel);

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const paintMute = () => ui.mute.setAttribute('aria-pressed', String(isMuted()));
paintMute();
ui.mute.addEventListener('click', () => {
  setMuted(!isMuted());
  paintMute();
});

/** The mineral's icon (public/icons, REFERENCES §7). */
const icon = (layer: number) =>
  `icons/${String(layer).padStart(2, '0')}-${(MINERALS[layer] ?? MINERALS[0]!).name.toLowerCase()}.svg`;

/** Paints an element (and its children) in a stratum's ore colour, via `--ore`. */
const setOre = (e: HTMLElement, layer: number) =>
  e.style.setProperty('--ore', STRATA[layer]?.ore ?? STRATA[0]!.ore);

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

async function api<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown
): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? null : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err: Partial<ErrorResponse> | null = data;
    throw new ApiError(res.status, err?.error ?? 'Something went wrong');
  }
  return data;
}

let run: {
  puzzleNumber: number;
  layer: number;
  clue: string;
  chain: ChainLink[];
} | null = null;
let busy = false;

const PICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><g transform="rotate(-35 12 12)"><path d="M4 9c4-5 12-5 16 0"/><path d="M12 6v15"/></g></svg>';
let lastLives = PICKAXES;
let shownScore = 0;

function hud(lives: number, score: number, cleared: number, here: number) {
  ui.hud.hidden = false;
  ui.pickaxes.innerHTML = PICK.repeat(PICKAXES);
  ui.pickaxes.setAttribute(
    'aria-label',
    `${lives} of ${PICKAXES} pickaxes left`
  );
  [...ui.pickaxes.children].forEach((svg, i) => {
    if (i < lives) return;
    svg.classList.add('broken');
    // The pickaxe that just broke snaps; older breaks stay quietly broken.
    if (i < lastLives) svg.classList.add('snap');
  });
  lastLives = lives;
  ui.pips.setAttribute(
    'aria-label',
    `${cleared} of ${LAYER_COUNT} layers cleared`
  );
  ui.pips.replaceChildren(
    ...Array.from({ length: LAYER_COUNT }, (_, i) => {
      const li = document.createElement('li');
      if (i < cleared) {
        li.className = 'done';
        li.style.setProperty('--pip', STRATA[i + 1]!.ore);
      } else if (i + 1 === here) li.className = 'here';
      return li;
    })
  );
  countTo(score);
}

/** The score counts up into the HUD (or jumps there with reduced motion). */
function countTo(target: number) {
  const from = shownScore;
  shownScore = target;
  const show = (n: number) => {
    const small = document.createElement('small');
    small.textContent = ' pts';
    small.setAttribute('aria-hidden', 'true');
    const said = document.createElement('span');
    said.className = 'visually-hidden';
    said.textContent = ' points';
    ui.score.replaceChildren(String(n), small, said);
  };
  if (from === target || reducedMotion()) return show(target);
  const t0 = performance.now();
  const step = (t: number) => {
    const k = Math.min(1, (t - t0) / 600);
    show(Math.round(from + (target - from) * (1 - (1 - k) ** 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function showStatus(message: string, retry = false) {
  ui.status.hidden = message === '';
  ui.statusText.textContent = message;
  ui.retry.hidden = !retry;
}

ui.hintsOk.addEventListener('click', () => {
  ui.hints.hidden = true;
  ui.helper.hidden = !run?.chain.length;
  ui.input.focus();
  // Remembered on the server; if this fails the hints simply show once more next time.
  void api('POST', 'onboarded').catch(() => undefined);
});

async function start() {
  showStatus('Loading…');
  try {
    const r = await api<RunResponse>('POST', 'start');
    lastLives = r.lives;
    hud(r.lives, r.score, r.chain.length, r.layer);
    if (r.status !== 'playing' || r.clue === null) return await end();
    run = {
      puzzleNumber: r.puzzleNumber,
      layer: r.layer,
      clue: r.clue,
      chain: r.chain,
    };
    showStatus('');
    // A run with nothing cleared and nothing broken opens on the Surface (World.startIntro).
    // First-run hints (SPEC §6.2), lettered under the clue until dismissed; they replace the helper.
    ui.hints.hidden = !r.onboarding;
    showLayer(r.chain.length === 0 && r.lives === PICKAXES);
    if (r.chain.length) void loadFossils();
  } catch (e) {
    showStatus(
      e instanceof ApiError ? e.message : 'Couldn’t reach the server.',
      true
    );
  }
}

/** Other players' answers at the layers this player has cleared. Optional, so failures stay quiet. */
async function loadFossils(): Promise<StatsResponse | null> {
  try {
    const stats = await api<StatsResponse>('GET', 'stats');
    const { fossils } = stats;
    world.setFossils(fossils);
    ui.fossils.hidden = fossils.every((layer) => layer.length === 0);
    // The canvas is decoration for a screen reader; this list carries the same fossils, with percents.
    ui.fossilList.replaceChildren(
      ...fossils.flatMap((layer, i) =>
        layer.length
          ? [
              Object.assign(document.createElement('li'), {
                textContent: `Layer ${i + 1}, ${mineral(i + 1).name}: ${layer
                  .slice(0, FOSSILS_SHOWN)
                  .map((f) => `${f.answer} ${f.percent}%`)
                  .join(', ')}.`,
              }),
            ]
          : []
      )
    );
    return stats;
  } catch {
    // The fossils are decoration on top of play; the run goes on without them.
    return null;
  }
}

function bandNote(points: number, band: RarityBand | null, estimated: boolean) {
  const named = band && band !== 'Rubble' ? ` ${band}` : '';
  return `+${points}${named}${estimated && named ? ', estimated' : ''}`;
}

function showLayer(opening = false) {
  if (!run) return;
  ui.play.hidden = false;
  setOre(ui.play, run.layer);
  ui.chain.replaceChildren(
    ...run.chain.map((c) => {
      const li = document.createElement('li');
      setOre(li, c.layer);
      const clue = document.createElement('span');
      clue.className = 'link-clue';
      clue.textContent = c.clue;
      const answer = document.createElement('span');
      answer.className = 'link-answer';
      const note = document.createElement('small');
      note.className = 'link-note';
      // "estimated" is said in the reveal and on the end screen; here every line counts.
      note.textContent = bandNote(c.points, c.band, false);
      if (c.band) note.dataset.band = bandKey(c.band);
      answer.append(c.answer, note);
      li.append(clue, answer);
      return li;
    })
  );
  // The newest links sit right above the current clue.
  ui.chain.scrollTop = ui.chain.scrollHeight;
  ui.layer.textContent = `Layer ${run.layer} of ${LAYER_COUNT}, ${mineral(run.layer).name}`;
  ui.clue.textContent = run.clue;
  ui.helper.hidden = run.chain.length === 0 || !ui.hints.hidden;
  ui.input.disabled = false;
  ui.dig.disabled = false;
  ui.reveal.hidden = true;
  ui.current.hidden = false;
  setHum(run.layer === LAYER_COUNT);
  world.dig(
    run.layer,
    run.chain.map((c) => ({ clue: c.clue, answer: c.answer })),
    run.clue,
    true,
    opening
  );
  announce(`${ui.layer.textContent}. ${run.clue}`);
}

/** Says something once to screen readers, through the one always-rendered live region. */
function announce(text: string) {
  ui.announce.textContent = text;
}

const IGNORED: Record<string, string> = {
  empty: 'Type an answer first.',
  'too-long': 'Too long: 40 characters at most.',
  reused: 'Already used this run. Try another.',
};

const FLAVOUR: Record<RarityBand, string> = {
  Rubble: 'The answer most diggers hit first.',
  Nugget: 'A solid chunk most diggers walked past.',
  Pocket: 'A little cluster few found.',
  Vein: 'Few swung their pick this way.',
  'Mother Lode': 'Almost nobody dug here.',
};

const SLAM: Record<RarityBand, string> = {
  Rubble: '1',
  Nugget: '1.25',
  Pocket: '1.5',
  Vein: '1.75',
  'Mother Lode': '2',
};

/** Band name as a CSS key: the colour and glow in game.css hang off data-band. */
const bandKey = (band: RarityBand | null) =>
  band ? band.toLowerCase().replace(' ', '-') : 'core';

// A reveal holds until it times out or the player taps it (or presses Enter in the input).
let skipReveal: (() => void) | null = null;
const hold = (ms: number) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      skipReveal = null;
      resolve();
    };
    const timer = setTimeout(done, ms);
    skipReveal = done;
  });
ui.reveal.addEventListener('click', () => skipReveal?.());

/** The in-world score label's lines (SPEC §6.4). No percent while estimated or at layer 10, as in the reveal. */
function scoreLabel(r: AnswerResult, layer: number): string[] {
  const name = mineral(layer).name;
  const pct =
    r.percent === null || !r.band || r.estimated
      ? ''
      : `${r.percent}% of players, `;
  return [
    r.band ? `${name}, ${r.band}${r.estimated ? ' est.' : ''}` : name,
    `+${r.base} base${r.bonus ? `, +${r.bonus} bonus` : ''}`,
    `${pct}total ${r.total}`,
  ];
}

/** Strike reveal (SPEC §6.4): the world's choreography (feel.ts), then the hold; rarer bands linger longer. */
async function reveal(r: AnswerResult, layer: number) {
  const band = r.band;
  // Layer 10 has no band (SPEC §3.2) but gets the full Mother Lode treatment.
  const look = band ?? 'Mother Lode';
  world.strike(layer, r.answer, look, scoreLabel(r, layer));
  setTimeout(() => {
    play('strike');
    buzz(look === 'Rubble' ? 15 : [20, 30, 40]);
  }, STRIKE.impact);
  if (look === 'Mother Lode') setTimeout(() => play('chime'), STRIKE.ore);
  // Layer 10 has no band (SPEC §3.2), but reaching Uranium is the biggest moment of the run.
  const rare =
    !band || band === 'Pocket' || band === 'Vein' || band === 'Mother Lode';
  ui.reveal.classList.toggle('rubble', band === 'Rubble');
  ui.reveal.dataset.band = bandKey(band);
  ui.revealIcon.src = icon(layer);
  ui.revealBand.textContent = band ?? r.mineral ?? '';
  ui.revealRarity.textContent = band ? BAND_RARITY[band] : 'Final layer';
  ui.revealPts.textContent = `+${(r.base ?? 0) + (r.bonus ?? 0)} pts`;
  ui.revealAnswer.textContent = `“${r.canonical}”`;
  ui.revealBase.textContent = `+${r.base}`;
  ui.revealBonus.textContent = r.bonus ? `+${r.bonus} ${band}` : '';
  ui.revealBonus.style.setProperty('--slam', band ? SLAM[band] : '1');
  // No percent at layer 10 (everyone gives the one final answer) or during cold start, where the
  // band comes from the puzzle's commonness label and a small-sample percent would contradict it.
  const pct =
    r.percent === null || !band || r.estimated
      ? ''
      : ` ${r.percent}% of diggers found it.`;
  const est = r.estimated
    ? ` Estimated until ${COLD_START_THRESHOLD} diggers answer this layer.`
    : '';
  ui.revealFlavour.textContent = `${band ? FLAVOUR[band] : 'You hit the core.'}${pct}${est}`;
  announce(
    [
      ui.revealBand.textContent,
      ui.revealAnswer.textContent,
      `${ui.revealBase.textContent} ${ui.revealBonus.textContent}`.trim(),
      ui.revealFlavour.textContent,
    ].join('. ')
  );
  ui.current.hidden = true;
  ui.reveal.hidden = false;
  if (rare) {
    setOre(ui.flash, layer);
    ui.flash.classList.remove('on');
    void ui.flash.offsetWidth; // restart the animation
    ui.flash.classList.add('on');
  }
  await hold(STRIKE.hold[look]);
}

// Tapping Dig must not take focus from the input: on a phone that closes the keyboard, the
// layout jumps, and focus() reopens it a moment later. The click (and keyboard use) still submit.
ui.dig.addEventListener('pointerdown', (e) => {
  if (document.activeElement === ui.input) e.preventDefault();
});

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (skipReveal) return skipReveal();
  void submit();
});

async function submit() {
  if (!run || busy) return;
  busy = true;
  ui.form.setAttribute('aria-busy', 'true');
  ui.result.className = '';
  ui.result.textContent = 'Checking…';
  try {
    const r = await api<AnswerResult>('POST', 'answer', {
      answer: ui.input.value,
      layer: run.layer,
    });
    // The server has answered: Dig is live again (during a reveal it skips ahead).
    ui.form.removeAttribute('aria-busy');
    ui.result.className =
      r.outcome === 'invalid'
        ? 'wrong'
        : r.outcome === 'unchecked'
          ? 'shimmer'
          : '';
    ui.result.textContent = resultLine(r);
    if (r.outcome === 'invalid') {
      world.bounce(r.answer);
      setTimeout(() => {
        play('clink');
        buzz([12, 40, 12]);
      }, WRONG.hit);
    }
    if (r.outcome === 'valid' || r.outcome === 'invalid') ui.input.value = '';
    let struck = false;
    if (r.valid && r.canonical && r.base !== null) {
      struck = true;
      run.chain.push({
        layer: run.layer,
        clue: run.clue,
        answer: r.answer,
        canonical: r.canonical,
        band: r.band,
        estimated: r.estimated,
        points: r.base + (r.bonus ?? 0),
      });
      run.layer += 1;
    }
    hud(r.lives, r.total, run.chain.length, run.layer);
    if (r.ended) {
      // The run is over: no more answers, but a tap on the reveal still skips it.
      ui.input.disabled = true;
      ui.dig.disabled = true;
    }
    if (struck) {
      void loadFossils();
      setOre(ui.play, run.layer - 1);
      await reveal(r, run.layer - 1);
    }
    if (r.ended) return await end();
    if (r.nextClue) {
      run.clue = r.nextClue;
      if (struck) play('descend');
      showLayer();
    }
  } catch (e) {
    // 409: another tab or a stale layer; reload the real state.
    if (e instanceof ApiError && e.status === 409) return void (await start());
    ui.result.className = 'shimmer';
    ui.result.textContent = 'Couldn’t check that, try again.';
  } finally {
    busy = false;
    ui.form.removeAttribute('aria-busy');
    if (!ui.play.hidden) ui.input.focus();
  }
}

function resultLine(r: AnswerResult): string {
  switch (r.outcome) {
    case 'valid':
      return ''; // the reveal says it
    case 'invalid': {
      const why = (r.reason ?? 'not valid here').replace(/[.!]+$/, '');
      const left = `${r.lives} pickaxe${r.lives === 1 ? '' : 's'} left`;
      return `“${r.answer}”: ${why}. ${left}.`;
    }
    case 'ignored':
      return IGNORED[r.reason ?? ''] ?? 'Try another answer.';
    case 'unchecked':
      return r.reason ?? 'Couldn’t check that, try again.';
  }
}

async function end() {
  run = null;
  setHum(false);
  ui.play.hidden = true;
  let r: ResultResponse;
  try {
    r = await api<ResultResponse>('GET', 'result');
  } catch {
    return showStatus('Couldn’t load your result.', true);
  }
  showStatus('');
  const cleared = r.chain.flatMap((l) => (l.cleared ? [l.cleared] : []));
  hud(r.lives, r.total, cleared.length, 0);
  void loadFossils().then((stats) => paintGraveyard(stats, cleared.length));
  setOre(ui.end, cleared.length);
  ui.endIcon.src = icon(cleared.length);
  ui.end.hidden = false;
  ui.endTitle.textContent =
    r.status === 'cleared' ? `Struck ${r.hero}` : `Caved in at ${r.hero}`;
  ui.endTotal.textContent = `${r.total} points`;
  ui.endStats.replaceChildren(
    ...[
      ['Rare finds', r.rareFinds],
      ['Pickaxes left', r.lives],
      ['Streak', r.streak],
    ].map(([label, value]) => {
      const div = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = String(label);
      dd.textContent = String(value);
      dd.className = 'num';
      div.append(dt, dd);
      return div;
    })
  );
  ui.endChain.replaceChildren(
    ...r.chain.map((l) => {
      const li = document.createElement('li');
      setOre(li, l.layer);
      const num = document.createElement('span');
      num.className = 'end-num num';
      num.textContent = String(l.layer);
      const text = document.createElement('span');
      const note = document.createElement('span');
      note.className = 'link-note';
      const c = l.cleared;
      if (c) {
        const b = document.createElement('b');
        b.textContent = c.answer;
        text.append(`${l.clue}: `, b);
        note.textContent = bandNote(c.points, c.band, false);
        if (c.band) note.dataset.band = bandKey(c.band);
      } else {
        li.className = 'unreached';
        text.textContent = l.clue;
        note.textContent = l.missed.length ? 'caved in here' : 'not reached';
      }
      li.append(num, text, note);
      for (const m of l.missed) {
        li.classList.add('missed');
        const miss = document.createElement('span');
        miss.className = 'miss';
        const word = document.createElement('s');
        word.textContent = m.answer;
        miss.append(
          'Broke a pickaxe: ',
          word,
          ` (${m.reason.replace(/[.!]+$/, '').toLowerCase()})`
        );
        li.append(miss);
      }
      return li;
    })
  );
  paintActions(r);
  ui.endNote.hidden = !cleared.some((c) => c.estimated && c.band);
  ui.endNote.textContent = `Bands are estimated until ${COLD_START_THRESHOLD} diggers have answered a layer.`;
  ui.finalAnswer.textContent = `One last answer that worked: “${r.finalAnswer}”.`;
  ui.share.value = r.share;
  countdown();
  // After the panel is filled, so the camera fits the column into the rock left above it.
  world.pullBack(
    r.chain.map((l) => ({ clue: l.clue, answer: l.cleared?.answer ?? null }))
  );
}

let copyReset: ReturnType<typeof setTimeout> | undefined;
ui.copy.addEventListener('click', async () => {
  let said = 'Copied';
  try {
    await navigator.clipboard.writeText(ui.share.value);
  } catch {
    // Some webviews block the clipboard API; leave the text selected to copy by hand.
    ui.share.select();
    said = 'Select and copy the text';
  }
  // The button says it, where the thumb is; no toast for an effect already shown.
  ui.copy.textContent = said === 'Copied' ? 'Copied' : 'Press and hold to copy';
  announce(said);
  clearTimeout(copyReset);
  copyReset = setTimeout(() => (ui.copy.textContent = 'Copy result'), 2500);
});

/** The graveyard (SPEC §6.6): runs ended per mineral, players reaching each, and where you are. */
function paintGraveyard(stats: StatsResponse | null, mine: number) {
  ui.graveRows.replaceChildren();
  ui.deeper.textContent = '';
  if (!stats) return;
  const top = Math.max(1, ...stats.graveyard);
  ui.deeper.textContent =
    stats.deeperThan === null
      ? 'You are the first to finish today.'
      : `You dug deeper than ${stats.deeperThan}% of today’s other diggers.`;
  ui.graveRows.append(
    ...stats.graveyard.map((ended, m) => {
      const tr = document.createElement('tr');
      setOre(tr, m);
      if (m === mine) tr.className = 'you';
      const bar = document.createElement('td');
      bar.className = 'bar';
      const fill = document.createElement('i');
      fill.style.setProperty('--w', String(ended / top));
      bar.append(fill);
      const cells = [
        mineral(m).name,
        String(ended),
        String(stats.reached[m]),
      ].map((text) =>
        Object.assign(document.createElement('td'), { textContent: text })
      );
      tr.append(...cells);
      tr.firstElementChild?.after(bar);
      return tr;
    })
  );
}

/** Join prompt, comment and flair: each an explicit press of its own (Devvit user-action rules). */
function paintActions(r: ResultResponse) {
  const who = r.username ? `u/${r.username}` : 'you';
  const sub = r.subreddit ? `r/${r.subreddit}` : 'the subreddit';
  const note = (b: HTMLButtonElement, text: string) => {
    b.disabled = true;
    b.textContent = text;
  };
  ui.comment.disabled = false;
  ui.comment.textContent = 'Discuss in comments';
  ui.commentNote.textContent = r.postUrl
    ? `Posts the text above as ${who}, a reply to the pinned comment. Your username shows.`
    : '';
  if (r.commented) note(ui.comment, 'Posted. Open comments');
  ui.comment.hidden = !r.postUrl;
  ui.comment.onclick = async () => {
    if (!r.postUrl) return;
    if (r.commented || ui.comment.dataset.posted) return navigateTo(r.postUrl);
    ui.comment.disabled = true;
    try {
      const done = await api<ActionResponse>('POST', 'comment');
      ui.comment.dataset.posted = '1';
      ui.comment.textContent = 'Posted. Open comments';
      showToast('Posted to the comments');
      announce('Posted to the comments');
      if (done.url) r.postUrl = done.url;
    } catch (e) {
      // Posting as the player can fail (or be unavailable); the comments are still one tap away.
      showToast(e instanceof ApiError ? e.message : 'Couldn’t post');
      navigateTo(r.postUrl);
      ui.comment.textContent = 'Open comments';
    } finally {
      ui.comment.disabled = false;
    }
  };

  ui.join.hidden = !r.joinPrompt;
  ui.joinTitle.textContent = `Come back to ${sub}`;
  ui.joinYes.textContent = `Join ${sub}`;
  ui.joinYes.disabled = false;
  ui.joinYes.onclick = async () => {
    ui.joinYes.disabled = true;
    try {
      await api<ActionResponse>('POST', 'subscribe');
      showToast(`Joined ${sub}`);
      ui.join.hidden = true;
    } catch {
      showToast('Couldn’t join. Try from the subreddit page.');
      ui.joinYes.disabled = false;
    }
  };
  ui.joinSkip.onclick = () => (ui.join.hidden = true);

  ui.flairBox.hidden = !r.subreddit;
  ui.flair.textContent = `Show my streak as my ${sub} flair`;
  ui.flairNote.textContent = 'Replaces any flair you have there.';
  ui.flair.disabled = false;
  ui.flair.onclick = async () => {
    ui.flair.disabled = true;
    try {
      const done = await api<ActionResponse>('POST', 'flair');
      ui.flairNote.textContent = `Your flair now reads ${done.flair}.`;
      announce(ui.flairNote.textContent);
    } catch (e) {
      ui.flairNote.textContent =
        e instanceof ApiError ? e.message : 'Couldn’t set your flair.';
      ui.flair.disabled = false;
    }
  };
}

let timer: ReturnType<typeof setInterval> | undefined;
function countdown() {
  const tick = () => {
    const now = new Date();
    const next = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    );
    const secs = Math.max(0, Math.ceil((next - now.getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    ui.next.textContent = `You’ve played today. Next puzzle in ${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}, at 00:00 UTC.`;
  };
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 1000);
}

ui.retry.addEventListener('click', () => void start());

// Keep #app inside the visible area so the mobile keyboard never covers the input.
const vv = window.visualViewport;
if (vv) {
  const fit = () => {
    document.documentElement.style.setProperty('--vh', `${vv.height}px`);
    window.scrollTo(0, 0);
    // The keyboard shrinks the chain; keep the newest links, the ones the clue builds on, in view.
    ui.chain.scrollTop = ui.chain.scrollHeight;
  };
  vv.addEventListener('resize', fit);
  // iOS can pan the visual viewport when the keyboard opens; keep the fixed layers in view.
  vv.addEventListener('scroll', fit);
  fit();
}

// Local preview only: `game.html?jump=6` (or `?jump=11` for the end screen) rewrites today's run
// first. The route 404s outside dev apps, and a Reddit post's webview URL never carries the param.
const jump = new URLSearchParams(window.location.search).get('jump');
void (
  jump
    ? api('POST', 'dev/jump', { to: Number(jump) }).catch(() => undefined)
    : Promise.resolve()
).then(start);
