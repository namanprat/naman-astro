import TeamCylinderCarousel from "./TeamCylinderCarousel";
import AnimeLink from "./AnimeLink";
import "./Team.css";

export default function Team() {
  return (
    <section className="team_wrap" id="team" aria-label="Studio">
      <TeamCylinderCarousel />
      <div className="team_copy container alignment-center">
        <h2 className="text-style-h1">
          We close
          <br />
          that gap.
        </h2>
        <div className="team_copy_stack">
          <p className="text-style-main alignment-center">
            Your website is where ideal customers decide if you&apos;re worth
            their time. We take what makes you irreplaceable, shape the entire
            experience around it, and make sure they feel that before they read
            another word.
          </p>
          <AnimeLink href="/work" className="team_cta">
            View Work
          </AnimeLink>
        </div>
      </div>
    </section>
  );
}
