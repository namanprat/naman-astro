import "./Manifesto.css";

/**
 * Markup only. The lead used to run its own scrubbed word-by-word rise; it is
 * now an ordinary `h1`, picked up by the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts`. `.manifesto_wrap` is absent from that module's SKIP
 * list for exactly this reason.
 */
export default function Manifesto() {
  return (
    <section className="manifesto_wrap" aria-label="Manifesto">
      <div className="manifesto_contain container gap-0">
        <div className="manifesto_layout grid is-12">
          <h1 className="manifesto_lead text-style-h2">
            I&apos;m a digital designer with a simple goal: close the gap
            between who you are and how the world sees you. I spend most of my
            time designing websites, obsessing over details, and turning ideas
            into experiences that feel clear, intuitive, and visually
            compelling. Good design isn&apos;t about adding more — it&apos;s
            knowing what to leave out.
          </h1>
        </div>
      </div>
    </section>
  );
}
