/**
 * sessionStorage that can't throw.
 *
 * Private mode and blocked-storage settings make every access a potential
 * throw, and these flags are read on boot paths where an exception would
 * strand the page mid-transition. Every caller wanted the same fallback: the
 * value, or nothing.
 *
 * The `is:inline` scripts in BaseLayout, index and work keep hand-rolled
 * try/catch — they run before any bundle loads, so they can't import this.
 */

export function readFlag(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeFlag(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // blocked storage — the flag just doesn't survive the navigation
  }
}

export function clearFlag(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // nothing to clear if storage is unavailable
  }
}

/** Read and clear in one go — for flags that must fire exactly once. */
export function takeFlag(key: string): string | null {
  const value = readFlag(key);
  if (value !== null) clearFlag(key);
  return value;
}
