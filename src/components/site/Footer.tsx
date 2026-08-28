import { useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { go } from "@/lib/site/navigate";
import { replayHomeIntro } from "@/lib/site/heroIntro";
import { hashId, scrollToSection } from "@/lib/site/scrollToSection";
import { openAbout, toggleAboutPanel } from "@/lib/site/aboutPanel";
import {
  addGooeyReveal,
  parkGooey,
  prepareGooey,
  type GooeyTarget,
} from "@/lib/site/gooeyReveal";
import { getSiteLenis, subscribeSiteLenis } from "@/lib/site/lenisBridge";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { previousFlowSibling } from "@/lib/site/previousFlowSibling";
import { useCopyEmail } from "@/lib/site/copyEmail";
import {
  EMAIL_HREF,
  NAV_STACKS,
  SOCIAL_LINKS,
  socialLinkTabProps,
} from "./Menu";
import FooterAsciiLogo from "./FooterAsciiLogo";
import { MOBILE_LAYOUT_MQ } from "@/lib/site/isMobileLayout";
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

/** One gooey-revealed line. The GSAP pass below drives every .footer_text. */
function Reveal({ children }: { children: React.ReactNode }) {
  return (
    <span className="footer_text">
      <span className="footer_text_content gooey_reveal_inner">{children}</span>
    </span>
  );
}

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const asciiSourceRef = useRef<HTMLImageElement>(null);
  /* Phones show the plain masked wordmark instead (Footer.css). Gating the
     mount rather than hiding the canvas matters: the field owns a WebGL
     context and a rAF loop. Starts false so SSR and first paint agree. */
  const [asciiOn, setAsciiOn] = useState(false);
  /* Second gate, same reasoning applied to distance rather than viewport
     width: the footer is the last thing on every long page, so booting its
     WebGL context at page load meant one more live context and rAF loop
     competing with the backdrop for the entire time nobody could see it.
     Latched — once built, the field stays, so scrolling past does not churn
     contexts. */
  const [nearView, setNearView] = useState(false);
  const lenisFromContext = useLenis();
  const [bridgedLenis, setBridgedLenis] = useState(() => getSiteLenis());
  const lenis = lenisFromContext ?? bridgedLenis;
  const emailCopy = useCopyEmail(EMAIL_HREF);

  useEffect(() => subscribeSiteLenis(setBridgedLenis), []);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_MQ);
    const sync = () => setAsciiOn(!mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const footer = footerRef.current;
    if (!footer) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearView(true);
        io.disconnect();
      },
      { rootMargin: "50% 0px", threshold: 0 },
    );
    io.observe(footer);
    return () => io.disconnect();
  }, []);

  const onNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    if (href === "/work" || href === "/archive") {
      go(href);
      return;
    }
    if (href === "/" || href === "/#hero") {
      replayHomeIntro();
      scrollToSection(lenis, "hero");
      return;
    }
    const id = hashId(href);
    if (id === "about") {
      /* Overlay on desktop, route on phones — and a no-op when already there. */
      openAbout();
      return;
    }
    if (id === "team") {
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
         the split buys nothing; `.footer_text` stands in for the split line and
         its content span stands in for the `.gooey_reveal_inner` that would
         normally be minted — which is why that span carries the inner class in
         the markup above, since the filter chain hangs off it. */
      /* Hand-building the target also skips the reduced-motion guard that
         `prepareGooey` applies, so it has to be re-stated here — otherwise
         these links would animate while every other gooey heading sits still. */
      const linkGooey: GooeyTarget[] = [];
      if (!prefersReducedMotion()) {
        footer.querySelectorAll<HTMLElement>(".footer_text").forEach((el) => {
          const inner = el.querySelector<HTMLElement>(".footer_text_content");
          if (inner) linkGooey.push({ el, inners: [inner] });
        });
      }

      const tagline = footer.querySelector<HTMLElement>(".footer_tagline");
      const taglineGooey = tagline ? prepareGooey(tagline) : null;

      if (taglineGooey) parkGooey(taglineGooey);
      if (linkGooey.length) parkGooey(linkGooey);

      const revealText = () => {
        const tl = gsap.timeline();
        if (taglineGooey) addGooeyReveal(tl, taglineGooey, 0);
        if (linkGooey.length) addGooeyReveal(tl, linkGooey, 0.1);
      };

      const prev = previousFlowSibling(footer);
      const child = footer.querySelector(".footer_scale");
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
    <footer className="footer_wrap" id="contact" ref={footerRef}>
      <div className="footer_child">
        <div className="footer_scale">
          {/* Panel is the floating card; the container inside keeps content on grid. */}
          <div className="footer_box">
            {asciiOn && nearView && (
              <FooterAsciiLogo sourceRef={asciiSourceRef} />
            )}
            <div className="footer_contain container gap-0">
              <div className="footer_layout grid is-12">
                <h3 className="footer_tagline text-style-main">
                  We&apos;re a design practice. We work with early-stage brands on
                  identity, web, and motion, and we care more about what gets
                  left out than what gets added.
                </h3>

                <nav className="footer_col is-nav" aria-label="Footer">
                  <ul className="footer_list">
                    {FOOTER_LINKS.map(({ label, path }) => (
                      <li key={path}>
                        <a
                          className="footer_link text-style-h4"
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

                <div className="footer_col is-connect">
                  <ul className="footer_list">
                    {SOCIAL_LINKS.map(({ label, href, newTab }) => {
                      const isMail = href.startsWith("mailto:");
                      const text = isMail ? emailCopy.label : label;
                      return (
                        <li key={label}>
                          <a
                            className="footer_link is-external text-style-h4"
                            href={href}
                            aria-live={isMail ? "polite" : undefined}
                            onClick={isMail ? emailCopy.onClick : undefined}
                            {...socialLinkTabProps(newTab)}
                          >
                            <Reveal>
                              <RollingText key={text}>{text}</RollingText>
                              {newTab ? (
                                <span
                                  className="footer_link_icon"
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
              <div className="footer_logo">
                <img
                  ref={asciiSourceRef}
                  className="footer_logo_source"
                  src="/main-assets/name-hero.svg"
                  alt=""
                  decoding="async"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
