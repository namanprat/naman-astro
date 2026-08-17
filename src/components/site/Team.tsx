import TeamCylinderCarousel from "./TeamCylinderCarousel";
import AnimeLink from "./AnimeLink";
import "./Team.css";

export default function Team() {
  return (
    <section className="team" id="team">
      <TeamCylinderCarousel />
      <div className="team-copy container gap-0">
        <div className="team-copy__grid grid is-12">
          <h1 className="team-copy__title text-style-h1">
            We spot trends
            <br />
            before they&apos;re trends.
          </h1>
          <div className="team-copy__stack">
            <p className="text-style-main">
              Your website is where ideal customers decide if you&apos;re worth
              their time. We take what makes you irreplaceable, shape the entire
              experience around it, and make sure they feel that before they
              read another word.
            </p>
            <AnimeLink href="/work" className="team-cta">
              View Work
            </AnimeLink>
          </div>
        </div>
      </div>
    </section>
  );
}
