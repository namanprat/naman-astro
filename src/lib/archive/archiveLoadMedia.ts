import * as THREE from "three";
import type { ArchiveItem, ArchiveSpan } from "../../content/archive";

/**
 * Ceiling on a single video source. A `<video>` that stalls mid-negotiation
 * fires neither `loadeddata` nor `error`, and the poster field waits on the
 * whole batch — so without a deadline one wedged element means no posters at
 * all, indefinitely.
 */
const VIDEO_LOAD_TIMEOUT_MS = 8000;

const VIDEO_MIME: Record<string, string> = {
  webm: 'video/webm; codecs="vp9"',
  mp4: 'video/mp4; codecs="avc1.4d401e"',
};

export function configureArchiveTexture(texture: THREE.Texture) {
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
  span: ArchiveSpan;
};

function isVideoUrl(url: string): boolean {
  return /\.(webm|mp4)$/i.test(url);
}

/**
 * Candidates most-playable first. Safari cannot decode the VP9 webm at all, so
 * an unordered list handed it the one encoding it has no decoder for and the
 * clip failed outright.
 *
 * `canPlayType` is advisory — browsers answer `""` for formats they go on to
 * play, and `"maybe"` for ones they don't — so this only orders the attempts.
 * `loadVideoSource` still walks the list until one actually loads.
 */
function orderVideoCandidates(urls: string[]): string[] {
  const probe = document.createElement("video");
  const rank = (url: string): number => {
    const ext = url.split(".").pop()?.toLowerCase() ?? "";
    const mime = VIDEO_MIME[ext];
    if (!mime) return 2;
    switch (probe.canPlayType(mime)) {
      case "probably":
        return 0;
      case "maybe":
        return 1;
      default:
        return 3;
    }
  };
  return [...urls].sort((a, b) => rank(a) - rank(b));
}

function loadVideoTexture(
  url: string,
): Promise<{ texture: THREE.Texture; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    let timer = 0;

    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("error", onError);
    };

    const fail = (reason: string) => {
      cleanup();
      video.removeAttribute("src");
      video.load();
      reject(new Error(`archive video ${reason}: ${url}`));
    };

    function onReady() {
      cleanup();
      // Reflect intrinsic size onto the element — tile aspect is read from
      // texture.image.width/height, which on a <video> defaults to 0 (→ squished).
      video.width = video.videoWidth || 1;
      video.height = video.videoHeight || 1;
      void video.play();
      const texture = new THREE.VideoTexture(video);
      configureArchiveTexture(texture);
      resolve({
        texture,
        width: video.videoWidth || 1,
        height: video.videoHeight || 1,
      });
    }

    function onError() {
      fail("failed");
    }

    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("error", onError);
    timer = window.setTimeout(() => fail("timed out"), VIDEO_LOAD_TIMEOUT_MS);
    video.src = url;
  });
}

async function loadVideoSource(
  urls: string[],
): Promise<{ url: string; texture: THREE.Texture; width: number; height: number }> {
  let last: unknown;
  for (const url of orderVideoCandidates(urls)) {
    try {
      return { url, ...(await loadVideoTexture(url)) };
    } catch (err) {
      last = err;
    }
  }
  throw last ?? new Error("archive video: no playable source");
}

export async function loadArchiveMediaSource(
  item: ArchiveItem,
): Promise<ArchiveMediaSource> {
  const span = item.span ?? "height";

  if (isVideoUrl(item.src)) {
    const picked = await loadVideoSource([item.src, ...(item.fallbacks ?? [])]);
    return { ...picked, isVideo: true, span };
  }

  /* webp only. duforn shipped .ktx2 siblings and a basis transcoder for GPU
     compression; at this poster count the saving didn't justify carrying the
     wasm blob and its loader init, so the plain loader takes the .webp. */
  const texture = await new THREE.TextureLoader().loadAsync(item.src);
  configureArchiveTexture(texture);
  const img = texture.image as { width: number; height: number };
  return {
    url: item.src,
    texture,
    isVideo: false,
    width: img?.width || 1,
    height: img?.height || 1,
    span,
  };
}

export function disposeArchiveMediaSource(source: ArchiveMediaSource) {
  const image = source.texture.image as HTMLVideoElement | undefined;
  if (image instanceof HTMLVideoElement) {
    image.pause();
    image.removeAttribute("src");
    image.load();
  }
  source.texture.dispose();
}
