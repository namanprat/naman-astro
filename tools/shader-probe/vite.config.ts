import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

/**
 * Serves `index.html` with the project's `@/` alias, and nothing else.
 *
 * ponytail: its own Vite config rather than a route in `src/pages/`. An Astro
 * page would be the cheaper thing to write and would ship to `dist/` on every
 * build — a probe that renders 65k glyphs and reads the framebuffer back is not
 * something to leave on a public route.
 */
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../src", import.meta.url)),
    },
  },
  server: { port: 4399 },
});
