import * as THREE from "three";
import { isMobileLayout } from "@/lib/site/isMobileLayout";

/**
 * Longest edge we are willing to hand the GPU, per device class. Must match
 * `CAPS` in `scripts/archive-variants.mjs` — the URL is built from the number.
 *
 * The masters are print-scale. `Poster9 File.webp` is 3000x4000: 756KB over
 * the wire and 45MB of RGBA decoded, for a tile drawn at ~165px in orb view.
 * All eleven together were 5.1MB and ~112MB of texture memory, and the poster
 * field waits on every one of them, so a 4 Mbps phone stared at an empty orb
 * for fifteen seconds. The phone cap is 1024 because this canvas is
 * `dpr={[1, 1.5]}` — a 390px screen is a 1266px-tall buffer, which is what a
 * grid poster fills.
 */
const TEXTURE_CAPS = { mobile: 1024, desktop: 1600 } as const;

/**
 * The variant URL for this device, or null when there is nothing to swap to.
 *
 * Dev is deliberately left on the masters: the variants are a `prebuild`
 * artifact and are gitignored, so a dev server that has never built would eat
 * a 404 per poster to discover they are missing. Production still falls back
 * (see `loadArchiveImage`) in case the sharp step was skipped.
 */
function variantUrl(url: string): string | null {
  if (!import.meta.env.PROD) return null;
  if (!/\.webp$/i.test(url)) return null;
  const cap = isMobileLayout() ? TEXTURE_CAPS.mobile : TEXTURE_CAPS.desktop;
  /* Paths in the manifest are pre-encoded and several carry `%20`, so this
     splices the basename rather than round-tripping through decode/encode. */
  const slash = url.lastIndexOf("/");
  const dir = url.slice(0, slash);
  const file = url.slice(slash + 1);
  return `${dir}/generated/${file.replace(/\.webp$/i, `-${cap}.webp`)}`;
}

function configureArchiveTexture(texture: THREE.Texture): void {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
}

export type ArchiveMediaSource = {
  url: string;
  texture: THREE.Texture;
  isVideo: boolean;
  width: number;
  height: number;
};

/**
 * Longest one clip may take to hand over a frame.
 *
 * Safari on iOS can leave a `<video>` in limbo — no data, no `error` event —
 * and every source has to settle before the poster field builds, so an
 * unbounded wait means an archive of nothing but the centre word.
 */
const VIDEO_READY_TIMEOUT_MS = 6000;

function canPlayWebm(video: HTMLVideoElement): boolean {
  return (
    video.canPlayType('video/webm; codecs="vp9"') !== "" ||
    video.canPlayType("video/webm") !== ""
  );
}

function loadArchiveVideo(url: string): Promise<ArchiveMediaSource> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    // Every Safari that cannot decode WebM reports "" here, which is a cheaper
    // and more reliable answer than the `error` event some versions never fire.
    if (!canPlayWebm(video)) {
      reject(new Error(`archive video unsupported: ${url}`));
      return;
    }

    let timer = 0;

    const stopListening = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };

    const release = () => {
      video.removeAttribute("src");
      video.load();
    };

    function onReady() {
      stopListening();
      // Reflect intrinsic size onto the element — tile aspect is read from
      // texture.image.width/height, which on a <video> defaults to 0 (→ squished).
      video.width = video.videoWidth || 1;
      video.height = video.videoHeight || 1;
      if (video.paused) void video.play().catch(() => {});
      const texture = new THREE.VideoTexture(video);
      configureArchiveTexture(texture);
      resolve({
        url,
        texture,
        isVideo: true,
        width: video.videoWidth || 1,
        height: video.videoHeight || 1,
      });
    }

    function onError() {
      stopListening();
      release();
      reject(new Error(`archive video failed: ${url}`));
    }

    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    video.src = url;
    video.load();
    // iOS holds media data back until playback is asked for, so `loadeddata`
    // only ever arrives if we ask first — waiting for it before calling play()
    // deadlocks there. Muted + playsInline keeps this inside autoplay policy.
    void video.play().catch(() => {});

    timer = window.setTimeout(() => {
      stopListening();
      release();
      reject(new Error(`archive video timed out: ${url}`));
    }, VIDEO_READY_TIMEOUT_MS);
  });
}

/**
 * `url` stays the manifest path even when a variant was fetched: it is the
 * identity `ArchivePosterField` looks `span` up by, and the tile's aspect comes
 * from the decoded image, so a variant needs no entry of its own.
 */
async function loadArchiveImage(url: string): Promise<ArchiveMediaSource> {
  /* webp only. duforn shipped .ktx2 siblings and a basis transcoder for GPU
     compression; at this poster count the saving didn't justify carrying the
     wasm blob and its loader init, so the plain loader takes the .webp. */
  const loader = new THREE.TextureLoader();
  const variant = variantUrl(url);

  let texture: THREE.Texture;
  if (variant) {
    /* Fall back rather than fail: a build where the sharp step was skipped has
       no `generated/` at all, and a slow archive beats an empty one. */
    texture = await loader.loadAsync(variant).catch(() => loader.loadAsync(url));
  } else {
    texture = await loader.loadAsync(url);
  }

  configureArchiveTexture(texture);
  const img = texture.image as { width: number; height: number };
  return {
    url,
    texture,
    isVideo: false,
    width: img?.width || 1,
    height: img?.height || 1,
  };
}

export async function loadArchiveMediaSource(
  url: string,
): Promise<ArchiveMediaSource> {
  if (/\.webm$/i.test(url)) return loadArchiveVideo(url);
  return loadArchiveImage(url);
}

export function disposeArchiveMediaSource(source: ArchiveMediaSource): void {
  const image = source.texture.image as HTMLVideoElement | undefined;
  if (image instanceof HTMLVideoElement) {
    image.pause();
    image.removeAttribute("src");
    image.load();
  }
  source.texture.dispose();
}
