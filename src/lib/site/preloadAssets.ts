/**
 * What the home preloader actually waits on: webfonts, the grain texture (desktop
 * only — the overlay is `display: none` below 48rem), the About-panel bust GLB,
 * and the backdrop canvas' first rendered frame.
 *
 * Every segment fails open — a dead asset reports complete rather than trapping
 * the visitor behind the ENTER gate.
 */
import { BUST_URL, shouldMountAboutBust } from "./aboutBust";
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
const GRAIN_ASSUMED_BYTES = 2_900_000;
const BUST_ASSUMED_BYTES = 3_600_000;

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

async function loadBust(): Promise<void> {
  await fetchWithProgress(BUST_URL, BUST_ASSUMED_BYTES, (t) =>
    report("bust", t),
  );
  // ponytail: the streaming fetch above exists only for a byte-accurate bar; it
  // warms the HTTP cache. Importing the canvas module then runs its top-level
  // `useGLTF.preload`, which re-requests from that cache and populates drei's
  // own cache so the About panel opens with no parse stall. Two requests, one
  // download. Ceiling: if drei ever caches by loader instance this breaks
  // silently — the panel would just lazy-load as it does today.
  await import("@/components/site/about/AboutAsciiCanvas");
}

/** Kick off every segment. Resolves when all of them settle or the failsafe fires. */
export function startPreload(): Promise<void> {
  const wantsBust = shouldMountAboutBust();
  // Grain is `display: none` below 48rem — do not register it, so its weight
  // redistributes the same way the bust does when it is not mounted.
  const wantsGrain = !isMobileLayout();

  register("fonts", 10);
  if (wantsGrain) register("grain", 20);
  register("canvas", 20);
  if (wantsBust) register("bust", 50);

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
  if (wantsBust) jobs.push(settle("bust", loadBust()));

  return Promise.race([
    Promise.all(jobs).then(() => undefined),
    new Promise<void>((resolve) =>
      setTimeout(resolve, PRELOAD_FAILSAFE_MS),
    ).then(completeAll),
  ]);
}
