/**
 * Home Lenis boot only. Studio sections compose in `PortfolioHome.astro` so
 * native Astro can sit between React islands. `setSiteLenis` still publishes
 * for Menu/Footer via the bridge.
 */
import { SiteScroll } from "@/lib/site/lenisBoot";

export default function HomeLenis() {
  return <SiteScroll>{null}</SiteScroll>;
}
