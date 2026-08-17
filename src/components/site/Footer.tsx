import { useRef } from "react";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { go } from "../../lib/site/navigate";
import { hashId, scrollToSection } from "../../lib/site/scrollToSection";
import { toggleAboutPanel } from "../../lib/site/aboutPanel";
import {
  addGooeyReveal,
  parkGooey,
  prepareGooey,
  type GooeyTarget,
} from "../../lib/site/gooeyReveal";
import { prefersReducedMotion } from "../../lib/site/prefersReducedMotion";
import { useCopyEmail } from "../../lib/site/copyEmail";
import { EMAIL_HREF, NAV_STACKS, SOCIAL_LINKS } from "./Menu";
import FooterAsciiLogo from "./FooterAsciiLogo";
import RollingText from "./RollingText";
import "./Footer.css";

gsap.registerPlugin(ScrollTrigger);

/** Same routes the navbar carries, flattened, with Archive on the end.
 *  Contact is omitted — the footer *is* the contact section. */
const FOOTER_LINKS = [
  ...NAV_STACKS.flatMap(({ links }) =>
    links
      .filter(({ id }) => id !== "contact")
      .map(({ label, path }) => ({ label, path })),
  ),
  { label: "Archive", path: "/archive" },
];

/** One gooey-revealed line. The GSAP pass below drives every .footer-text. */
function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <span className="footer-text">
      <span className="footer-text-content gooey-reveal__inner">
        {children}
      </span>
    </span>
  );
}

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const asciiSourceRef = useRef<HTMLImageElement>(null);
  const lenis = useLenis();
  const emailCopy = useCopyEmail(EMAIL_HREF);

  const onNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === "/work" || href === "/archive") {
      go(href);
      return;
    }
    if (href === "/" || href === "/#hero") {
      scrollToSection(lenis, "hero");
      return;
    }
    const id = hashId(href);
    if (id === "about" || id === "team") {
      toggleAboutPanel();
      return;
    }
  };

  useGSAP(
    () => {
      const footer = footerRef.current;
      if (!footer) return;

      /* Links blur in rather than sliding up. Built by hand instead of via
         `prepareGooey`: that splits the element with SplitText, and RollingText
         has already split this same text into per-char glyph stacks for its
         hover roll — a second split fights it. Each link is one line anyway, so
         the split buys nothing; `.footer-text` stands in for the split line and
         its content span stands in for the `.gooey-reveal__inner` that would
         normally be minted — which is why that span carries the inner class in
         the markup above, since the filter chain hangs off it. */
      /* Hand-building the target also skips the reduced-motion guard that
         `prepareGooey` applies, so it has to be re-stated here — otherwise
         these links would animate while every other gooey heading sits still. */
      const linkGooey: GooeyTarget[] = [];
      if (!prefersReducedMotion()) {
        footer.querySelectorAll<HTMLElement>(".footer-text").forEach((el) => {
          const inner = el.querySelector<HTMLElement>(".footer-text-content");
          if (inner) linkGooey.push({ el, inners: [inner] });
        });
      }

      const tagline = footer.querySelector<HTMLElement>(".footer-tagline");
      const taglineGooey = tagline ? prepareGooey(tagline) : null;

      if (taglineGooey) parkGooey(taglineGooey);
      if (linkGooey.length) parkGooey(linkGooey);

      const revealText = () => {
        const tl = gsap.timeline();
        if (taglineGooey) addGooeyReveal(tl, taglineGooey, 0);
        if (linkGooey.length) addGooeyReveal(tl, linkGooey, 0.1);
      };

      const prev = footer.previousElementSibling;
      const child = footer.querySelector(".footer-child");
      if (!prev || !child) return;

      gsap.fromTo(
        child,
        { scale: 0.96 },
        {
          scale: 1,
          ease: "none",
          scrollTrigger: {
            trigger: prev,
            start: "bottom bottom",
            end: () => "+=" + footer.offsetHeight,
            scrub: true,
            invalidateOnRefresh: true,
          },
        },
      );

      ScrollTrigger.create({
        trigger: prev,
        start: "bottom 90%",
        onEnter: revealText,
      });
    },
    { scope: footerRef },
  );

  return (
    <footer className="footer" id="contact" ref={footerRef}>
      <div className="footer-child">
        {/* Panel is the floating card; the container inside keeps content on grid. */}
        <div className="footer-box">
          <FooterAsciiLogo sourceRef={asciiSourceRef} />
          <div className="footer_contain container gap-0">
            <div className="footer-main grid is-12">
              <h3 className="footer-tagline text-style-main">
                I&apos;m a digital designer who makes things look good and work
                better. Good design isn&apos;t about adding more—it&apos;s about
                knowing what to leave out.
              </h3>

              <nav className="footer-col footer-col--nav" aria-label="Footer">
                <ul className="footer-list">
                  {FOOTER_LINKS.map(({ label, path }) => (
                    <li key={path}>
                      <a
                        className="footer-link text-style-h4"
                        href={path === "/" ? "/" : path}
                        onClick={(e) => onNavClick(e, path)}
                      >
                        <Reveal>
                          <RollingText>{label}</RollingText>
                        </Reveal>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="footer-col footer-col--connect">
                <ul className="footer-list">
                  {SOCIAL_LINKS.map(({ label, href }) => {
                    const isMail = href.startsWith("mailto:");
                    const isHttp = href.startsWith("http");
                    const text = isMail ? emailCopy.label : label;
                    return (
                      <li key={label}>
                        <a
                          className="footer-link footer-link--external text-style-h4"
                          href={href}
                          aria-live={isMail ? "polite" : undefined}
                          onClick={isMail ? emailCopy.onClick : undefined}
                          {...(isHttp
                            ? { target: "_blank", rel: "noreferrer noopener" }
                            : {})}
                        >
                          <Reveal>
                            <RollingText key={text}>{text}</RollingText>
                            {isHttp ? (
                              <span
                                className="footer-link__icon"
                                aria-hidden="true"
                              >
                                ↗
                              </span>
                            ) : null}
                          </Reveal>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Same container as the copy above so the wordmark locks to the
                12-col band, not the full card bleed. */}
            <div className="footer-logo">
              <img
                ref={asciiSourceRef}
                className="footer-logo__source"
                src="/main-assets/name-hero.svg"
                alt=""
                decoding="async"
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
