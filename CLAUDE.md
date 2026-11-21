# Working rules for UNEARTH

Every session follows these rules. Repo layout, commands and Devvit client limits are in [AGENTS.md](AGENTS.md) and [README.md](README.md).

## Before any work

- Read [docs/SPEC.md](docs/SPEC.md). It is the source of truth. If the work needs different behaviour, propose a change to SPEC.md (and update it in the same branch once agreed); never silently diverge.
- Check [docs/PLAN.md](docs/PLAN.md) for the current step and its acceptance criteria, and [docs/DECISIONS.md](docs/DECISIONS.md) for settled tech choices.
- Verify every Devvit API, `devvit.json` key and package name against the current docs (https://developers.reddit.com/docs, index at https://developers.reddit.com/docs/llms.txt) or the installed `@devvit/*` type definitions before using it. Never rely on memory. Log anything new or changed in DECISIONS.md.

## Never

- Never run `devvit publish`, `npm run launch:after-hackathon`, or anything else that submits the app for review. Upload and playtest only (`npm run dev`, `npm run upload:dev`; `npm run deploy:prod` uploads the canonical app and does not publish).
- Never commit secrets. Offline keys (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`) live in `.env`, which is gitignored. The runtime AI key is the Devvit secret setting `geminiApiKey`.
- Never send future clues or answer pools to the client.

## Workflow

- One feature branch per prompt, off an up-to-date `main` (e.g. `feat/answer-judge`). Conventional Commits, as in [CONTRIBUTING.md](CONTRIBUTING.md).
- Before every commit: `npm run typecheck`, `npm run lint`, `npm run test`. All green, then merge to `main`.

## Skills

- Game logic and server code: use the **ponytail** skill. The simplest thing that works, no speculative abstractions, unused options or extra layers.
- Any DOM UI, visuals or animation: use the **Hallmark** skill plus the **frontend-design** skill. Do not use ponytail on visual or animation work. Hallmark decides visual and UX choices.
- Ponytail never removes accessibility, focus styles, loading/empty/error states, responsive layout or motion.

## End of every session

Finish with a short report:

1. What changed.
2. How to test it on Reddit (playtest URL / steps).
3. What's next (the next PLAN.md step, plus anything blocked).
