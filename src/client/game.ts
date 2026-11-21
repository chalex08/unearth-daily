// Expanded-mode game: start/resume → answer → descend → end screen → "already played".
// The server owns every rule; this file only shows what /api/* returns.
import * as Phaser from 'phaser';
import { showToast } from '@devvit/web/client';
import type {
  AnswerResult,
  ChainLink,
  ErrorResponse,
  ResultResponse,
  RunResponse,
} from '../shared/api';
import { mineral, PICKAXES } from '../shared/game';
import { World } from './world';

function el<T extends HTMLElement>(id: string, type: { new (): T }): T {
  const e = document.getElementById(id);
  if (!(e instanceof type)) throw new Error(`#${id} missing`);
  return e;
}
const $ = (id: string) => el(id, HTMLElement);

const ui = {
  hud: $('hud'),
  puzzle: $('puzzle'),
  pickaxes: $('pickaxes'),
  score: $('score'),
  mineral: $('mineral'),
  status: $('status'),
  retry: el('retry', HTMLButtonElement),
  play: $('play'),
  layer: $('layer'),
  clue: $('clue'),
  form: el('answer-form', HTMLFormElement),
  input: el('answer', HTMLInputElement),
  result: $('result'),
  end: $('end'),
  endTitle: $('end-title'),
  endSummary: $('end-summary'),
  endChain: el('end-chain', HTMLOListElement),
  finalAnswer: $('final-answer'),
  share: el('share', HTMLTextAreaElement),
  copy: el('copy', HTMLButtonElement),
  next: $('next'),
};

const world = new World();
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'world',
  backgroundColor: '#1a1a1a',
  scale: { mode: Phaser.Scale.RESIZE },
  scene: [world],
});

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

function hud(
  puzzleNumber: number,
  lives: number,
  score: number,
  deepest: number
) {
  ui.hud.hidden = false;
  ui.puzzle.textContent = `Unearth #${puzzleNumber}`;
  ui.pickaxes.textContent = `Pickaxes ${'⛏'.repeat(lives)}${'✕'.repeat(PICKAXES - lives)}`;
  ui.pickaxes.setAttribute(
    'aria-label',
    `${lives} of ${PICKAXES} pickaxes left`
  );
  ui.score.textContent = `${score} pts`;
  ui.mineral.textContent = `${mineral(deepest).emoji} ${mineral(deepest).name}`;
}

function showError(message: string) {
  ui.status.textContent = message;
  ui.retry.hidden = false;
}

async function start() {
  ui.status.textContent = 'Loading…';
  ui.retry.hidden = true;
  try {
    const r = await api<RunResponse>('POST', 'start');
    hud(r.puzzleNumber, r.lives, r.score, r.chain.length);
    if (r.status !== 'playing' || r.clue === null) return await end();
    run = {
      puzzleNumber: r.puzzleNumber,
      layer: r.layer,
      clue: r.clue,
      chain: r.chain,
    };
    ui.status.textContent = '';
    showLayer();
  } catch (e) {
    showError(e instanceof ApiError ? e.message : "Couldn't reach the server.");
  }
}

function showLayer() {
  if (!run) return;
  ui.play.hidden = false;
  ui.layer.textContent = `Layer ${run.layer} of 10`;
  ui.clue.textContent = run.clue;
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

ui.form.addEventListener('submit', (e) => {
  e.preventDefault();
  void submit();
});

async function submit() {
  if (!run || busy) return;
  busy = true;
  ui.form.setAttribute('aria-busy', 'true');
  ui.result.textContent = 'Checking…';
  try {
    const r = await api<AnswerResult>('POST', 'answer', {
      answer: ui.input.value,
      layer: run.layer,
    });
    ui.result.textContent = resultLine(r);
    if (r.outcome === 'valid' || r.outcome === 'invalid') ui.input.value = '';
    if (r.valid && r.canonical && r.base !== null) {
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
    hud(run.puzzleNumber, r.lives, r.total, run.chain.length);
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
    case 'valid': {
      const band = r.band
        ? ` · ${r.band}${r.estimated ? ' (estimated)' : ''} +${r.bonus}`
        : '';
      const pct = r.percent === null ? '' : ` · ${r.percent}% of players`;
      return `✓ ${r.canonical}: ${r.mineral} +${r.base}${band}${pct} · total ${r.total}`;
    }
    case 'invalid':
      return `✗ ${r.answer}: ${r.reason ?? 'not valid'}. A pickaxe broke.`;
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
    return showError("Couldn't load your result.");
  }
  ui.status.textContent = '';
  const cleared = r.chain.flatMap((l) => (l.cleared ? [l.cleared] : []));
  hud(r.puzzleNumber, r.lives, r.total, cleared.length);
  world.pullBack(cleared.map((c) => c.answer));
  ui.end.hidden = false;
  ui.endTitle.textContent =
    r.status === 'cleared' ? `Struck ${r.hero}!` : `Caved in at ${r.hero}`;
  ui.endSummary.textContent =
    `${r.total} pts · ${r.rareFinds} rare find${r.rareFinds === 1 ? '' : 's'} · ` +
    `${r.lives} pickaxe${r.lives === 1 ? '' : 's'} left · streak ${r.streak}`;
  ui.endChain.replaceChildren(
    ...r.chain.map((l) => {
      const li = document.createElement('li');
      const c = l.cleared;
      li.textContent = c
        ? `${l.clue} → ${c.answer} (${c.band ?? 'no bonus'}${c.estimated ? ', estimated' : ''}, ${c.points} pts)`
        : `${l.clue} → not reached`;
      return li;
    })
  );
  ui.finalAnswer.textContent = `Final answer: ${r.finalAnswer}`;
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
  };
  vv.addEventListener('resize', fit);
  fit();
}

void start();
