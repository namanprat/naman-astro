import "./Menu.css";
import { useRef, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLenis } from "lenis/react";
import type Lenis from "lenis";
import gsap from "gsap";
import CustomEase from "gsap/CustomEase";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { go, type GoOptions } from "../../lib/site/navigate";
import { hashId, scrollToSection } from "../../lib/site/scrollToSection";
import { prefersReducedMotion } from "../../lib/site/prefersReducedMotion";
import { markWorkReturn } from "../../lib/site/workReturn";
import {
  registerAboutPanel,
  toggleAboutPanel,
  openAboutPanel,
  closeAboutPanel,
  installAboutInterceptors,
} from "../../lib/site/aboutPanel";
import { getSiteLenis, subscribeSiteLenis } from "../../lib/site/lenisBridge";
import { bootHomeIntro, replayHomeIntro } from "../../lib/site/heroIntro";
import { useCopyEmail } from "../../lib/site/copyEmail";
import {
  addGooeyReveal,
  addGooeyUnreveal,
  armGooey,
  parkGooey,
  prepareGooey,
  prepareGooeyAll,
  settleGooey,
  type GooeyTarget,
} from "../../lib/site/gooeyReveal";
import AboutPanel, { type AboutPanelMode } from "./AboutPanel";
import RollingText from "./RollingText";
import ThemeToggle from "./ThemeToggle";

gsap.registerPlugin(CustomEase, SplitText);
CustomEase.create("hop", ".15, 1, .25, 1");
CustomEase.create("introHop", "0.9, 0, 0.1, 1");

const PANEL_DURATION = 0.9;

export const NAV_STACKS = [
  {
    col: "nav-stack--home",
    links: [
      { label: "Home", path: "/", id: "hero" },
      { label: "Work", path: "/work", id: "work" },
    ],
  },
  {
    col: "nav-stack--about",
    links: [
      { label: "About", path: "/#about", id: "about" },
      { label: "Contact", path: "/#contact", id: "contact" },
    ],
  },
];

export const EMAIL_HREF = "mailto:a.namanprat@gmail.com";

export const SOCIAL_LINKS = [
  { label: "Email", href: EMAIL_HREF },
  { label: "Instagram", href: "https://www.instagram.com/namanprat_" },
  {
    label: "Discovery Call",
    href: "https://cal.com/namanprat/discovery-call",
  },
];

export const OVERLAY_LINKS = [
  { label: "Home", path: "/" },
  { label: "About", path: "/#about" },
  { label: "Work", path: "/work" },
  { label: "Archive", path: "/archive" },
  { label: "Contact", path: "/#contact" },
];

const SECTION_IDS = ["hero", "team", "contact"];

const MENU_COPY = ".menu-overlay-items .revealer a";
const MENU_FOOTER_COPY = ".menu-footer .revealer > *";
/* The dither canvas has no lines to split, so it dissolves rather than melts —
   same duration and start as the lead's gooey, so the two arrive as one. */
const ABOUT_MEDIA =
  ".about-panel--in-menu .about-panel__media .about-panel__reveal-inner";
const ABOUT_MEDIA_S = 1.5;
/* Lead melts in via gooey; lists still split into lines. */
const ABOUT_HEAD = ".about-panel--in-menu .about-panel__lead";
const ABOUT_LINES = [
  ".about-panel--in-menu .about-panel__col-label",
  ".about-panel--in-menu .about-panel__col-list h5",
].join(", ");
/* Rides with the lines but is never split — RollingText has already rewritten
   it into per-character spans, and SplitText would re-wrap those. */
const ABOUT_CV = ".about-panel--in-menu .about-panel__cv";

/** In-page destinations close the overlay; everything else hands off to the cover. */
function isInPageMenuNav(path: string): boolean {
  const id = hashId(path);
  const pathname = window.location.pathname;
  const onHome = pathname === "/";

  if (path === "/archive") return pathname === "/archive";
  if (path === "/work") {
    if (document.documentElement.classList.contains("work-project-open")) {
      return true;
    }
    return pathname === "/work";
  }
  if (path === "/" || id === "hero") return onHome;
  if (id === "about") return false;
  if (id === "team" || id === "contact") return onHome;
  return false;
}

