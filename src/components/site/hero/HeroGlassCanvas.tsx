/**
 * Frosted-glass hero, ported from `duforn-old/logo-3d.js`.
 *
 * It lives in the Menu island rather than in `.hero`, and that is not a filing
 * choice. `html:has(.hero) main { z-index: 0 }` (FluidCanvas.css) makes `main` a
 * stacking context on home, so nothing inside it can paint above `.name_hero`
 * (body level, `--z--raised`). The brief puts the glass over the wordmark and
 * under the nav, which only a body-level sibling can be:
 *
 *   main (0) → .fluid_wrap (0) · .hero (1) · .studio (2)
 *   .name_hero      1
 *   .hero_glass     5   ← here
 *   .nav_wrap     200
 *
 * `.hero_chrome` is `display: contents` and so is `<astro-island>`, so a child
 * added here is a body-level participant. It is absolutely positioned at the
 * document top rather than fixed, so it scrolls away with the first viewport
 * exactly as `#logo-model` did.
 *
 * ponytail: no `toneMapping`. duforn-old ran ACES over a chrome shader; here the
 * wordmark inside the scene has to match `var(--text)` in the DOM to the byte,
 * and a tone curve on the way out breaks that.
 */
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { PAGE_REVEALED_EVENT, isPageRevealed } from "@/lib/site/pageReveal";
import { ensureGlassGui } from "@/lib/site/hero/glassGui";
import {
  GLASS_MOBILE_MATERIAL,
  getGlassTuning,
  subscribeGlassTuning,
} from "@/lib/site/hero/glassTuning";
import HeroGlassModel from "./HeroGlassModel";
import HeroWordmark from "./HeroWordmark";
import "./HeroGlass.css";

/** Anything below this and the hero has scrolled away; stop rendering. */
const VISIBILITY_ROOT_MARGIN = "0px";

function useMediaFlag(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const apply = () => setMatches(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [query]);
  return matches;
}

/** The page fill, read the same way `useThemeInk` reads `--text`. */
function usePageColor(): THREE.Color {
  const [color] = useState(() => new THREE.Color("#101010"));
  const [, bump] = useState(0);

  useEffect(() => {
    const apply = () => {
      const probe = document.createElement("span");
      probe.style.color = "var(--background)";
      document.documentElement.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      if (value) color.set(value);
      bump((n) => n + 1);
    };
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, [color]);

  return color;
}

/**
 * Can this browser give us a context at all?
 *
 * three throws outright when `getContext` returns null, and there is no error
 * boundary between here and the Menu island, so an unprobed `<Canvas>` would
 * take the whole chrome down with it. Returning `false` instead leaves
 * `is-hero-webgl` unset, and the DOM lockup in `Menu.css` paints as it always
 * did — the mark is never the thing that goes missing.
 *
 * The probe canvas is mounted inside the host, so anything selecting on
 * `.hero_glass` (the WebGL stub in `tests/helpers.ts`, say) catches the probe
 * and the real canvas with one selector.
 */
function useWebglSupport(host: HTMLElement | null): boolean | null {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    if (!host) return;
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    host.appendChild(probe);
    let ok = false;
    try {
      ok = !!probe.getContext("webgl2");
    } catch {
      ok = false;
    }
    probe.remove();
    setSupported(ok);
  }, [host]);
  return supported;
}

/** True once the page is visible — the preloader hides this island anyway, so
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

export default function HeroGlassCanvas() {
  const mobile = useMediaFlag(MOBILE_LAYOUT_MQ);
  const reduced = useMemo(() => prefersReducedMotion(), []);
  const revealed = usePageRevealed();
  const pageColor = usePageColor();
  const [onScreen, setOnScreen] = useState(true);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const webgl = useWebglSupport(host);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribeGlassTuning(() => setTick((n) => n + 1)), []);
  useEffect(() => void ensureGlassGui(), []);

  useEffect(() => {
    if (!host) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { rootMargin: VISIBILITY_ROOT_MARGIN },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, [host]);

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

  const active = revealed && onScreen;

  return (
    <div className="hero_glass" ref={setHost} aria-hidden="true">
      {webgl === true && (
        <Canvas
          // Damping and the fling need frames of their own, so reduced motion
          // gets `demand` rather than a dead loop — the drag calls `invalidate`.
          frameloop={!active ? "never" : reduced ? "demand" : "always"}
          dpr={mobile ? [1, 1.25] : [1, 1.75]}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          camera={{ fov: 35, position: [0, 0, 5], near: 0.1, far: 50 }}
          resize={{ scroll: false }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          {/* Baked once (drei's `frames: 1`), so the rig costs one cubemap render
            and no bytes over the wire — the alternative was duforn-old's 6.7MB
            env.hdr. No `background`: the page shows through the canvas. */}
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
            <HeroGlassModel
              material={material}
              background={pageColor}
              interactive={!mobile}
              animate={!reduced}
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
