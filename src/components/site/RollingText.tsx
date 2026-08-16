import { useEffect, useRef, type ReactNode } from "react";
import { initRollingText } from "../../lib/site/rollingText";
import "./RollingText.css";

type RollingTextProps = {
  children: ReactNode;
  className?: string;
};

export default function RollingText({ children, className }: RollingTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const textKey =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return initRollingText(el);
  }, [textKey, children]);

  return (
    <span
      ref={ref}
      className={["roll-text", className].filter(Boolean).join(" ")}
    >
      {children}
    </span>
  );
}
