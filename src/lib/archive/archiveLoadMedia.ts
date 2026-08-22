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

export async function loadArchiveMediaSource(
  url: string,
): Promise<ArchiveMediaSource> {
  if (/\.webm$/i.test(url)) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.crossOrigin = "anonymous";
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.src = url;

      const onReady = () => {
        video.removeEventListener("loadeddata", onReady);
        // Reflect intrinsic size onto the element — tile aspect is read from
        // texture.image.width/height, which on a <video> defaults to 0 (→ squished).
        video.width = video.videoWidth || 1;
        video.height = video.videoHeight || 1;
        void video.play();
        const texture = new THREE.VideoTexture(video);
        configureArchiveTexture(texture);
        resolve({
          url,
          texture,
          isVideo: true,
          width: video.videoWidth || 1,
          height: video.videoHeight || 1,
        });
      };

      video.addEventListener("loadeddata", onReady);
      video.addEventListener("error", () =>
        reject(new Error(`archive video failed: ${url}`)),
      );
    });
  }

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
