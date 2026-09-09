import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: "SANITY_STUDIO_",
  build: {
    outDir: "dist",
    assetsDir: "static",
  },
});
