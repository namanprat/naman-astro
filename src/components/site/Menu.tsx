import "./Menu.css";
import { useRef, useState, useEffect } from "react";
import { useLenis } from "lenis/react";
import type Lenis from "lenis";
import gsap from "gsap";
import { go, type GoOptions } from "@/lib/site/navigate";
import { hashId, scrollToSection } from "@/lib/site/scrollToSection";
import { LINE_PARK_PERCENT, parkLines } from "@/lib/site/lineMask";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { markWorkReturn } from "@/lib/site/workSession";
import {
  registerAboutPanel,
  toggleAboutPanel,
  closeAboutPanel,
  installAboutInterceptors,
} from "@/lib/site/aboutPanel";
import { getSiteLenis, subscribeSiteLenis } from "@/lib/site/lenisBridge";
import { bootHomeIntro, replayHomeIntro } from "@/lib/site/heroIntro";
import { useCopyEmail } from "@/lib/site/copyEmail";
import AboutPanel, { type AboutPanelMode } from "./AboutPanel";
import RollingText from "./RollingText";
import ThemeToggle from "./ThemeToggle";
import "@/lib/site/eases";

export const NAV_STACKS = [
  {
    col: "is-home",
    links: [
      { label: "Home", path: "/", id: "hero" },
      { label: "Work", path: "/work", id: "work" },
    ],
  },
  {
    col: "is-about",
    links: [
      { label: "About", path: "/#about", id: "about" },
      { label: "Contact", path: "/#contact", id: "contact" },
    ],
  },
];

export const EMAIL_HREF = "mailto:a.namanprat@gmail.com";

export type SocialLink = {
  label: string;
  href: string;
  /** Opens in a new tab (Instagram, booking links, etc.). */
  newTab?: boolean;
};

export const SOCIAL_LINKS: SocialLink[] = [
  { label: "Email", href: EMAIL_HREF },
  {
    label: "Instagram",
    href: "https://www.instagram.com/namanprat_",
    newTab: true,
  },
  {
    label: "Discovery Call",
    href: "https://cal.com/namanprat/discovery-call",
    newTab: true,
  },
];

export const socialLinkTabProps = (newTab?: boolean) =>
  newTab ? ({ target: "_blank", rel: "noreferrer noopener" } as const) : {};

const SECTION_IDS = ["hero", "team", "contact"];

type MenuProps = {
  /** Current path from Astro — must match SSR HTML to avoid hydration mismatch. */
  initialPathname?: string;
};

