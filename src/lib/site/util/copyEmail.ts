import { useEffect, useRef, useState, type MouseEvent } from "react";

const HOLD_MS = 5000;

function emailFromMailto(href: string): string {
  return decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
}

type CopyEmailBinding = {
  copied: boolean;
  label: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * Copy-to-clipboard on an email anchor, for callers that are not React.
 *
 * ponytail: the same behaviour as `useCopyEmail` below, expressed against the
 * DOM. It takes a `setLabel` rather than writing the text itself, because the
 * only caller renders that label through RollingText's per-char glyph stacks —
 * swapping `textContent` under those would leave the stacks describing the old
 * word. How to rebuild them is the caller's knowledge, not this module's.
 *
 * It sits beside the hook rather than replacing it because `Menu.tsx` is still
 * React and still needs the hook. When that converts, the hook goes.
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

export function useCopyEmail(href: string): CopyEmailBinding {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const address = emailFromMailto(href);
    const copiedOk = () => {
      setCopied(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setCopied(false), HOLD_MS);
    };

    if (typeof navigator.clipboard?.writeText !== "function") {
      window.location.href = href;
      return;
    }

    void navigator.clipboard.writeText(address).then(copiedOk, () => {
      window.location.href = href;
    });
  };

  return {
    copied,
    label: copied ? "Email copied" : "Email",
    onClick,
  };
}
