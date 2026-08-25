/**
 * Live `--text` for WebGL surfaces that follow the theme toggle.
 *
 * ponytail: the toggle swaps a class on `documentElement`, so a MutationObserver
 * on that one attribute is the whole subscription — no custom event needed.
 */
import { useEffect, useState } from "react";
import { readThemeInk } from "./asciiAtlas";

export function useThemeInk(fallback = "#8b8b8b"): string {
  const [ink, setInk] = useState(fallback);

  useEffect(() => {
    const apply = () => setInk(readThemeInk());
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);

  return ink;
}

/** Same one-attribute subscription, for surfaces that only need light vs dark. */
export function useThemeLight(): boolean {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const apply = () =>
      setLight(document.documentElement.classList.contains("theme-light"));
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => mo.disconnect();
  }, []);

  return light;
}