export default function Menu({ initialPathname = "/" }: MenuProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutMode, setAboutMode] = useState<AboutPanelMode>("padded");
  /** Home scroll section only — never used while About is open or on /work. */
  const [homeSectionId, setHomeSectionId] = useState("hero");
  const [pathname, setPathname] = useState(initialPathname);
  const [workProjectOpen, setWorkProjectOpen] = useState(false);
  const [isDesktopNav, setIsDesktopNav] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const emailCopy = useCopyEmail(EMAIL_HREF);
  const lenisFromContext = useLenis();
  const [bridgedLenis, setBridgedLenis] = useState<Lenis | null>(() =>
    getSiteLenis(),
  );
  const lenis = lenisFromContext ?? bridgedLenis;

  /** Single source of truth for the nav active dot. */
  const activeId = aboutOpen
    ? "about"
    : pathname === "/work" || pathname.startsWith("/work/")
      ? "work"
      : pathname === "/archive"
        ? "archive"
        : homeSectionId === "team"
          ? "hero"
          : homeSectionId;

  useEffect(() => subscribeSiteLenis(setBridgedLenis), []);

  const navContainerRef = useRef<HTMLDivElement>(null);
  const heroChromeRef = useRef<HTMLDivElement>(null);
  const contactClusterRef = useRef<HTMLDivElement>(null);
  const contactTlRef = useRef<gsap.core.Timeline | null>(null);
  const contactReadyRef = useRef(false);

  useEffect(() => {
    const syncPath = () => setPathname(window.location.pathname);
    syncPath();
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(width >= 64rem)");
    const syncDesktop = () => setIsDesktopNav(mq.matches);
    syncDesktop();
    mq.addEventListener("change", syncDesktop);

    const syncWorkProject = () => {
      const onSlug = /^\/work\/[^/]+\/?$/.test(window.location.pathname);
      const flipOpen =
        document.documentElement.classList.contains("work-project-open");
      setWorkProjectOpen(onSlug || flipOpen);
      setPathname(window.location.pathname);
    };
    syncWorkProject();

    const mo = new MutationObserver(syncWorkProject);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("popstate", syncWorkProject);

    return () => {
      mq.removeEventListener("change", syncDesktop);
      mo.disconnect();
      window.removeEventListener("popstate", syncWorkProject);
    };
  }, []);

  useEffect(() => {
    registerAboutPanel((value) => {
      setAboutOpen((prev) => {
        const next = typeof value === "function" ? value(prev) : value;
        if (next && !prev) {
          const desktop = window.matchMedia("(width >= 64rem)").matches;
          setAboutMode(desktop ? "ride" : "padded");
        }
        return next;
      });
    });
    const uninstall = installAboutInterceptors();
    return () => {
      uninstall();
      registerAboutPanel(null);
    };
  }, []);

  const aboutNavTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const nav = navContainerRef.current;
    if (!nav) return;

    // Keep mode in sync if viewport crosses the desktop/tablet boundary while open.
    if (aboutOpen) {
      if (isDesktopNav && aboutMode !== "ride") {
        setAboutMode("ride");
        return;
      }
      if (!isDesktopNav && aboutMode === "ride") {
        setAboutMode("padded");
        return;
      }
    }

    if (!aboutOpen || aboutMode !== "ride") {
      if (aboutNavTlRef.current) {
        aboutNavTlRef.current.reverse();
      } else {
        gsap.set(nav, { clearProps: "transform" });
      }
      return;
    }

    const panel = document.querySelector<HTMLElement>(".about_panel");
    if (!panel) return;

    aboutNavTlRef.current?.kill();
    gsap.set(nav, { y: 0 });

    /*
      Ride to the card's visible bottom edge, not the padded panel shell.
      Same gutter as hero logo → nav: nav_grid padding-block sits under this.
      cardBottom strips the panel's bottom gutter padding so we dock to the
      accent surface, matching the hero lockup → nav air.
    */
    const cardBottom = (el: HTMLElement) =>
      el.offsetHeight - (parseFloat(getComputedStyle(el).paddingBottom) || 0);

    const dockNav = () => {
      const navTop = nav.getBoundingClientRect().top;
      const panelTop = panel.getBoundingClientRect().top;
      return Math.max(0, panelTop + cardBottom(panel) - navTop);
    };

    const targetY = dockNav();

    const tl = gsap.timeline({
      onReverseComplete: () => {
        gsap.set(nav, { clearProps: "transform" });
      },
    });
    tl.to(nav, {
      y: targetY,
      duration: 0.6,
      ease: "introHop",
    });
    aboutNavTlRef.current = tl;

    // Panel height is content-driven — keep Close docked to the card bottom.
    const ro = new ResizeObserver(() => {
      if (!aboutNavTlRef.current || aboutNavTlRef.current.isActive()) return;
      gsap.set(nav, { y: 0 });
      gsap.set(nav, { y: dockNav() });
    });
    ro.observe(panel);
    const surface = panel.querySelector(".about_panel_surface");
    if (surface) ro.observe(surface);

    return () => {
      ro.disconnect();
    };
  }, [aboutOpen, aboutMode, isDesktopNav]);

  useEffect(() => {
    const chrome = heroChromeRef.current;
    if (!chrome) return;

    const setChromeHeight = () => {
      let height = 0;
      for (const child of chrome.children) {
        height += (child as HTMLElement).offsetHeight;
      }
      document.documentElement.style.setProperty(
        "--hero-chrome-height",
        `${height}px`,
      );

      /* Cluster height *without* .name_hero's centering pad. The pad is derived
         from this in CSS, so it has to be measured from the inner boxes —
         reading --hero-chrome-height instead would feed the pad into its own
         input and oscillate. */
      const lockup = chrome.querySelector<HTMLElement>(".name_hero_contain");
      const nav = navContainerRef.current;
      const content = (lockup?.offsetHeight ?? 0) + (nav?.offsetHeight ?? 0);
      document.documentElement.style.setProperty(
        "--hero-chrome-content",
        `${content}px`,
      );
    };

    setChromeHeight();
    const chromeRo = new ResizeObserver(setChromeHeight);
    for (const child of chrome.children) chromeRo.observe(child);
    const lockup = chrome.querySelector(".name_hero_contain");
    if (lockup) chromeRo.observe(lockup);
    document.fonts?.ready?.then(setChromeHeight);

    return () => {
      chromeRo.disconnect();
      document.documentElement.style.removeProperty("--hero-chrome-height");
      document.documentElement.style.removeProperty("--hero-chrome-content");
    };
  }, []);

  useEffect(() => {
    const nav = navContainerRef.current;
    if (!nav) return;

    const setOffset = () => {
      document.documentElement.style.setProperty(
        "--nav-offset",
        `${nav.getBoundingClientRect().bottom}px`,
      );
    };

    setOffset();
    const ro = new ResizeObserver(setOffset);
    ro.observe(nav);
    /* Route classes on `<html>` (`page-archive`, `work-project-open`) re-home
       the bar without resizing it, so the ResizeObserver never sees the move
       and the offset keeps a stale bottom — the About panel reads this to size
       its own top inset. Watch the class rather than a rAF guess: the class
       lands a commit or more after the state that caused it. */
    const classMo = new MutationObserver(setOffset);
    classMo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("scroll", setOffset, { passive: true });
    window.addEventListener("resize", setOffset);
    const unsub = lenis?.on?.("scroll", setOffset);

    return () => {
      ro.disconnect();
      classMo.disconnect();
      window.removeEventListener("scroll", setOffset);
      window.removeEventListener("resize", setOffset);
      unsub?.();
    };
  }, [lenis]);

  /* Only the run that stopped a Lenis may start it again.
     `lenis` is a dependency, so swapping instances re-runs this effect — and
     the old cleanup closure still held the old instance. On `/work` that meant
     `setSiteLenis(null)` at the end of a project close immediately restarted
     the overlay Lenis that the close had just stopped, every single time.
     Returning a cleanup only from the locking branch keeps stop and start
     paired to the same instance. */
  useEffect(() => {
    if (!aboutOpen) return;
    lenis?.stop();
    return () => {
      lenis?.start();
    };
  }, [lenis, aboutOpen]);

  useEffect(() => {
    const pickHomeSection = () => {
      // Route / About ownership is handled by `activeId` — only track home scroll here.
      if (aboutOpen) return;
      if (window.location.pathname !== "/") return;

      const marker = window.innerHeight * 0.28;
      let current = "hero";
      for (const id of SECTION_IDS) {
        const el =
          id === "hero"
            ? document.querySelector(".hero")
            : document.getElementById(id);
        if (!el) continue;
        /* Use viewport top — offsetTop breaks when a section sits inside
           position:relative (e.g. .team inside .studio → offsetTop ≈ 0). */
        if (el.getBoundingClientRect().top <= marker) current = id;
      }
      setHomeSectionId(current);
    };

    pickHomeSection();
    requestAnimationFrame(pickHomeSection);
    window.addEventListener("scroll", pickHomeSection, { passive: true });
    const unsub = lenis?.on?.("scroll", pickHomeSection);
    return () => {
      window.removeEventListener("scroll", pickHomeSection);
      unsub?.();
    };
  }, [lenis, aboutOpen, pathname]);

  /* Parks the wordmark + nav lines at mount and plays them once the preloader
     hands over. Runs at mount so nothing is unparked for a frame. */
  useEffect(() => bootHomeIntro(), []);

  useEffect(() => {
    if (aboutOpen) setContactOpen(false);
  }, [aboutOpen]);

  useEffect(() => {
    setContactOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!contactOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!contactClusterRef.current?.contains(event.target as Node)) {
        setContactOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [contactOpen]);

  useEffect(() => {
    const root = contactClusterRef.current;
    const dropdown = root?.querySelector<HTMLElement>(".nav_contact_dropdown");
    const lines = dropdown?.querySelectorAll<HTMLElement>(".nav_link h5");
    if (!dropdown || !lines?.length) return;

    contactTlRef.current?.kill();
    contactTlRef.current = null;

    if (!contactReadyRef.current) {
      contactReadyRef.current = true;
      parkLines(lines);
      gsap.set(dropdown, { display: "none" });
    } else if (prefersReducedMotion()) {
      gsap.set(lines, { yPercent: contactOpen ? 0 : LINE_PARK_PERCENT });
      gsap.set(dropdown, { display: contactOpen ? "flex" : "none" });
    } else if (contactOpen) {
      gsap.set(dropdown, { display: "flex" });
      parkLines(lines);
      contactTlRef.current = gsap.timeline();
      contactTlRef.current.to(lines, {
        yPercent: 0,
        duration: 0.9,
        ease: "introHop",
        stagger: 0.06,
      });
    } else {
      contactTlRef.current = gsap.timeline({
        onComplete: () => {
          gsap.set(dropdown, { display: "none" });
        },
      });
      contactTlRef.current.to(lines, {
        yPercent: LINE_PARK_PERCENT,
        duration: 0.9,
        ease: "introHop",
        stagger: 0.06,
      });
    }

    return () => {
      contactTlRef.current?.kill();
      contactTlRef.current = null;
    };
  }, [contactOpen]);

  const goTo = (path: string, options?: GoOptions) => {
    const id = hashId(path);
    const onHome = window.location.pathname === "/";

    if (path === "/archive") {
      closeAboutPanel();
      if (window.location.pathname === "/archive") return;
      void go("/archive", options);
      return;
    }

    if (path === "/work") {
      // Mid Flip (overlay open on /work) — reverse in place.
      if (document.documentElement.classList.contains("work-project-open")) {
        window.dispatchEvent(new CustomEvent("work:close"));
        return;
      }
      // Hard-loaded `/work/[slug]` — no overlay in this document to reverse,
      // so flag it and let /work replay the close on arrival.
      if (/^\/work\/[^/]+/.test(window.location.pathname)) {
        markWorkReturn();
        void go("/work", options);
        return;
      }
      if (window.location.pathname === "/work") return;
      void go("/work", options);
      return;
    }

    if (path === "/" || id === "hero") {
      closeAboutPanel();
      if (!onHome) {
        void go("/", options);
        return;
      }
      replayHomeIntro();
      scrollToSection(lenis, "hero");
      return;
    }

    if (id === "about") {
      // Panel lives in Menu on every page — never route to /#about.
      toggleAboutPanel();
      return;
    }

    if (id === "team") {
      closeAboutPanel();
      if (!onHome) {
        void go("/#team", options);
        return;
      }
      scrollToSection(lenis, "team");
      return;
    }

    if (id === "contact") {
      closeAboutPanel();
      if (!onHome) {
        void go("/#contact", options);
        return;
      }
      scrollToSection(lenis, "contact");
    }
  };

  return (
    <>
      <div className="hero_chrome" ref={heroChromeRef}>
        <div className="name_hero">
          <div className="name_hero_contain container gap-0">
            <div className="name_hero_grid grid is-12">
              {/* Carries the gooey reveal itself rather than wrapping a child
                    that does: CSS applies `filter` before `mask`, so the chain
                    has to sit above the masked lockup. heroIntro arms it. */}
              <div className="name_hero_gooey">
                {/* On inner pages this lockup is the only logo on screen (the
                    text wordmark hides below 64rem), so it has to go home.
                    On home it is not a link — the mark already is the brand. */}
                {pathname === "/" ? (
                  <div className="name_hero_home">
                    <span
                      className="name_hero_lockup"
                      role="img"
                      aria-label="Naman Pratulya"
                    >
                      <img
                        src="/main-assets/name-hero.svg"
                        alt=""
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                ) : (
                  <a
                    className="name_hero_home"
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo("/");
                    }}
                  >
                    <span
                      className="name_hero_lockup"
                      role="img"
                      aria-label="Naman Pratulya"
                    >
                      <img
                        src="/main-assets/name-hero.svg"
                        alt=""
                        aria-hidden="true"
                      />
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="nav_wrap" ref={navContainerRef}>
          <div className="nav_contain container gap-0">
            <nav className="nav_grid grid is-12" aria-label="Main">
              <div className="nav_logo">
                <div className="revealer">
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo("/");
                    }}
                  >
                    <span className="nav_logo_target">
                      <span className="nav_logo_wordmark">
                        <h5 className="text-style-main">Naman Pratulya</h5>
                      </span>
                    </span>
                  </a>
                </div>
              </div>

              {NAV_STACKS.map(({ col, links }) => (
                <div key={col} className={`nav_stack ${col}`}>
                  {links.map(({ label, path, id }) => {
                    const isActive = activeId === id;
                    if (id === "contact") {
                      const text =
                        contactOpen && isDesktopNav ? "Close" : label;
                      return (
                        <div
                          key={path}
                          className="nav_contact"
                          ref={contactClusterRef}
                        >
                          <button
                            type="button"
                            className="nav_link nav_contact_toggle"
                            aria-expanded={
                              isDesktopNav ? contactOpen : undefined
                            }
                            aria-controls={
                              isDesktopNav ? "nav_contact_dropdown" : undefined
                            }
                            onClick={() => {
                              /* The dropdown is `display: none` below 64rem —
                                 toggling it there is a dead tap, so the label
                                 goes straight to the section instead. */
                              if (!isDesktopNav) {
                                goTo("/#contact");
                                return;
                              }
                              setContactOpen((open) => !open);
                            }}
                          >
                            <h5 className="text-style-main">
                              <RollingText key={text}>{text}</RollingText>
                            </h5>
                          </button>
                          <div
                            id="nav_contact_dropdown"
                            className="nav_contact_dropdown"
                          >
                            {SOCIAL_LINKS.map(
                              ({ label: socialLabel, href, newTab }) => {
                                const isMail = href.startsWith("mailto:");
                                const text = isMail
                                  ? emailCopy.label
                                  : socialLabel;
                                return (
                                  <a
                                    key={socialLabel}
                                    href={href}
                                    className="nav_link"
                                    aria-live={isMail ? "polite" : undefined}
                                    onClick={
                                      isMail ? emailCopy.onClick : undefined
                                    }
                                    {...socialLinkTabProps(newTab)}
                                  >
                                    <h5 className="text-style-main">
                                      <RollingText key={text}>
                                        {text}
                                      </RollingText>
                                    </h5>
                                  </a>
                                );
                              },
                            )}
                          </div>
                        </div>
                      );
                    }
                    const text =
                      id === "about" && aboutOpen
                        ? "Close"
                        : id === "work" && workProjectOpen
                          ? "Back"
                          : label;
                    return (
                      <a
                        key={path}
                        href={path === "/" ? "/" : path}
                        className={`nav_link${isActive ? " is-active" : ""}`}
                        aria-current={isActive ? "page" : undefined}
                        onClick={(e) => {
                          e.preventDefault();
                          goTo(path);
                        }}
                      >
                        <h5 className="text-style-main">
                          <RollingText key={text}>{text}</RollingText>
                        </h5>
                      </a>
                    );
                  })}
                </div>
              ))}

              {/* Mobile only (see Menu.css): the word form of the switch, so
                  the bar carries the theme itself now that there is no menu to
                  hold it. Desktop keeps the SVG switch in the utility stack. */}
              <ThemeToggle variant="words" />

              <div className="nav_utility_stack">
                <a
                  href="/archive"
                  className={`nav_link nav_archive${activeId === "archive" ? " is-active" : ""}`}
                  aria-current={activeId === "archive" ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    goTo("/archive");
                  }}
                >
                  <h5 className="text-style-main">
                    <RollingText>Archive</RollingText>
                  </h5>
                </a>
                <ThemeToggle />
              </div>
            </nav>
          </div>
        </div>
      </div>
      <AboutPanel
        open={aboutOpen}
        mode={aboutMode}
        onClose={() => setAboutOpen(false)}
      />
    </>
  );
}