type MenuProps = {
  /** Current path from Astro — must match SSR HTML to avoid hydration mismatch. */
  initialPathname?: string;
};

export default function Menu({ initialPathname = "/" }: MenuProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const menuOverlayRef = useRef<HTMLDivElement>(null);
  const toggleTrackRef = useRef<HTMLSpanElement>(null);
  const menuItemsRef = useRef<HTMLDivElement>(null);
  const menuFooterColsRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const heroChromeRef = useRef<HTMLDivElement>(null);
  const overlayTlRef = useRef<gsap.core.Timeline | null>(null);
  const closePromiseRef = useRef<Promise<void> | null>(null);
  const pendingPathRef = useRef<string | null>(null);
  const aboutModeRef = useRef(aboutMode);
  aboutModeRef.current = aboutMode;
  const aboutOpenRef = useRef(aboutOpen);
  aboutOpenRef.current = aboutOpen;
  const aboutMenuSeqRef = useRef(0);
  const contactClusterRef = useRef<HTMLDivElement>(null);
  const contactTlRef = useRef<gsap.core.Timeline | null>(null);
  const contactReadyRef = useRef(false);
  const aboutSplitRef = useRef<SplitText | null>(null);
  const menuHeadsRef = useRef<GooeyTarget[]>([]);
  const aboutHeadRef = useRef<GooeyTarget | null>(null);
  const phaseRef = useRef<
    "closed" | "opening" | "open" | "closing" | "leaving"
  >("closed");

  const killOverlayTl = () => {
    overlayTlRef.current?.kill();
    overlayTlRef.current = null;
  };

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
          const menuOpen =
            phaseRef.current === "open" || phaseRef.current === "opening";
          setAboutMode(desktop ? "ride" : menuOpen ? "inMenu" : "padded");
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
        setAboutMode(isOpen ? "inMenu" : "padded");
        return;
      }
    }

    if (!aboutOpen || aboutMode !== "ride") {
      if (aboutNavTlRef.current) {
        aboutNavTlRef.current.reverse();
      } else if (!isOpen) {
        gsap.set(nav, { clearProps: "transform" });
      }
      return;
    }

    const panel = document.querySelector<HTMLElement>(".about-panel");
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
    const surface = panel.querySelector(".about-panel__surface");
    if (surface) ro.observe(surface);

    return () => {
      ro.disconnect();
    };
  }, [aboutOpen, aboutMode, isDesktopNav, isOpen]);

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

      /* Cluster height *without* .name-hero's centering pad. The pad is derived
         from this in CSS, so it has to be measured from the inner boxes —
         reading --hero-chrome-height instead would feed the pad into its own
         input and oscillate. */
      const lockup = chrome.querySelector<HTMLElement>(".name-hero_contain");
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
    const lockup = chrome.querySelector(".name-hero_contain");
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
    /* `html.menu-open` re-homes the nav from `sticky` to `fixed; top: 0`. The
       box moves without resizing, so the ResizeObserver never sees it and the
       offset would keep the closed-state bottom — over half the viewport on
       mobile, which squeezed the About panel into the strip below it. Watch the
       class rather than re-measuring on `isOpen`: the class lands a commit or
       more after the state flips, so any rAF guess reads the stale position. */
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

  useEffect(() => {
    const lockScroll = isOpen || aboutOpen;
    if (lockScroll) {
      lenis?.stop();
      if (isOpen) document.documentElement.classList.add("menu-open");
    } else {
      lenis?.start();
      document.documentElement.classList.remove("menu-open");
    }
    return () => {
      document.documentElement.classList.remove("menu-open");
      lenis?.start();
    };
  }, [lenis, isOpen, aboutOpen]);

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

  const menuHeads = (): GooeyTarget[] => {
    if (menuHeadsRef.current.length) return menuHeadsRef.current;
    const root = menuItemsRef.current;
    if (!root) return [];
    menuHeadsRef.current = prepareGooeyAll(
      root.querySelectorAll<HTMLElement>("h1"),
    );
    return menuHeadsRef.current;
  };

  const aboutHead = (): GooeyTarget | null => {
    const el = document.querySelector<HTMLElement>(ABOUT_HEAD);
    if (!el) return null;
    if (aboutHeadRef.current?.el === el) return aboutHeadRef.current;
    aboutHeadRef.current = prepareGooey(el);
    return aboutHeadRef.current;
  };

  const parkOverlayCopy = () => {
    gsap.set(MENU_COPY, { y: "0%", autoAlpha: 1 });
    parkGooey(menuHeads());
    gsap.set(MENU_FOOTER_COPY, { y: "100%" });
  };

  const parkOverlay = () => {
    gsap.set(menuOverlayRef.current, {
      y: 0,
      yPercent: 100,
      pointerEvents: "none",
    });
    gsap.set(toggleTrackRef.current, { yPercent: 0 });
    parkOverlayCopy();
  };

  const resetNavDock = () => {
    const nav = navContainerRef.current;
    if (!nav) return;
    gsap.killTweensOf(nav);
    if (aboutOpenRef.current && aboutModeRef.current === "ride") return;
    gsap.set(nav, { clearProps: "transform" });
  };

  const unrevealCopy = (tl: gsap.core.Timeline) => {
    const heads = menuHeads();
    if (heads.length) {
      addGooeyUnreveal(tl, heads);
      tl.to(MENU_COPY, { autoAlpha: 0, duration: 0.2 }, "-=0.2");
    } else {
      tl.to(MENU_COPY, {
        y: "-100%",
        duration: 0.7,
        stagger: { each: 0.075, from: "end" },
        ease: "power3.in",
      });
    }
    tl.to(
      MENU_FOOTER_COPY,
      {
        y: "-100%",
        duration: 0.7,
        stagger: { each: 0.1, from: "end" },
        ease: "power3.in",
      },
      "<",
    );
  };

  /** Whatever is currently split — the close runs against the live wrappers. */
  const aboutLineTargets = (): Element[] => {
    const lines = aboutSplitRef.current?.lines ?? [];
    const cv = document.querySelector(ABOUT_CV);
    return cv ? [...lines, cv] : [...lines];
  };

  /* Re-split on every open: line breaks depend on the panel's width, and the
     panel is only laid out once it is on screen. revert() before re-splitting
     so the wrappers never nest. */
  const splitAboutCopy = (): Element[] => {
    aboutSplitRef.current?.revert();
    const targets = document.querySelectorAll(ABOUT_LINES);
    aboutSplitRef.current = targets.length
      ? new SplitText(targets, { type: "lines", mask: "lines" })
      : null;
    return aboutLineTargets();
  };

  const revertAboutCopy = () => {
    aboutSplitRef.current?.revert();
    aboutSplitRef.current = null;
  };

  const parkAboutCopy = (): Element[] => {
    const head = aboutHead();
    if (head) parkGooey(head);
    const lines = splitAboutCopy();
    gsap.set(lines, { yPercent: 110 });
    return lines;
  };

  const revealAboutCopy = (tl: gsap.core.Timeline, lines: Element[]) => {
    const head = aboutHead();
    if (head) addGooeyReveal(tl, head);
    tl.to(
      ABOUT_MEDIA,
      {
        autoAlpha: 1,
        duration: ABOUT_MEDIA_S,
        ease: "power2.out",
      },
      head ? "<" : undefined,
    );
    tl.to(
      lines,
      {
        yPercent: 0,
        duration: 0.9,
        stagger: 0.045,
        ease: "power3.out",
      },
      "<",
    );
  };

  /**
   * Back from About reverses the open timeline — menu copy returns the same
   * way it left, About lines and media rewind. A hand-written exit (surface
   * slide, second reveal) drifted from the entrance ease.
   *
   * The lead's gooey settles on open complete (drops the threshold class); arm
   * it again before reverse so the melt still has both filter halves.
   */
  const finishAboutInMenuClose = () => {
    revertAboutCopy();
    gsap.set(ABOUT_MEDIA, { clearProps: "opacity,visibility" });
    const heads = menuHeads();
    if (heads.length) settleGooey(heads);
    overlayTlRef.current = null;
    setAboutOpen(false);
  };

  const focusAboutPanel = () => {
    document.getElementById("site-about-panel")?.focus({ preventScroll: true });
  };

  useGSAP(
    () => {
      parkOverlay();
    },
    { scope: menuRef },
  );

  /* Parks the wordmark + nav at mount and plays them once the preloader hands
     over. Not scoped to menuRef — the lockup and nav-container are siblings of
     .menu, not children. Runs at mount so nothing is unparked for a frame. */
  useEffect(() => bootHomeIntro(), []);

  useEffect(() => {
    if (aboutOpen || isOpen) setContactOpen(false);
  }, [aboutOpen, isOpen]);

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
    const dropdown = root?.querySelector<HTMLElement>(".nav-contact-dropdown");
    const lines = dropdown?.querySelectorAll<HTMLElement>(".nav-link h5");
    if (!dropdown || !lines?.length) return;

    contactTlRef.current?.kill();
    contactTlRef.current = null;

    if (!contactReadyRef.current) {
      contactReadyRef.current = true;
      gsap.set(lines, { yPercent: 110 });
      gsap.set(dropdown, { display: "none" });
    } else if (prefersReducedMotion()) {
      gsap.set(lines, { yPercent: contactOpen ? 0 : 110 });
      gsap.set(dropdown, { display: contactOpen ? "flex" : "none" });
    } else if (contactOpen) {
      gsap.set(dropdown, { display: "flex" });
      gsap.set(lines, { yPercent: 110 });
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
        yPercent: 110,
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

  const aboutInMenu = aboutOpen && aboutMode === "inMenu";

  const openAboutInMenu = () => {
    if (phaseRef.current !== "open") return;
    if (aboutOpen && aboutMode === "inMenu") return;

    aboutMenuSeqRef.current += 1;
    flushSync(() => {
      setAboutMode("inMenu");
      openAboutPanel();
    });

    if (prefersReducedMotion()) {
      gsap.set(MENU_COPY, { y: "-100%" });
      gsap.set(MENU_FOOTER_COPY, { y: "-100%" });
      gsap.set(ABOUT_MEDIA, { autoAlpha: 1 });
      revertAboutCopy();
      focusAboutPanel();
      return;
    }

    killOverlayTl();
    const lines = parkAboutCopy();
    const tl = gsap.timeline({
      onComplete: focusAboutPanel,
    });
    overlayTlRef.current = tl;
    unrevealCopy(tl);
    revealAboutCopy(tl, lines);
  };

  const closeAboutInMenu = () => {
    aboutMenuSeqRef.current += 1;
    toggleTrackRef.current?.closest("button")?.focus({ preventScroll: true });

    if (prefersReducedMotion()) {
      gsap.set(ABOUT_MEDIA, { autoAlpha: 0 });
      revertAboutCopy();
      gsap.set(MENU_COPY, { y: "0%", autoAlpha: 1 });
      gsap.set(MENU_FOOTER_COPY, { y: "0%" });
      setAboutOpen(false);
      return;
    }

    const tl = overlayTlRef.current;
    if (tl && tl.progress() > 0) {
      const head = aboutHead();
      if (head) armGooey(head);
      tl.eventCallback("onComplete", null);
      tl.eventCallback("onReverseComplete", finishAboutInMenuClose);
      tl.reverse();
      return;
    }

    gsap.set(ABOUT_MEDIA, { autoAlpha: 0 });
    revertAboutCopy();
    gsap.set(MENU_COPY, { y: "0%", autoAlpha: 1 });
    gsap.set(MENU_FOOTER_COPY, { y: "0%" });
    const heads = menuHeads();
    if (heads.length) settleGooey(heads);
    setAboutOpen(false);
  };

  const dismissAbout = () => {
    if (aboutInMenu && isOpen) {
      closeAboutInMenu();
      return;
    }
    setAboutOpen(false);
  };

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
      // Panel lives in SiteChrome on every page — never route to /#about.
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

  const finishClose = () => {
    phaseRef.current = "closed";
    closePromiseRef.current = null;
    overlayTlRef.current = null;
    setIsOpen(false);
    navContainerRef.current?.classList.remove("is-menu-open");
    parkOverlay();
    resetNavDock();
    if (
      aboutModeRef.current === "inMenu" &&
      !window.matchMedia("(width >= 64rem)").matches
    ) {
      setAboutOpen(false);
    }
  };

  const closeMenu = (): Promise<void> => {
    if (phaseRef.current === "closed" || phaseRef.current === "leaving") {
      return Promise.resolve();
    }
    if (closePromiseRef.current) return closePromiseRef.current;

    killOverlayTl();
    phaseRef.current = "closing";
    aboutMenuSeqRef.current += 1;
    if (aboutModeRef.current === "inMenu") setAboutOpen(false);
    const overlay = menuOverlayRef.current;
    const nav = navContainerRef.current;

    if (prefersReducedMotion()) {
      finishClose();
      return Promise.resolve();
    }

    const done = new Promise<void>((resolve) => {
      const tl = gsap.timeline({
        onComplete: () => {
          finishClose();
          resolve();
        },
      });
      overlayTlRef.current = tl;

      unrevealCopy(tl);
      tl.to(
        toggleTrackRef.current,
        {
          yPercent: 0,
          duration: 0.45,
          ease: "power3.out",
        },
        "-=0.45",
      );
      tl.to(overlay, {
        y: 0,
        yPercent: -100,
        duration: PANEL_DURATION,
        ease: "introHop",
      });
      if (nav) {
        tl.to(
          nav,
          {
            y: 0,
            duration: PANEL_DURATION,
            ease: "introHop",
          },
          "<",
        );
      }
    });
    closePromiseRef.current = done;
    return done;
  };

  useEffect(() => {
    if (!isDesktopNav) return;
    if (phaseRef.current === "closed" || phaseRef.current === "leaving") return;
    void closeMenu();
    // Close on the desktop breakpoint flip only — closeMenu is the latest
    // closure from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isDesktopNav
  }, [isDesktopNav]);

  const unrevealMenuText = (): Promise<void> => {
    if (prefersReducedMotion()) {
      gsap.set(MENU_COPY, { y: "-100%" });
      gsap.set(MENU_FOOTER_COPY, { y: "-100%" });
      gsap.set(toggleTrackRef.current, { yPercent: 0 });
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      unrevealCopy(tl);
      tl.to(
        toggleTrackRef.current,
        {
          yPercent: 0,
          duration: 0.45,
          ease: "power3.out",
        },
        "-=0.45",
      );
    });
  };

  const navigateTo = async (path: string) => {
    if (phaseRef.current === "closed" || phaseRef.current === "leaving") return;

    if (hashId(path) === "about" && !isDesktopNav) {
      openAboutInMenu();
      return;
    }

    if (isInPageMenuNav(path) || phaseRef.current === "closing") {
      pendingPathRef.current = path;
      await closeMenu();
      const dest = pendingPathRef.current;
      if (dest == null) return;
      pendingPathRef.current = null;
      goTo(dest);
      return;
    }

    phaseRef.current = "leaving";
    killOverlayTl();
    gsap.set(menuOverlayRef.current, {
      y: 0,
      yPercent: 0,
      pointerEvents: "all",
    });
    gsap.set(MENU_COPY, { y: "0%" });
    gsap.set(MENU_FOOTER_COPY, { y: "0%" });
    await unrevealMenuText();
    goTo(path, { alreadyCovered: true });
  };

  const openMenu = () => {
    if (phaseRef.current !== "closed") return;

    if (aboutOpen) closeAboutPanel();

    /* Measured here, synchronously, before `menu-open` lands and pins these two
       to `fixed`. Their height leaves the flow the moment it does, which shifts
       the whole page up — the snap before the overlay animates. `.hero-chrome`
       reserves this back (Menu.css). Not reusing `--hero-chrome-height`: it is
       driven by a ResizeObserver for a different purpose and lags a generation
       behind a webfont swap, which left the reserve tens of pixels short. */
    const chrome = heroChromeRef.current;
    if (chrome) {
      let reserve = 0;
      for (const child of chrome.children) {
        reserve += (child as HTMLElement).offsetHeight;
      }
      document.documentElement.style.setProperty(
        "--menu-chrome-reserve",
        `${reserve}px`,
      );
    }

    phaseRef.current = "opening";
    setIsOpen(true);
    navContainerRef.current?.classList.add("is-menu-open");

    const overlay = menuOverlayRef.current;
    const nav = navContainerRef.current;
    parkOverlayCopy();
    /* No dock translate: `html.menu-open .nav-container` pins the bar with
       `position: fixed` below the pinned wordmark (Menu.css, <64rem). Nudging
       it by its own offset as well drove it off the top by the hero's height. */
    if (nav) gsap.set(nav, { clearProps: "transform" });

    if (prefersReducedMotion()) {
      gsap.set(overlay, { y: 0, yPercent: 0, pointerEvents: "all" });
      gsap.set(MENU_COPY, { y: "0%" });
      gsap.set(MENU_FOOTER_COPY, { y: "0%" });
      gsap.set(toggleTrackRef.current, { yPercent: -50 });
      phaseRef.current = "open";
      return;
    }

    gsap.set(overlay, { pointerEvents: "all", y: 0, yPercent: 100 });

    const tl = gsap.timeline({
      onComplete: () => {
        if (phaseRef.current !== "opening") return;
        phaseRef.current = "open";
      },
    });
    overlayTlRef.current = tl;

    tl.to(
      overlay,
      {
        yPercent: 0,
        duration: PANEL_DURATION,
        ease: "introHop",
      },
      0,
    );

    tl.to(
      toggleTrackRef.current,
      {
        yPercent: -50,
        duration: 0.45,
        ease: "power3.out",
      },
      "-=0.75",
    );

    addGooeyReveal(tl, menuHeads(), "-=0.15");
    tl.to(
      MENU_FOOTER_COPY,
      {
        y: "0%",
        duration: 1,
        stagger: 0.1,
        ease: "power3.out",
      },
      "<",
    );
  };

  const onToggle = () => {
    if (isOpen && aboutInMenu) {
      closeAboutInMenu();
      return;
    }
    if (isOpen) void closeMenu();
    else openMenu();
  };

  return (
    <>
      <div className="hero-chrome" ref={heroChromeRef}>
        <div className="name-hero">
          <div className="name-hero_contain container gap-0">
            <div className="name-hero_grid grid is-12">
              {/* Carries the gooey reveal itself rather than wrapping a child
                    that does: CSS applies `filter` before `mask`, so the chain
                    has to sit above the masked lockup. heroIntro arms it. */}
              <div className="name-hero__gooey">
                {/* On inner pages this lockup is the only logo on screen (the
                    text wordmark hides below 64rem), so it has to go home.
                    `goTo` already scrolls to the hero instead when we're on
                    the home page, so the same link is right in both places. */}
                <a
                  className="name-hero__home"
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    goTo("/");
                  }}
                >
                  <span
                    className="name-hero__lockup"
                    role="img"
                    aria-label="Naman Pratulya"
                  >
                    {/* Sizes the box from the SVG's own ratio — see Menu.css. */}
                    <img
                      src="/main-assets/name-hero.svg"
                      alt=""
                      aria-hidden="true"
                    />
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
        <div
          className={`nav-container${isOpen ? " is-menu-open" : ""}${aboutInMenu ? " is-about-open" : ""}`}
          ref={navContainerRef}
        >
          <div className="nav_contain container gap-0">
            <nav className="nav_grid grid is-12" ref={navRef} aria-label="Main">
              <div className="nav-logo">
                <div className="revealer">
                  <a
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      goTo("/");
                    }}
                  >
                    <span className="nav-logo-target">
                      <span className="nav-logo-wordmark">
                        <h5 className="text-style-main">Naman Pratulya</h5>
                      </span>
                    </span>
                  </a>
                </div>
              </div>

              {NAV_STACKS.map(({ col, links }) => (
                <div key={col} className={`nav-stack ${col}`}>
                  {links.map(({ label, path, id }) => {
                    const isActive = activeId === id;
                    if (id === "contact") {
                      const text = contactOpen ? "Close" : label;
                      return (
                        <div
                          key={path}
                          className="nav-contact"
                          ref={contactClusterRef}
                        >
                          <button
                            type="button"
                            className="nav-link nav-contact-toggle"
                            aria-expanded={contactOpen}
                            aria-controls="nav-contact-dropdown"
                            onClick={() => setContactOpen((open) => !open)}
                          >
                            <h5 className="text-style-main">
                              <RollingText key={text}>{text}</RollingText>
                            </h5>
                          </button>
                          <div
                            id="nav-contact-dropdown"
                            className="nav-contact-dropdown"
                          >
                            {SOCIAL_LINKS.map(
                              ({ label: socialLabel, href }) => {
                                const isMail = href.startsWith("mailto:");
                                const isHttp = href.startsWith("http");
                                const text = isMail
                                  ? emailCopy.label
                                  : socialLabel;
                                return (
                                  <a
                                    key={socialLabel}
                                    href={href}
                                    className="nav-link"
                                    aria-live={isMail ? "polite" : undefined}
                                    onClick={
                                      isMail ? emailCopy.onClick : undefined
                                    }
                                    {...(isHttp
                                      ? {
                                          target: "_blank",
                                          rel: "noreferrer noopener",
                                        }
                                      : {})}
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
                        : id === "work" && workProjectOpen && isDesktopNav
                          ? "Back"
                          : label;
                    return (
                      <a
                        key={path}
                        href={path === "/" ? "/" : path}
                        className={`nav-link${isActive ? " is-active" : ""}`}
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

              <div className="nav-utility-stack">
                <a
                  href="/archive"
                  className={`nav-link nav-archive${activeId === "archive" ? " is-active" : ""}`}
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

              <div className="nav-menu-toggle-open">
                <button
                  type="button"
                  className="nav-menu-toggle"
                  onClick={onToggle}
                  aria-expanded={isOpen}
                  aria-controls={aboutInMenu ? "site-about-panel" : undefined}
                  aria-label={
                    aboutInMenu
                      ? "Back to menu"
                      : isOpen
                        ? "Close menu"
                        : "Open menu"
                  }
                >
                  <span className="nav-menu-toggle__viewport">
                    <span
                      className="nav-menu-toggle__track"
                      ref={toggleTrackRef}
                    >
                      <span className="nav-menu-toggle__line">
                        <h5 className="text-style-main">
                          <RollingText>Menu</RollingText>
                        </h5>
                      </span>
                      <span className="nav-menu-toggle__line">
                        <h5 className="text-style-main">
                          <RollingText key={aboutInMenu ? "Back" : "Close"}>
                            {aboutInMenu ? "Back" : "Close"}
                          </RollingText>
                        </h5>
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            </nav>
          </div>
        </div>
      </div>
      <div className="menu" ref={menuRef}>
        <div
          className={`menu-overlay${aboutInMenu ? " is-about-open" : ""}`}
          ref={menuOverlayRef}
        >
          <div
            className="menu-overlay-items"
            ref={menuItemsRef}
            aria-hidden={aboutInMenu}
          >
            {OVERLAY_LINKS.map(({ label, path }) => (
              <div className="revealer" key={path} data-overlay-link={path}>
                <a
                  href={path}
                  tabIndex={aboutInMenu ? -1 : undefined}
                  onClick={(e) => {
                    if (phaseRef.current === "closed") return;
                    e.preventDefault();
                    void navigateTo(path);
                  }}
                >
                  <h1 className="text-style-display">{label}</h1>
                </a>
              </div>
            ))}
          </div>
          <div
            className="menu-footer"
            ref={menuFooterColsRef}
            aria-hidden={aboutInMenu}
          >
            <div className="revealer">
              <p className="text-style-h5">&copy; 2026 All Rights Reserved</p>
            </div>
            <div className="socials">
              {SOCIAL_LINKS.map(({ label, href }) => {
                const isMail = href.startsWith("mailto:");
                const isHttp = href.startsWith("http");
                const text = isMail ? emailCopy.label : label;
                return (
                  <div className="revealer" key={label}>
                    <a
                      className="text-style-h5"
                      href={href}
                      aria-live={isMail ? "polite" : undefined}
                      onClick={isMail ? emailCopy.onClick : undefined}
                      {...(isHttp
                        ? { target: "_blank", rel: "noreferrer noopener" }
                        : {})}
                    >
                      {text}
                    </a>
                  </div>
                );
              })}
            </div>
            <div className="revealer">
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
      <AboutPanel open={aboutOpen} mode={aboutMode} onClose={dismissAbout} />
    </>
  );
}
