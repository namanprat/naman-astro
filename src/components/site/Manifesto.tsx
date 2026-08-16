import "./Manifesto.css";

/**
 * Markup only. The lead used to run its own scrubbed word-by-word rise; it is
 * now an ordinary `h2`, picked up by the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts`. `.manifesto` is absent from that module's SKIP
 * list for exactly this reason.
 */
export default function Manifesto() {
  return (
    <section className="manifesto" aria-label="Manifesto">
      <div className="manifesto__inner container gap-0">
        <div className="manifesto__grid grid is-12">
          <h2 className="manifesto__lead text-style-h2">
            I&apos;m a digital designer with a simple goal: make things look
            good and work even better. I spend most of my time designing
            websites, obsessing over details, and turning ideas into experiences
            that feel clear, intuitive, and visually compelling. Good design
            isn&apos;t about adding more — it&apos;s knowing what to leave out.
          </h2>
        </div>
      </div>
    </section>
  );
}
