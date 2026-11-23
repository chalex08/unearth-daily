You are writing a Devvit web application that will be executed on Reddit.com.

## Tech Stack

- **Frontend**: Phaser, Vite
- **Backend**: Node.js serverless environment (Devvit), Hono, Devvit Redis
- **Communication**: plain `fetch` to `/api/*`, request and response types in `src/shared/api.ts`

## Layout & Architecture

- `/src/server`: **Backend Code**. This runs in a secure, serverless environment.
  - `routes/`: Hono routes (`api.ts` for `/api/*`, the rest under `/internal/*`).
  - `index.ts`: Main server entry point (Hono app).
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
- `/src/client`: **Frontend Code**. This is executed inside of an iFrame on reddit.com
  - To add an entrypoint, create a HTML file and add to the mapping inside of `devvit.json`
  - Entrypoints:
    - `game.html`: The game (Expanded View): Phaser world plus DOM overlay.
    - `splash.html`: The feed card (Inline View), plain DOM. Keep it fast and keep heavy dependencies inside of `game.html`
- `/src/shared`: **Shared Code**. Code to share between the client and server

## Frontend

### Rules

- Instead of `window.location` or `window.assign`, use `navigateTo` from `@devvit/web/client`

### Limitations

- `window.alert`: Use `showToast` or `showForm` from `@devvit/web/client`
- File downloads: Use clipboard API with `showToast` to confirm
- Geolocation, camera, microphone, and notifications web APIs: No alternatives
- Inline script tags inside of `html` files: Use a script tag and separate js/ts file

## Commands

- `npm run typecheck`: Check typescript types
- `npm run lint`: Check the linter
- `npm run test -- my-file-name`: Run Vitest tests isolated to a file
- `npm run dev`: Playtest on Reddit (uses DEVVIT_APP_NAME / DEVVIT_SUBREDDIT from .env)
- Never run `devvit publish` or `npm run launch:after-hackathon`. `npm run deploy:prod` uploads the canonical app without publishing (CLAUDE.md).

## Code Style

- Prefer type aliases over interfaces when writing typescript
- Prefer named exports over default exports
- Never cast typescript types

## Global Rules

- You may find code that references blocks or `@devvit/public-api` while building a feature. Do NOT use this code as this project is configured to use Devvit web only.
- Whenever you add an endpoint for a new menu item action, ensure that you've added the corresponding mapping to `devvit.json` so that it is properly registered

Docs: https://developers.reddit.com/docs/llms.txt.
