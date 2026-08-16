import type Lenis from "lenis";

type Listener = (lenis: Lenis | null) => void;

let current: Lenis | null = null;
const listeners = new Set<Listener>();

/** Register the home-page Lenis instance for chrome outside the ReactLenis tree. */
export function setSiteLenis(lenis: Lenis | null) {
  current = lenis;
  listeners.forEach((listener) => listener(lenis));
}

export function getSiteLenis() {
  return current;
}

export function subscribeSiteLenis(listener: Listener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
