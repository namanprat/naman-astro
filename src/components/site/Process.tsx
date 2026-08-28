import { useEffect, useState } from "react";
import ProcessCardCanvas, { type ProcessCardShape } from "./ProcessCardCanvas";
import "./Process.css";

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
  shape: ProcessCardShape;
}> = [
  {
    title: "Uncover story",
    description:
      "I dig until I find what makes you irreplaceable. That becomes the strategy.",
    shape: "box",
  },
  {
    title: "Shape presence",
    description:
      "I design a brand and a site that feel considered, and worth staying on.",
    shape: "box",
  },
  {
    title: "Send it",
    description:
      "The site goes live and keeps working as you grow. No rebuild in a year.",
    shape: "box",
  },
];

/** Matches `--dark-900` so glyphs sit on the same ink as the type. */
const CARD_INK = "#101010";

export default function Process() {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = document.getElementById("process");
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
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
    >
      <div className="process_contain container gap-0">
        <div className="process_layout studio_layout grid is-12">
          <div className="process_statement studio_statement">
            <h2 className="process_title studio_title text-style-h2">
              <span className="studio_title_indent" aria-hidden="true" />I make
              websites that finally match what you&apos;ve actually built.
            </h2>
          </div>

          <ul className="process_cards">
            {CARDS.map((card) => (
              <li className="process_card" key={card.title}>
                <h3 className="process_card_title text-style-h3">
                  {card.title}
                </h3>
                <div className="process_card_media">
                  <ProcessCardCanvas
                    shape={card.shape}
                    ink={CARD_INK}
                    active={inView}
                  />
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
