import type { ReactNode } from "react";
import { go } from "../../lib/site/navigate";
import RollingText from "./RollingText";
import "./AnimeLink.css";

type AnimeLinkProps = {
  children: ReactNode;
  className?: string;
  href: string;
};

export default function AnimeLink({
  children,
  className = "",
  href,
}: AnimeLinkProps) {
  return (
    <a
      href={href}
      className={className || undefined}
      onClick={(e) => {
        e.preventDefault();
        void go(href);
      }}
    >
      <div className="anime-link">
        <div className="anime-link-label">
          <h5 className="text-style-h5">
            <RollingText>{children}</RollingText>
          </h5>
        </div>
        <div className="anime-link-icon">
          {/* Ionicons md-arrow-forward, inlined. One glyph is not worth the
              react-icons dependency. */}
          <svg
            viewBox="0 0 512 512"
            width="1em"
            height="1em"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M85 277.375h259.704L225.002 397.077 256 427l171-171L256 85l-29.922 29.924 118.626 119.701H85v42.75z" />
          </svg>
        </div>
      </div>
    </a>
  );
}
