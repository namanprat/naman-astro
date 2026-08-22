import type { ReactNode } from "react";
import { go } from "@/lib/site/navigate";
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
      <div className="anime_link">
        {/* `data-no-reveal` opts the label out of the line reveal. It has to sit
            on an ancestor, not the `h5` itself — both the JS query in
            `lib/site/lineReveal.ts` and the pre-paint hold in `styles/site.css`
            match `.text-style-main` and exclude only descendants of the skip
            list. Without it that module would SplitText this label, fighting the
            per-char stacks RollingText has already built, exactly as noted on
            the footer links. */}
        <div className="anime_link_label" data-no-reveal>
          <h5 className="text-style-main">
            <RollingText>{children}</RollingText>
          </h5>
        </div>
        <div className="anime_link_icon">
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
