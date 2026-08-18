// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import { SITE_URL } from "./src/consts.ts";
import { isNoindexRoute } from "./src/utils/seo.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [
    react(),
    sitemap({
      filter: (page) => !isNoindexRoute(new URL(page).pathname),
    }),
  ],
  vite: {
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
