#!/usr/bin/env node
/**
 * Fail if a migrated stylesheet grows back the conventions we just killed.
 * Menu/Work/AboutPanel still carry grid-column @media, so they stay off this
 * list until those layout shifts can move onto responsive vars.
 */
import { readFileSync } from "node:fs";

const files = [
  "src/components/site/Faq.css",
  "src/components/site/Process.css",
  "src/components/site/Manifesto.css",
  "src/components/site/Team.css",
  "src/components/site/AnimeLink.css",
  "src/components/site/RollingText.css",
  "src/components/ViewSwitcher.css",
  "src/styles/patterns.css",
  "src/components/site/FluidCanvas.css",
  "src/components/site/Preloader.astro",
  "src/pages/404.astro",
];

const bans = [
  { name: "@media width breakpoint", re: /@media[^{]*width/ },
  { name: "legacy alias var(--ink|--accent|--dark|--white|--black)", re: /var\(--(ink|accent|dark|white|black)\)/ },
  { name: "BEM __ class", re: /\.[a-z]+__[a-z]/ },
  { name: "overflow: hidden", re: /overflow:\s*hidden/ },
  { name: "bare 1fr", re: /(?<!minmax\(0,\s*)1fr/ },
];

let failed = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  for (const { name, re } of bans) {
    if (re.test(src)) {
      console.error(`${file}: ${name}`);
      failed++;
    }
  }
}

if (failed) {
  console.error(`\n${failed} convention regression(s).`);
  process.exit(1);
}
console.log(`css-guard: ${files.length} files clean.`);
