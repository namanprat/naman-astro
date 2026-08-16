import { useEffect, useRef, useState, type MouseEvent } from "react";

const HOLD_MS = 5000;

function emailFromMailto(href: string): string {
  return decodeURIComponent(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
}

export function useCopyEmail(href: string) {
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
