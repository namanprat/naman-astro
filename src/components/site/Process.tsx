import "./Process.css";

/**
 * Markup only. The section heading is an ordinary `h2` and each card title an
 * `h3`, so both are picked up by the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts` — `.process` is absent from that module's SKIP list
 * for exactly this reason. The heading's `text-indent` survives the line split
 * because `styles/site.css` zeroes it on every continuation line.
 */
const CARDS = [
  {
    title: "Diagnose",
    description:
      "We find what's really stopping growth across brand, GTM, sales, pricing, talent and operations. Every gap and data blind spot gets surfaced and named, not glossed over. You leave with a clear picture of what to fix first.",
  },
  {
    title: "Build",
    description:
      "We build the commercial system your growth actually needs. Positioning, campaigns, CRM, dashboards and team structure come together as one coherent architecture. Execution systems replace guesswork with repeatable, measurable process.",
  },
  {
    title: "Orchestrate",
    description:
      "We own execution and keep every partner and channel pointed at a single revenue outcome. Delivery is managed end to end, not handed off and hoped on. We stay embedded and accountable until the numbers actually move.",
  },
];

export default function Process() {
  return (
    <section className="process" id="process" aria-label="Process">
      <div className="process__inner container gap-0">
        <div className="process__grid grid is-12">
          <div className="process__statement">
            <span className="process__label text-style-mono">(Process)</span>
            <h2 className="process__title text-style-h2">
              If any of this sounds familiar, you don&apos;t need another
              agency. You need a system. Voice gives you the words.
            </h2>
          </div>

          <ul className="process__cards">
            {CARDS.map((card, i) => (
              <li className="process__card" key={card.title}>
                <h3 className="process__card-title text-style-h3">
                  {card.title}
                </h3>
                <div className="process__card-foot">
                  <span className="process__card-index text-style-mono">
                    {`0${i + 1} / 0${CARDS.length}`}
                  </span>
                  <p className="process__card-copy text-style-main">
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
