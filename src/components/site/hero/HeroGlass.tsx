/**
 * Frosted-glass hero, ported from `duforn-old/logo-3d.js`.
 *
 * It has no canvas of its own. It mounts inside `FluidCanvas`'s scene, and that
 * is the entire point: `MeshTransmissionMaterial` refracts `scene.background`,
 * the fluid sim writes the backdrop into a render target, and `FluidCanvas`
 * hangs that target on `scene.background`. Two WebGL contexts could only have
 * traded that image through a per-frame readback; one context hands it over for
 * nothing, and the trails show through the glass.
 *
 * The backdrop canvas is `position: fixed` on home while the old `.hero_glass`
 * was absolute and scrolled away with the first viewport. `setViewOffset` puts
 * that back: it shifts the projection by `scrollY` pixels, which is a rigid
 * image translation at every depth — a camera translate is not, and would drift
 * the glass off the wordmark as the two planes parallaxed apart.
 *
 * ponytail: no `toneMapping`. duforn-old ran ACES over a chrome shader; here the
 * wordmark inside the scene has to match `var(--text)` in the DOM to the byte,
 * and a tone curve on the way out breaks that.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Environment, Lightformer } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { PAGE_REVEALED_EVENT, isPageRevealed } from "@/lib/site/pageReveal";
import { ensureGlassGui } from "@/lib/site/hero/glassGui";
import {
  GLASS_MOBILE_MATERIAL,
  getGlassTuning,
  subscribeGlassTuning,
} from "@/lib/site/hero/glassTuning";
import HeroGlassModel from "./HeroGlassModel";
import HeroAsciiReveal from "./HeroAsciiReveal";
import { HeroLogoShell } from "./HeroLogoShell";
import HeroWordmark from "./HeroWordmark";
import "./HeroGlass.css";

/** The phone runs the mark larger — it is the only thing in that viewport. */
const MOBILE_SCALE = 1.2;

/** True once the page is visible — the preloader hides the hero anyway, so
 *  painting behind it is a transmission FBO per frame for nothing. */
function usePageRevealed(): boolean {
  const [revealed, setRevealed] = useState(() => isPageRevealed());
  useEffect(() => {
    if (revealed) return;
    const onReveal = () => setRevealed(true);
    window.addEventListener(PAGE_REVEALED_EVENT, onReveal, { once: true });
    return () => window.removeEventListener(PAGE_REVEALED_EVENT, onReveal);
  }, [revealed]);
  return revealed;
}

/** Has the first viewport scrolled away? Stands in for the IntersectionObserver
 *  the old absolutely-positioned host carried. */
function useInFirstViewport(): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const sync = () => setInView(window.scrollY < window.innerHeight);
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);
  return inView;
}

/** Scrolls the hero out of frame with the page. See the note at the top. */
function ScrollOffset() {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  useFrame(() => {
    camera.setViewOffset(
      size.width,
      size.height,
      0,
      window.scrollY,
      size.width,
      size.height,
    );
    // Ahead of every render pass, for the reason in `HeroLogoShell` — the ASCII
    // matte is rendered through this same camera and must see this offset.
  }, -3);

  useEffect(() => () => camera.clearViewOffset(), [camera]);
  return null;
}

export default function HeroGlass({ mobile }: { mobile: boolean }) {
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const revealed = usePageRevealed();
  const inView = useInFirstViewport();
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeGlassTuning(() => setTick((n) => n + 1)), []);
  useEffect(() => void ensureGlassGui(), []);

  /** Phone overrides ride on top of whatever the GUI holds, and are not stored. */
  const material = useMemo(() => {
    const base = { ...getGlassTuning().material };
    return mobile
      ? ({ ...base, ...GLASS_MOBILE_MATERIAL } as Record<
          string,
          number | boolean
        >)
      : (base as unknown as Record<string, number | boolean>);
    // `tick` is the subscription: lil-gui mutates the store in place.
  }, [mobile, tick]);

  const envIntensity = getGlassTuning().scene.envIntensity;

  if (!revealed || !inView) return null;

  return (
    <>
      <ScrollOffset />
      {/* Baked once (drei's `frames: 1`), so the rig costs one cubemap render
          and no bytes over the wire — the alternative was duforn-old's 6.7MB
          env.hdr. No `background`: that slot belongs to the fluid sim. */}
      <Environment resolution={256}>
        <Lightformer
          form="rect"
          intensity={2.4 * envIntensity}
          position={[0, 3, 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[8, 4, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.6 * envIntensity}
          position={[-4, 0, 1]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.2 * envIntensity}
          position={[4, 0, 1]}
          rotation={[0, -Math.PI / 2, 0]}
          scale={[6, 6, 1]}
        />
        <Lightformer
          form="circle"
          intensity={2 * envIntensity}
          position={[0, 0, -4]}
          scale={5}
        />
      </Environment>

      <HeroWordmark />

      <Suspense fallback={null}>
        {/* The phone gets the mark as ASCII outright — no glass under it, and
            no mask, since there is no pointer trail at that width to mask with.
            It also costs less than the glass it replaces: one matte pass rather
            than the transmission material's two full-scene renders. */}
        <HeroLogoShell animate={!reduced} scale={mobile ? MOBILE_SCALE : 1}>
          {!mobile && <HeroGlassModel material={material} />}
          {!reduced && <HeroAsciiReveal masked={!mobile} />}
        </HeroLogoShell>
      </Suspense>
    </>
  );
}
