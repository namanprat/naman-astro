// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/consts.ts";
import { isNoindexRoute } from "./src/utils/seo.ts";

// `astro check` and `astro build` share Vite's default `node_modules/.vite`
// cache with `astro dev`. A check/build pass rewrites that cache in production
// mode (`exports.jsxDEV = void 0` in react-jsx-dev-runtime.production.js). The
// still-running dev server keeps serving those files, and every island dies
// with `_jsxDEV is not a function`. Split the caches so the two modes cannot
// overwrite each other.
const viteCacheDir = process.argv.some((arg) => arg === "build" || arg === "check")
  ? "node_modules/.vite/build"
  : "node_modules/.vite/dev";

/**
 * Browser floor, for Lightning CSS (the CSS minifier Vite runs).
 *
 * Lightning CSS owns vendor prefixing, and it only does that job when it knows
 * what it is targeting. With no targets it keeps whatever the author wrote and
 * prunes the rest — so hand-writing a prefix does not add safety, it replaces
 * the tool's judgement with the author's.
 *
 * That is not academic here. The stylesheets used to spell both halves out:
 *
 *     backdrop-filter: blur(var(--surface-frost-blur));
 *     -webkit-backdrop-filter: blur(var(--surface-frost-blur));
 *
 * Lightning CSS merges a prefixed/unprefixed pair into one property, and with
 * no targets the last declaration wins outright — so the build shipped the
 * `-webkit-` form *alone*. Safari honours it; Chromium has dropped the alias
 * and Firefox never had it. Every frosted surface on the site — the About
 * card, the footer, the /work view switcher, the preloader — therefore
 * computed `backdrop-filter: none` in both, and read as a flat tint.
 *
 * So: write the unprefixed property once, and let this list decide where the
 * prefix comes back. The floor is what the CSS already requires — `:has()`,
 * `@layer`, `color-mix()`, `100dvh` — so declaring it downlevels nothing that
 * was not already out of reach. Safari is the load-bearing entry: it only got
 * unprefixed `backdrop-filter` in 18, so anything below that is what makes
 * Lightning CSS emit the `-webkit-` alias alongside.
 *
 * It has to be `build.cssTarget`, not `css.lightningcss.targets`. Vite's
 * minify path spreads `css.lightningcss` and then overwrites `targets` with
 * `convertTargets(config.build.cssTarget)`, so the other spelling is read for
 * the transform step and silently dropped for the one that ships.
 */
const cssTarget = [
  "chrome111",
  "edge111",
  "firefox121",
  "safari16.4",
  "ios16.4",
];

export default defineConfig({
  site: SITE_URL,
  integrations: [
    react(),
    sitemap({
      filter: (page) => !isNoindexRoute(new URL(page).pathname),
    }),
  ],
  vite: {
    cacheDir: viteCacheDir,
    build: { cssTarget },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    // Every heavy island here is `client:only`, so Vite's dep scanner never
    // sees these imports at boot. Without this list it discovers them on the
    // first request instead, re-optimizes mid-flight, and the in-flight island
    // import dies with "504 Outdated Optimize Dep".
    //
    // Subpaths are optimized as their own entries, so each one has to be named
    // — "gsap" does not cover "gsap/Flip".
    //
    // ponytail: hand-maintained list, so a new bare import in a client:only
    // island brings the 504 back until it is added here. Regenerate with:
    //   grep -rhoE 'from "[^"./][^"]*"' src | sed 's/from "//;s/"//' | sort -u
    // Upgrade path if it drifts often: derive it in this config from that scan.
    optimizeDeps: {
      include: [
        // React and its scheduler are named even though nothing here imports
        // them as bare specifiers from a client:only island. `@react-three/fiber`
        // depends on `scheduler` directly, so force-including fiber without
        // these pre-bundles fiber (and the scheduler it pulls in) while React
        // itself is still served raw from node_modules. The two halves then come
        // from different builds — a development `react/jsx-runtime` meeting a
        // production `scheduler` — and hydration dies with
        // "dispatcher.getOwner is not a function" on whichever route mounts the
        // R3F canvas first. Naming them puts every piece in one optimize pass,
        // in one mode. Whether it breaks otherwise depends on optimize-pass
        // ordering, so it reproduces on some machines and not others.
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "scheduler",
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "@react-three/postprocessing",
        "postprocessing",
        "gsap",
        "gsap/CustomEase",
        "gsap/Flip",
        "gsap/Observer",
        "gsap/ScrollTrigger",
        "gsap/SplitText",
        "@gsap/react",
        "lenis",
        "lenis/react",
      ],
    },
  },
});
