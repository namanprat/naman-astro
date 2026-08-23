## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Cursor Cloud specific instructions

This repo is a static Astro + React + Three.js portfolio site. Requires Node 22.12+ (VM has 22.14). Dependencies are refreshed automatically on startup by the environment update script (`npm install` and `npx playwright install chromium`), so no manual install is normally needed.

Commands (see `package.json` scripts and `README.md`):

- Lint/type-check: `npm run check` (`astro check` + `scripts/css-guard.mjs`).
- Unit test: `npm run test:unit`.
- Build: `npm run build` (static output to `dist/`).
- Dev server: `astro dev --background` (serves on `http://localhost:4321`).
- E2E: `npm run test:e2e` (Playwright; its `webServer` runs `npm run build && node tests/serve.mjs` on `127.0.0.1:4321`).

Non-obvious caveats:

- The Playwright visual regression baselines in `tests/visual.spec.ts-snapshots/` are macOS-only (`*-darwin.png`). On this Linux VM `tests/visual.spec.ts` fails because it looks for missing `*-linux.png` baselines — this is expected, not an environment break. The functional specs (`navigation.spec.ts`, `reveal.spec.ts`, `work.spec.ts`) pass. Do NOT commit generated `*-linux.png` baselines.
- `playwright.config.ts` honors `PLAYWRIGHT_CHROMIUM_EXECUTABLE` if set; when unset it uses Playwright's own downloaded Chromium (installed by the update script). Leave it unset in this VM.
- `/about` is a noindex overlay route: a hard load of `http://localhost:4321/about` briefly shows overlapping content before the overlay settles. Normal navigation from within the site is smooth.
