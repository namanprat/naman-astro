const HOLD_MS = 5000;

function emailFromMailto(href: string): string {
  return decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
}

/**
 * Copy-to-clipboard on an email anchor.
 *
 * It takes a `setLabel` rather than writing the text itself, because the
 * only caller renders that label through RollingText's per-char glyph stacks —
 * swapping `textContent` under those would leave the stacks describing the old
 * word. How to rebuild them is the caller's knowledge, not this module's.
 */
export function bindCopyEmail(
  anchor: HTMLAnchorElement,
  href: string,
  setLabel: (text: string) => void,
): void {
  let timeout = 0;

  anchor.addEventListener("click", (event) => {
    event.preventDefault();
    const address = emailFromMailto(href);
    const fallback = () => {
      window.location.href = href;
    };

    if (typeof navigator.clipboard?.writeText !== "function") {
      fallback();
      return;
    }

    void navigator.clipboard.writeText(address).then(() => {
      setLabel("Email copied");
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setLabel("Email"), HOLD_MS);
    }, fallback);
  });
}
