/**
 * Cover videos load when they approach the viewport, not when the page does.
 *
 * `/work` renders every project's `ProjectDetail` at once for the Flip overlay,
 * so a plain `autoPlay` attribute meant the gallery pulled down every cover
 * video on arrival — including one that was 30MB. `preload` is only a hint and
 * autoplay overrides it, so the reliable lever is the `src` itself: the markup
 * carries `data-lazy-src` and nothing is requested until this hands it over.
 *
 * Also pauses on the way out, so an off-screen loop isn't decoding frames.
 */
export function bootLazyVideos(root: ParentNode = document): () => void {
  const videos = root.querySelectorAll<HTMLVideoElement>("video[data-lazy-src]");
  if (!videos.length) return () => {};

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLVideoElement;
        if (!entry.isIntersecting) {
          el.pause();
          continue;
        }
        const src = el.dataset.lazySrc;
        if (src) {
          el.src = src;
          delete el.dataset.lazySrc;
        }
        // Autoplay can still be refused (power saving, a policy change mid-page).
        // Nothing depends on it playing, so a rejection is not an error.
        void el.play().catch(() => {});
      }
    },
    { rootMargin: "25% 0px", threshold: 0 },
  );

  videos.forEach((video) => io.observe(video));
  return () => io.disconnect();
}
