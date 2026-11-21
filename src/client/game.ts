// Expanded-mode game: start/resume → answer → strike reveal → descend → end screen → "already played".
// The server owns every rule; this file only shows what /api/* returns. Look: docs/DESIGN.md.
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import type {
  AnswerResult,
  ChainLink,
  ErrorResponse,
  ResultResponse,
  RunResponse,
  StatsResponse,
} from '../shared/api';
import type { RarityBand } from '../shared/game';
import { LAYER_COUNT } from '../shared/puzzle';
import { mineral, PICKAXES } from '../shared/game';
import { DISPLAY, World } from './world';
import { STRATA } from './strata';

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
  reveal: $('reveal'),
  revealBand: $('reveal-band'),
  revealAnswer: $('reveal-answer'),
  revealBase: $('reveal-base'),
  revealBonus: $('reveal-bonus'),
  revealFlavour: $('reveal-flavour'),
  form: el('answer-form', HTMLFormElement),
  input: el('answer', HTMLInputElement),
  result: $('result'),
  end: $('end'),
  endTitle: $('end-title'),
  endTotal: $('end-total'),
  endStats: $('end-stats'),
  endChain: el('end-chain', HTMLOListElement),
  finalAnswer: $('final-answer'),
  share: el('share', HTMLTextAreaElement),
  copy: el('copy', HTMLButtonElement),
  next: $('next'),
};

const world = new World();
// Phaser letters the rock in EB Garamond, so wait for the bundled face (or its failure) first.
void Promise.allSettled([
  document.fonts.load(`20px ${DISPLAY}`),
  document.fonts.load(`italic 20px ${DISPLAY}`),
]).then(
  () =>
    new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'world',
      backgroundColor: '#1b1714',
      scale: { mode: Phaser.Scale.RESIZE },
      scene: [world],
    })
);

const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    ui.score.replaceChildren(String(n), small);
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
    showLayer();
    if (r.chain.length) void loadFossils();
  } catch (e) {
    showStatus(
      e instanceof ApiError ? e.message : "Couldn't reach the server.",
      true
    );
  }
}

/** Other players' answers at the layers this player has cleared. Optional, so failures stay quiet. */
async function loadFossils() {
  try {
    world.setFossils((await api<StatsResponse>('GET', 'stats')).fossils);
  } catch {
    // The fossils are decoration on top of play; the run goes on without them.
  }
}

function bandNote(points: number, band: RarityBand | null, estimated: boolean) {
  const named = band && band !== 'Common' ? ` ${band}` : '';
  return `+${points}${named}${estimated && named ? ', estimated' : ''}`;
}

function showLayer() {
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
      note.textContent = bandNote(c.points, c.band, c.estimated);
      answer.append(c.answer, note);
      li.append(clue, answer);
      return li;
    })
  );
  // The newest links sit right above the current clue.
  ui.chain.scrollTop = ui.chain.scrollHeight;
  ui.layer.textContent = `Layer ${run.layer} of ${LAYER_COUNT}, ${mineral(run.layer).name}`;
  ui.clue.textContent = run.clue;
  ui.helper.hidden = run.chain.length === 0;
  ui.reveal.hidden = true;
  ui.current.hidden = false;
  world.dig(
    run.layer,
    run.chain.map((c) => c.answer)
  );
}

const IGNORED: Record<string, string> = {
  empty: 'Type an answer first.',
  'too-long': 'Too long: 40 characters at most.',
  reused: 'Already used this run. Try another.',
};

const FLAVOUR: Record<RarityBand, string> = {
  Common: 'The answer most diggers hit first.',
  Seam: 'A thin line of something better.',
  Vein: 'Few swung their pick this way.',
  'Mother Lode': 'Almost nobody dug here.',
};

const SLAM: Record<RarityBand, string> = {
  Common: '1',
  Seam: '1.3',
  Vein: '1.6',
  'Mother Lode': '2',
};

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

