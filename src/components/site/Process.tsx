import "./Process.css";

/**
 * Markup only. The section heading is an ordinary `h2` and each card title an
 * `h3`, so both are picked up by the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts` — `.process` is absent from that module's SKIP list
 * for exactly this reason. The heading's hanging first line is the empty
 * `.studio_title_indent` box, not a `text-indent` — being ordinary inline
 * content, it wraps and splits along with the rest of the heading.
 */
const CARDS = [
  {
    title: "Uncover your story",
    description:
      "We dig into your brand, surface what makes you irreplaceable, and shape it into sharp positioning and a website strategy that connects in seconds.",
  },
  {
    title: "Shape the presence",
    description:
      "With the narrative locked, we design a brand and website that feels premium, signals credibility, and gives your audience one clear reason to lean in and act.",
  },
  {
    title: "Send it into the world",
    description:
      "The site goes live as a long-term asset that turns attention into opportunity, attracts the clients you're built for, and grows with you.",
  },
];

export default function Process() {
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
              <span className="studio_title_indent" aria-hidden="true" />
              We design website experiences that finally reflect what
              you&apos;ve actually built.
            </h2>
          </div>

          <ul className="process_cards">
            {CARDS.map((card, i) => (
              <li className="process_card" key={card.title}>
                <h3 className="process_card_title text-style-h3">
                  {card.title}
                </h3>
                <div className="process_card_foot">
                  <span className="process_card_index text-style-mono">
                    {`0${i + 1} / 0${CARDS.length}`}
                  </span>
                  <p className="process_card_copy text-style-main">
                    {card.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
