import * as THREE from "three";

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

export async function loadArchiveMediaSource(
  url: string,
): Promise<ArchiveMediaSource> {
  if (/\.webm$/i.test(url)) return loadArchiveVideo(url);

  /* webp only. duforn shipped .ktx2 siblings and a basis transcoder for GPU
     compression; at this poster count the saving didn't justify carrying the
     wasm blob and its loader init, so the plain loader takes the .webp. */
  const texture = await new THREE.TextureLoader().loadAsync(url);
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

export function disposeArchiveMediaSource(source: ArchiveMediaSource): void {
  const image = source.texture.image as HTMLVideoElement | undefined;
  if (image instanceof HTMLVideoElement) {
    image.pause();
    image.removeAttribute("src");
    image.load();
  }
  source.texture.dispose();
}
