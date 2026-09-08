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

This repo is a static Astro + React + Three.js portfolio site. Requires Node 22.12+ (VM has 22.14). Dependencies are refreshed automatically on startup by the environment update script (`npm install`), so no manual install is normally needed.

Commands (see `package.json` scripts and `README.md`):

- Lint/type-check: `npm run check` (`astro check` + `scripts/css-guard.mjs`).
- Unit test: `npm run test:unit`.
- Build: `npm run build` (static output to `dist/`).
- Dev server: `astro dev --background` (serves on `http://localhost:4321`).
- Studio: `npm run studio` (Sanity Studio at `http://localhost:3333`).

Non-obvious caveats:

- `/about` is a noindex overlay route: a hard load of `http://localhost:4321/about` briefly shows overlapping content before the overlay settles. Normal navigation from within the site is smooth.
