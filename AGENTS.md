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

Static Astro + React + Three.js personal site — no backend, database, or external services. Dependencies (`npm install`) are refreshed automatically by the environment update script, so you normally don't need to reinstall.

- Dev server: `astro dev --background` (see Development section above) serves on `http://localhost:4321`. It's a single service; there is nothing else to start.
- Type-check: `npm run check` (`astro check`). A clean run reports `0 errors, 0 warnings`; the ~90 "hints" all come from the vendored `public/draco/*` wasm-wrapper files and content files and are expected — don't try to fix them.
- Build: `npm run build` → static output in `dist/`. The "chunks larger than 500 kB" Vite warning is expected (heavy `three`/postprocessing islands) and not an error.
- No automated test suite exists in this repo (no test runner configured); verify changes via `npm run check`, `npm run build`, and manually in the browser.
- Node 22.14 satisfies the project's `>=22.12.0` engine requirement. `npm install` prints an `EBADENGINE` warning for the transitive `undici` package (wants Node `>=22.19.0`); this is only a warning and does not affect dev/build.
- The homepage shows a one-time-per-session preloader (gated by `sessionStorage`); click **ENTER** to reach the site. Heavy 3D islands are `client:only`, and `astro.config.mjs` keeps a hand-maintained `optimizeDeps.include` list — adding a new bare import in a `client:only` island may require adding it there (see the comment in that file) to avoid dev-server `504 Outdated Optimize Dep` errors.
