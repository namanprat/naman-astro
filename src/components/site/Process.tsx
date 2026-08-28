import { lazy, Suspense, useEffect, useRef, useState } from "react";
import "./Process.css";

/**
 * `three`, `@react-three/fiber` and `@react-three/drei` are ~900KB between
 * them, and this section sits well below the fold. Statically imported (and
 * mounted three times unconditionally, with only `frameloop` gated) it put
 * three live WebGL contexts and the whole 3D stack on the home boot path.
 * Lazy + mount-on-approach keeps all of it off the critical path.
 */
const ProcessCardCanvas = lazy(() => import("./ProcessCardCanvas"));

/**
 * The section heading is an ordinary `h2` and each card title an `h3`, so both
 * are picked up by the site-wide gooey entrance in `lib/site/gooeyReveal.ts` —
 * `.process` is absent from that module's SKIP list for exactly this reason.
 * The heading's hanging first line is the empty `.studio_title_indent` box,
 * not a `text-indent` — being ordinary inline content, it wraps and splits
 * along with the rest of the heading.
 */
const CARDS: ReadonlyArray<{
  title: string;
  description: string;
}> = [
  {
    title: "Uncover story",
    description:
      "I dig until I find what makes you irreplaceable. That becomes the strategy.",
  },
  {
    title: "Shape presence",
    description:
      "I design a brand and a site that feel considered, and worth staying on.",
  },
  {
    title: "Send it",
    description:
      "The site goes live and keeps working as you grow. No rebuild in a year.",
  },
];

/** Matches `--dark-900` so glyphs sit on the same ink as the type. */
const CARD_INK = "#101010";

export default function Process() {
  const [inView, setInView] = useState(false);
  /* Latched: once a canvas exists, keep it. Unmounting on every scroll-past
     would tear down and rebuild three WebGL contexts each time, which costs
     far more than leaving them parked at `frameloop: "never"`. */
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "20% 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      className="process_wrap studio_section"
      id="process"
      aria-label="Process"
      ref={rootRef}
    >
      <div className="process_contain container gap-0">
        <div className="process_layout studio_layout grid is-12">
          <div className="process_statement studio_statement">
            <h2 className="process_title studio_title text-style-h2">
              <span className="studio_title_indent" aria-hidden="true" />I build
              brands and everything they live on, so you look like yourself from
              day one.
            </h2>
          </div>

          <ul className="process_cards">
            {CARDS.map((card, i) => (
              <li className="process_card" key={card.title}>
                <div className="process_card_head">
                  <h3 className="process_card_title text-style-h3">
                    {card.title}
                  </h3>
                  <span
                    className="process_card_index text-style-small"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(3, "0")}
                  </span>
                </div>
                <div className="process_card_media">
                  <div className="process_card_stage">
                    {mounted ? (
                      <Suspense fallback={null}>
                        <ProcessCardCanvas ink={CARD_INK} active={inView} />
                      </Suspense>
                    ) : null}
                  </div>
                </div>
                <p className="process_card_copy text-style-main">
                  {card.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
