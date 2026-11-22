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
import {
  COLD_START_THRESHOLD,
  mineral,
  MINERALS,
  PICKAXES,
} from '../shared/game';
import { BODY, DISPLAY, FOSSILS_SHOWN, K, World } from './world';
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
  revealIcon: el('reveal-icon', HTMLImageElement),
  revealBand: $('reveal-band'),
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
    // A run with nothing cleared and nothing broken opens on the Surface (World.startIntro).
    showLayer(r.chain.length === 0 && r.lives === PICKAXES);
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
    const { fossils } = await api<StatsResponse>('GET', 'stats');
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
  } catch {
    // The fossils are decoration on top of play; the run goes on without them.
  }
}

function bandNote(points: number, band: RarityBand | null, estimated: boolean) {
  const named = band && band !== 'Common' ? ` ${band}` : '';
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
  ui.input.disabled = false;
  ui.dig.disabled = false;
  ui.reveal.hidden = true;
  ui.current.hidden = false;
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
  // Layer 10 has no band (SPEC §3.2), but reaching Uranium is the biggest moment of the run.
  const rare = !band || band === 'Vein' || band === 'Mother Lode';
  ui.reveal.classList.toggle('common', band === 'Common');
  ui.revealIcon.src = icon(layer);
  ui.revealBand.textContent = band ?? r.mineral ?? '';
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
  await hold(band === 'Common' ? 1000 : 2500);
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
    // The server has answered: Dig is live again (during a reveal it skips ahead).
    ui.form.removeAttribute('aria-busy');
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
  void loadFossils();
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
      } else {
        li.className = 'unreached';
        text.textContent = l.clue;
        note.textContent = 'not reached';
      }
      li.append(num, text, note);
      return li;
    })
  );
  ui.endNote.hidden = !cleared.some((c) => c.estimated && c.band);
  ui.endNote.textContent = `Bands are estimated until ${COLD_START_THRESHOLD} diggers have answered a layer.`;
  ui.finalAnswer.textContent = `The last answer was “${r.finalAnswer}”.`;
  ui.share.value = r.share;
  countdown();
  // After the panel is filled, so the camera fits the column into the rock left above it.
  world.pullBack(
    r.chain.map((l) => ({ clue: l.clue, answer: l.cleared?.answer ?? null }))
  );
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
