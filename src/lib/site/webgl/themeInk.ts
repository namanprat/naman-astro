/**
 * Live `--text` for WebGL surfaces that follow the theme toggle.
 *
 * Replaces `useThemeInk`/`useThemeLight`. The subscription is the same one the
 * hooks used — the toggle swaps a class on `documentElement`, so a
 * MutationObserver on that one attribute is the whole of it, with no custom
 * event to keep in sync.
 *
 * ponytail: one observer for the document, where the hooks made one per
 * consumer. Four surfaces subscribe (the footer wordmark, the Team cylinder,
 * the About bust, the hero reveal), and a MutationObserver on
 * `documentElement`'s class fires for every class the site toggles during a
 * page transition — `is-line-revealing`, `is-gooey-arming`, `is-page-covered`
 * — not just the theme. Four observers each re-reading `getComputedStyle` on
 * every one of those is four forced style recalcs per transition frame.
 */

type Listener = () => void;

/**
 * `--text`, resolved to an `rgb()` string.
 *
 * ponytail: through a probe element, not `getPropertyValue("--text")`. A custom
 * property comes back as whatever text was authored — which for this token is
 * another `var()` in a chain — whereas setting it as `color` on a throwaway span
 * makes the cascade resolve the chain and hand back a real colour. It also has
 * to live here rather than in `asciiAtlas.ts`, where it used to: this module is
 * imported by WebGPU stages, and `asciiAtlas` imports plain `three`, so reaching
 * across for one DOM read would drag a second copy of the library in with it.
 */
export function readThemeInk(): string {
  const probe = document.createElement("span");
  probe.style.color = "var(--text)";
  document.documentElement.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color || "#8b8b8b";
}

const listeners = new Set<Listener>();
let observer: MutationObserver | null = null;
let ink = "";
let light = false;

function read(): void {
  const nextInk = readThemeInk();
  const nextLight = document.documentElement.classList.contains("theme-light");
  if (nextInk === ink && nextLight === light) return;
  ink = nextInk;
  light = nextLight;
  for (const listener of [...listeners]) listener();
}

function ensureObserver(): void {
  if (observer) return;
  read();
  observer = new MutationObserver(read);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

/** Current `--text`, as an sRGB CSS string. */
export function themeInk(): string {
  ensureObserver();
  return ink;
}

/** Whether the light theme is active. */
export function themeLight(): boolean {
  ensureObserver();
  return light;
}

/** Fires when either of the above changes. Returns an unsubscribe. */
export function subscribeTheme(listener: Listener): () => void {
  ensureObserver();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // ponytail: the observer stays. Every consumer is a lazily-mounted WebGL
    // surface that can come back on the next scroll, and re-attaching costs a
    // fresh `getComputedStyle` read at exactly the moment a stage is booting.
  };
}