/** Strike reveal (SPEC §6.4). Common strikes move on after ~1s; rarer ones hold ~2.5s or a tap. */
async function reveal(r: AnswerResult, layer: number) {
  const band = r.band;
  const rare = band === 'Vein' || band === 'Mother Lode';
  ui.reveal.classList.toggle('common', !band || band === 'Common');
  ui.revealBand.textContent = band
    ? `${band}${r.estimated ? ', estimated' : ''}`
    : (r.mineral ?? '');
  ui.revealAnswer.textContent = `“${r.canonical}”`;
  ui.revealBase.textContent = `+${r.base}`;
  ui.revealBonus.textContent = r.bonus ? `+${r.bonus} ${band}` : '';
  ui.revealBonus.style.setProperty('--slam', band ? SLAM[band] : '1');
  const pct = r.percent === null ? '' : ` ${r.percent}% of diggers found it.`;
  ui.revealFlavour.textContent = `${band ? FLAVOUR[band] : 'The bottom of the shaft.'}${pct}`;
  ui.current.hidden = true;
  ui.reveal.hidden = false;
  if (rare) {
    setOre(ui.flash, layer);
    ui.flash.classList.remove('on');
    void ui.flash.offsetWidth; // restart the animation
    ui.flash.classList.add('on');
  }
  await hold(band && band !== 'Common' ? 2500 : 1000);
}

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
    ui.result.className = r.outcome === 'invalid' ? 'wrong' : '';
    ui.result.textContent = resultLine(r);
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
    if (struck) {
      void loadFossils();
      setOre(ui.play, run.layer - 1);
      await reveal(r, run.layer - 1);
    }
    if (r.ended) return await end();
    if (r.nextClue) {
      run.clue = r.nextClue;
      showLayer();
    }
  } catch (e) {
    // 409: another tab or a stale layer; reload the real state.
    if (e instanceof ApiError && e.status === 409) return void (await start());
    ui.result.textContent = "Couldn't check that, try again.";
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
      return r.reason ?? "Couldn't check that, try again.";
  }
}

async function end() {
  run = null;
  ui.play.hidden = true;
  let r: ResultResponse;
  try {
    r = await api<ResultResponse>('GET', 'result');
  } catch {
    return showStatus("Couldn't load your result.", true);
  }
  showStatus('');
  const cleared = r.chain.flatMap((l) => (l.cleared ? [l.cleared] : []));
  hud(r.lives, r.total, cleared.length, 0);
  world.pullBack(cleared.map((c) => c.answer));
  void loadFossils();
  setOre(ui.end, cleared.length);
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
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = String(l.layer);
      const text = document.createElement('span');
      const note = document.createElement('span');
      note.className = 'link-note';
      const c = l.cleared;
      if (c) {
        const b = document.createElement('b');
        b.textContent = c.answer;
        text.append(`${l.clue}: `, b);
        note.textContent = bandNote(c.points, c.band, c.estimated);
      } else {
        li.className = 'unreached';
        text.textContent = l.clue;
        note.textContent = 'not reached';
      }
      li.append(tag, text, note);
      return li;
    })
  );
  ui.finalAnswer.textContent = `The last answer was “${r.finalAnswer}”.`;
  ui.share.value = r.share;
  countdown();
}

ui.copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(ui.share.value);
    showToast('Copied');
  } catch {
    // Some webviews block the clipboard API; leave the text selected to copy by hand.
    ui.share.select();
    showToast('Select and copy the text');
  }
});

let timer: ReturnType<typeof setInterval> | undefined;
function countdown() {
  const tick = () => {
    const now = new Date();
    const next = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1
    );
    const mins = Math.ceil((next - now.getTime()) / 60000);
    ui.next.textContent = `You've played today. Next puzzle in ${Math.floor(mins / 60)}h ${mins % 60}m.`;
  };
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 30000);
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
  fit();
}

void start();
