/**
 * What the home preloader actually waits on: webfonts, the grain texture (desktop
 * only — the overlay is `display: none` below 48rem), and the backdrop canvas'
 * first rendered frame.
 *
 * The About-panel bust GLB used to be a fourth segment carrying half the weight.
 * It is no longer waited on — see `warmBust` — because nothing on the home page
 * needs it and the visitor was queueing behind 3.5MB to reach the ENTER button.
 *
 * Every segment fails open — a dead asset reports complete rather than trapping
 * the visitor behind the ENTER gate.
 */
import { shouldMountAboutBust } from "./aboutBust";
import { isMobileLayout } from "./isMobileLayout";
import { completeAll, register, report } from "./preloadProgress";

const GRAIN_URL = "/main-assets/grain.webp";

/**
 * Flat deadline for the whole boot, same philosophy as REVEAL_FAILSAFE_MS in
 * `pollUntil`: one number to raise, not per-stage timeouts. Much longer than
 * the reveal budget — this one waits on multi-megabyte assets.
 */
const PRELOAD_FAILSAFE_MS = 12_000;

/** Fallback size when the response has no content-length (dev server, gzip). */
const GRAIN_ASSUMED_BYTES = 200_000;

let canvasReady: (() => void) | null = null;

/** Called from FluidSimulation once the backdrop has actually painted a frame. */
export function reportHomeCanvasReady(): void {
  report("canvas", 1);
  canvasReady?.();
  canvasReady = null;
}

/**
 * Fetch with byte-level progress. Returns the blob so the caller can warm the
 * decode too. Falls back to a plain response read if the body isn't streamable.
 */
async function fetchWithProgress(
  url: string,
  assumedBytes: number,
  onProgress: (t: number) => void,
): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);

  const declared = Number(response.headers.get("content-length"));
  const total = declared > 0 ? declared : assumedBytes;
  const reader = response.body?.getReader();
  if (!reader) return response.blob();

  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    // Cap below 1 so an under-guessed `assumedBytes` can't call it done early.
    onProgress(Math.min(received / total, 0.99));
  }
  onProgress(1);
  return new Blob(chunks as BlobPart[], {
    type: response.headers.get("content-type") ?? "",
  });
}

async function loadFonts(): Promise<void> {
  if (!document.fonts) return;
  await Promise.all([
    document.fonts.load('16px "Duforn Mono"'),
    document.fonts.load('700 16px "Hitmarker Condensed"'),
  ]);
  await document.fonts.ready;
}

async function loadGrain(): Promise<void> {
  const blob = await fetchWithProgress(GRAIN_URL, GRAIN_ASSUMED_BYTES, (t) =>
    report("grain", t),
  );
  // Decode now so `.site-grain`'s background-image doesn't hitch on reveal.
  const url = URL.createObjectURL(blob);
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
  URL.revokeObjectURL(url);
}

/**
 * Warm the About bust *after* the gate, not inside it.
 *
 * It was a registered segment carrying half the bar's weight — 3.5MB of GLB
 * plus a 144KB canvas chunk that the visitor waited behind before they could
 * press ENTER, for a panel they may never open. Importing the canvas module
 * runs its top-level `useGLTF.preload`, which populates drei's cache, so the
 * panel still opens with no parse stall; it just happens on idle time instead
 * of on the critical path.
 *
 * ponytail: fire-and-forget, no progress reporting. Ceiling: if the visitor
 * opens About within the first idle window they get today's cold-open latency
 * back, which is what the panel already falls back to.
 */
function warmBust(): void {
  if (!shouldMountAboutBust()) return;
  const run = () => {
    void import("@/components/site/about/AboutAsciiCanvas");
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 1200);
  }
}

/**
 * Same treatment for the hero glass, and for the same reason: importing the
 * module runs its top-level `useGLTF.preload`, so the 300KB logo lands in drei's
 * cache on idle time rather than in front of the ENTER button.
 *
 * ponytail: unlike the bust this one *is* on the page the visitor is looking at,
 * so it is a warm rather than a gate only because the mark underneath it paints
 * without it — the glass arriving a beat late costs nothing.
 */
function warmHeroGlass(): void {
  if (window.location.pathname !== "/") return;
  const run = () => {
    void import("@/components/site/hero/HeroGlass");
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 2000 });
  } else {
    setTimeout(run, 600);
  }
}

/** Kick off every segment. Resolves when all of them settle or the failsafe fires. */
export function startPreload(): Promise<void> {
  // Grain is `display: none` below 48rem — do not register it, so its weight
  // redistributes the same way an unregistered segment always does.
  const wantsGrain = !isMobileLayout();

  register("fonts", 10);
  if (wantsGrain) register("grain", 20);
  register("canvas", 20);

  const settle = (id: Parameters<typeof report>[0], task: Promise<unknown>) =>
    task.then(
      () => report(id, 1),
      () => report(id, 1),
    );

  const jobs = [
    settle("fonts", loadFonts()),
    new Promise<void>((resolve) => {
      canvasReady = resolve;
    }),
  ];
  if (wantsGrain) jobs.push(settle("grain", loadGrain()));

  const settled = Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((resolve) =>
      setTimeout(resolve, PRELOAD_FAILSAFE_MS),
    ).then(completeAll),
  ]);
  // Deliberately not chained into the returned promise: the caller gates ENTER
  // on this, and neither warm may be part of that wait.
  void settled.then(() => {
    warmBust();
    warmHeroGlass();
  });
  return settled;
}
