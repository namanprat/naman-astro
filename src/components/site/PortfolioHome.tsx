import { SiteScroll } from "@/lib/site/lenisBoot";
import Manifesto from "./Manifesto";
import Team from "./Team";
import Process from "./Process";
import Faq from "./Faq";
import Footer from "./Footer";

export default function PortfolioHome() {
  return (
    <SiteScroll>
      <section className="hero" id="hero" aria-label="Home" />
      <div className="studio">
        <Manifesto />
        <Process />
        <Faq />
        <Team />
      </div>
      <Footer />
    </SiteScroll>
  );
}
