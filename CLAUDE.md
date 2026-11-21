# Working rules for UNEARTH

Every session follows these rules. Repo layout, commands and Devvit client limits are in [AGENTS.md](AGENTS.md) and [README.md](README.md).

## Before any work

- Read [docs/SPEC.md](docs/SPEC.md). It is the source of truth. If the work needs different behaviour, propose a change to SPEC.md (and update it in the same branch once agreed); never silently diverge.
- Check [docs/PLAN.md](docs/PLAN.md) for the current step and its acceptance criteria, and [docs/DECISIONS.md](docs/DECISIONS.md) for settled tech choices.
- Verify every Devvit API, `devvit.json` key and package name against the current docs (https://developers.reddit.com/docs, index at https://developers.reddit.com/docs/llms.txt) or the installed `@devvit/*` type definitions before using it. Never rely on memory. Log anything new or changed in DECISIONS.md.

## Never

- Never run `devvit publish`, `npm run launch:after-hackathon`, or anything else that submits the app for review. Upload and playtest only (`npm run dev`, `npm run upload:dev`; `npm run deploy:prod` uploads the canonical app and does not publish).
- Never print, cat, grep or read the contents of `.env` or any other secret. When searching the repo, exclude `.env*` files.
- Never commit secrets. The only AI key is the runtime Devvit secret setting `geminiApiKey` (Gemini paid tier, used only for in-game answer checking).
- Never give Reddit data of any kind to an AI tool or session used for content, including this one and `/write-puzzle`: no player answers, no SPEC §4.1 non-pool answer log, no answer counts, no usernames, nothing read from Redis or the Reddit API. Content work reads only hand-written seed themes and our own puzzle files. (SPEC §5.3)
- Never let the Devvit server use any key but the paid-tier one (`geminiApiKey`, from a billed Google project, never a free-tier one).
- Never send the non-pool answer log to any AI; reviewing it and adding answers to pools is manual only.
- Never make play depend on AI: Devvit granted LLM approval on 22 Nov 2026, but whenever the judge is unavailable (no key, timeout, error), pool answers validate without AI and unknown answers get "Couldn't check that, try again" with no pickaxe lost.
- Never send future clues or answer pools to the client.

## Workflow

- One feature branch per prompt, off an up-to-date `main` (e.g. `feat/answer-judge`). Conventional Commits, as in [CONTRIBUTING.md](CONTRIBUTING.md).
- Before every commit: `npm run typecheck`, `npm run lint`, `npm run test`. All green, then merge to `main`.

## Skills

- Game logic and server code: use the **ponytail** skill. The simplest thing that works, no speculative abstractions, unused options or extra layers.
- Any DOM UI, visuals or animation: use the **Hallmark** skill plus the **frontend-design** skill. Do not use ponytail on visual or animation work. Hallmark decides visual and UX choices.
- Writing a daily puzzle: use the **write-puzzle** project skill (`/write-puzzle <YYYY-MM-DD> [seed theme]`).
- Ponytail never removes accessibility, focus styles, loading/empty/error states, responsive layout or motion.

## End of every session

Finish with a short report:

1. What changed.
2. How to test it on Reddit (playtest URL / steps).
3. What's next (the next PLAN.md step, plus anything blocked).
