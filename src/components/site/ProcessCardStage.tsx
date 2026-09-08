/**
 * One process card's WebGL stage: watches its own box, and only then pays for
 * the 3D stack.
 *
 * ponytail: a React file rather than logic in `Process.astro`'s `<script>`,
 * because mounting an R3F tree is React's job and an Astro `<script>` is
 * TypeScript, not TSX. This is the whole of what stays React here — the card's
 * markup, copy and styles are Astro now.
 *
 * ponytail: one of these per card, where `Process.tsx` had a single island
 * observing the whole section. The three stages are interleaved with Astro
 * markup, so a single island could only reach them through portals. Per-card
 * observers also gate `frameloop` per card rather than all-or-nothing.
 */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { ProcessCardId } from "@/lib/site/process/processModelTuning";

/**
 * `three`, `@react-three/fiber` and `@react-three/drei` are ~900KB between
 * them, and this section sits well below the fold. Statically imported (and
 * mounted unconditionally, with only `frameloop` gated) it put a live WebGL
 * context and the whole 3D stack on the home boot path. Lazy + mount-on-approach
 * keeps all of it off the critical path.
 */
const ProcessCardCanvas = lazy(() => import("./ProcessCardCanvas"));

/**
 * Matches `--dark-900` so glyphs sit on the same ink as the type.
 *
 * ponytail: a literal, not `--text`, and it must stay one. The card plate is
 * `--brand-500` in both themes, so following the theme toggle would paint the
 * glyphs light on orange and erase them. This is one of the three surfaces on
 * the site that deliberately ignores the toggle.
 */
const CARD_INK = "#101010";

export default function ProcessCardStage({ model }: { model: ProcessCardId }) {
  const [inView, setInView] = useState(false);
  /* Latched: once a canvas exists, keep it. Unmounting on every scroll-past
     would tear down and rebuild the WebGL context each time, which costs far
     more than leaving it parked at `frameloop: "never"`. */
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(!!entry?.isIntersecting);
        if (entry?.isIntersecting) setMounted(true);
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="process_card_stage" data-process-model={model} ref={ref}>
      {mounted ? (
        <Suspense fallback={null}>
          <ProcessCardCanvas ink={CARD_INK} active={inView} model={model} />
        </Suspense>
      ) : null}
    </div>
  );
}
