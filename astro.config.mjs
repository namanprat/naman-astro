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
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "@react-three/postprocessing",
        "postprocessing",
        "gsap",
        "gsap/CustomEase",
        "gsap/Draggable",
        "gsap/Flip",
        "gsap/InertiaPlugin",
        "gsap/Observer",
        "gsap/ScrollTrigger",
        "gsap/SplitText",
        "@gsap/react",
        "lenis",
        "lenis/react",
        "zustand",
      ],
    },
  },
});
