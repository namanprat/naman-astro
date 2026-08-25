import "./Menu.css";
import { useRef, useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { useLenis } from "lenis/react";
import type Lenis from "lenis";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";
import { go, type GoOptions } from "@/lib/site/navigate";
import { hashId, scrollToSection } from "@/lib/site/scrollToSection";
import { LINE_PARK_PERCENT, parkLines } from "@/lib/site/lineMask";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import { markWorkReturn } from "@/lib/site/workSession";
import {
  ABOUT_PATH,
  openAbout,
  registerAboutPanel,
  openAboutPanel,
  closeAboutPanel,
  installAboutInterceptors,
} from "@/lib/site/aboutPanel";
import { getSiteLenis, subscribeSiteLenis } from "@/lib/site/lenisBridge";
import { bootHomeIntro, replayHomeIntro } from "@/lib/site/heroIntro";
import { useCopyEmail } from "@/lib/site/copyEmail";
import {
  addGooeyReveal,
  addGooeyUnreveal,
  armGooey,
  parkGooey,
  prepareGooey,
  prepareGooeyAll,
  settleGooey,
  type GooeyTarget,
} from "@/lib/site/gooeyReveal";
import AboutPanel, { type AboutPanelMode } from "./AboutPanel";
import RollingText from "./RollingText";
import ThemeToggle from "./ThemeToggle";
import "@/lib/site/eases";

gsap.registerPlugin(SplitText);

const PANEL_DURATION = 0.9;

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

type OverlayLink = { label: string; path: string };
type OverlayAction = { label: string; action: "theme" };
type OverlayItem = OverlayLink | OverlayAction;

const isOverlayLink = (item: OverlayItem): item is OverlayLink =>
  "path" in item;

const OVERLAY_COLUMNS: OverlayItem[][] = [
  [
    { label: "Work", path: "/work" },
    { label: "About", path: "/#about" },
  ],
  [
    { label: "Archive", path: "/archive" },
    { label: "Switch theme", action: "theme" },
  ],
  [{ label: "Contact", path: "/#contact" }],
];

const SECTION_IDS = ["hero", "team", "contact"];

/**
 * Where the chrome switches between the compact mobile nav and the desktop
 * stacks, and with it the About panel's `ride` vs `padded` mode. Tablet
 * portrait sits above it, so this is 48rem — deliberately *not* the site's
 * 64rem grid cut, which still hands this band 8 columns. Mirrored by
 * `Menu.css`'s `< 48rem` block and `AboutPanel.css`'s `>= 48rem` block.
 */
export const DESKTOP_NAV_MQ = "(width >= 48rem)";

const MENU_COPY = ".menu_overlay_items .revealer :is(a, button)";
/* The ASCII canvas has no lines to split, so it dissolves rather than melts —
   same duration and start as the lead's gooey, so the two arrive as one. */
const ABOUT_MEDIA =
  ".about_panel.is-in-menu .about_panel_media .about_panel_reveal_inner";
const ABOUT_MEDIA_S = 1.5;
/* Lead melts in via gooey; lists still split into lines. */
const ABOUT_HEAD = ".about_panel.is-in-menu .about_panel_lead";
const ABOUT_LINES = [
  ".about_panel.is-in-menu .about_panel_col_label",
  ".about_panel.is-in-menu .about_panel_col_list h5",
].join(", ");
/* Rides with the lines but is never split — RollingText has already rewritten
   it into per-character spans, and SplitText would re-wrap those. */
const ABOUT_CV = ".about_panel.is-in-menu .about_panel_cv";

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
  const [aboutMode, setAboutMode] = useState<AboutPanelMode>("ride");
  /** Home scroll section only — never used while About is open or on /work. */
  const [homeSectionId, setHomeSectionId] = useState("hero");
  /** Sticky bar has reached the top of the viewport — drives .nav_fade. */
  const [navStuck, setNavStuck] = useState(false);
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
  const activeId =
    aboutOpen || pathname === ABOUT_PATH
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
    const mq = window.matchMedia(DESKTOP_NAV_MQ);
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
          setAboutMode("ride");
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

    if (aboutOpen && aboutMode !== "ride") {
      setAboutMode("ride");
      return;
    }

    if (!aboutOpen || aboutMode !== "ride") {
      if (aboutNavTlRef.current) {
        aboutNavTlRef.current.reverse();
      } else if (!isOpen) {
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
      /* Mobile chrome puts extra padding-top on the wrap (SVG lockup slot).
         Dock the grid, not the wrap, or the links land a mark-height too low. */
      const anchor = isDesktopNav
        ? nav
        : (nav.querySelector<HTMLElement>(".nav_grid") ?? nav);
      const navTop = anchor.getBoundingClientRect().top;
      const panelTop = panel.getBoundingClientRect().top;
      return Math.max(0, panelTop + cardBottom(panel) - navTop);
    };

    const targetY = dockNav();

    const tl = gsap.timeline({
      onReverseComplete: () => {
        gsap.set(nav, { clearProps: "transform" });
        /* The ride's `y` transform doesn't touch nav's size or the root
           class, so the `--nav-offset` effect's ResizeObserver/MutationObserver
           never re-fire once it clears. Nudge its `window resize` listener so
           `is-stuck` (and `--nav-offset`) get re-measured against the real,
           untransformed position — otherwise closing About while scrolled can
           leave `.nav_fade` stuck hidden even though the bar is genuinely
           pinned to the top. */
        window.dispatchEvent(new Event("resize"));
      },
    });
    tl.to(nav, {
      y: targetY,
      duration: 0.6,
      ease: "introHop",
      onComplete: () => window.dispatchEvent(new Event("resize")),
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

      /* Mobile About clients col 2 sits on the Archive/Contact cluster.
         Measure the label, not the link box — `.nav_link` hangs an active-dot
         gutter (`padding-left` / negative `margin-left`) that the names omit. */
      const grid = chrome.querySelector<HTMLElement>(".nav_grid");
      const archive = grid?.querySelector<HTMLElement>(".nav_archive");
      if (grid && archive && window.matchMedia("(width < 48rem)").matches) {
        const label = archive.querySelector<HTMLElement>("h5") ?? archive;
        const inset =
          label.getBoundingClientRect().left -
          grid.getBoundingClientRect().left;
        document.documentElement.style.setProperty(
          "--nav-mid-inset",
          `${Math.max(0, inset)}px`,
        );
      } else {
        document.documentElement.style.removeProperty("--nav-mid-inset");
      }
    };

    setChromeHeight();
    const chromeRo = new ResizeObserver(setChromeHeight);
    for (const child of chrome.children) chromeRo.observe(child);
    const lockup = chrome.querySelector(".name_hero_contain");
    if (lockup) chromeRo.observe(lockup);
    document.fonts?.ready?.then(setChromeHeight);
    window.addEventListener("resize", setChromeHeight);

    return () => {
      chromeRo.disconnect();
      window.removeEventListener("resize", setChromeHeight);
      document.documentElement.style.removeProperty("--hero-chrome-height");
      document.documentElement.style.removeProperty("--hero-chrome-content");
      document.documentElement.style.removeProperty("--nav-mid-inset");
    };
  }, []);

  useEffect(() => {
    const nav = navContainerRef.current;
    if (!nav) return;

    const setOffset = () => {
      const rect = nav.getBoundingClientRect();
      document.documentElement.style.setProperty(
        "--nav-offset",
        `${rect.bottom}px`,
      );
      /* Sticky bar has reached the top. Home keys its readability fade off
         this; routes that pin the bar with `position: fixed` read stuck from
         the start. */
      setNavStuck(rect.top <= 1);
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

  /* Only the run that stopped a Lenis may start it again.
     `lenis` is a dependency, so swapping instances re-runs this effect — and
     the old cleanup closure still held the old instance. On `/work` that meant
     `setSiteLenis(null)` at the end of a project close immediately restarted
     the overlay Lenis that the close had just stopped, every single time.
     Returning a cleanup only from the locking branch keeps stop and start
     paired to the same instance. */
  useEffect(() => {
    if (!(isOpen || aboutOpen)) {
      document.documentElement.classList.remove("menu-open");
      return;
    }
    lenis?.stop();
    if (isOpen) document.documentElement.classList.add("menu-open");
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
      root.querySelectorAll<HTMLElement>(".menu_overlay_title"),
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
    parkLines(lines);
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
     over. Not scoped to menuRef — the lockup and nav_wrap are siblings of
     .menu_wrap, not children. Runs at mount so nothing is unparked for a frame. */
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
      /* Overlay on desktop, real route on phones — `openAbout` owns the fork so
         nav, footer and stray `#about` anchors cannot disagree. */
      openAbout();
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
      !window.matchMedia(DESKTOP_NAV_MQ).matches
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
  }, [isDesktopNav]);

  const unrevealMenuText = (): Promise<void> => {
    if (prefersReducedMotion()) {
      gsap.set(MENU_COPY, { y: "-100%" });
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
    await unrevealMenuText();
    goTo(path, { alreadyCovered: true });
  };

  const openMenu = () => {
    if (phaseRef.current !== "closed") return;

    if (aboutOpen) closeAboutPanel();

    /* Measured here, synchronously, before `menu-open` lands and pins these two
       to `fixed`. Their height leaves the flow the moment it does, which shifts
       the whole page up — the snap before the overlay animates. `.hero_chrome`
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
    /* No dock translate: `html.menu-open .nav_wrap` pins the bar with
       `position: fixed` below the pinned wordmark (Menu.css, <48rem). Nudging
       it by its own offset as well drove it off the top by the hero's height. */
    if (nav) gsap.set(nav, { clearProps: "transform" });

    if (prefersReducedMotion()) {
      gsap.set(overlay, { y: 0, yPercent: 0, pointerEvents: "all" });
      gsap.set(MENU_COPY, { y: "0%" });
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
      <div className="hero_chrome" ref={heroChromeRef}>
        <div className="name_hero">
          <div className="name_hero_contain container gap-0">
            <div className="name_hero_grid grid is-12">
              {/* Carries the gooey reveal itself rather than wrapping a child
                    that does: CSS applies `filter` before `mask`, so the chain
                    has to sit above the masked lockup. heroIntro arms it. */}
              <div className="name_hero_gooey">
                {/* The lockup is Home: on inner pages it is the only mark, and
                    on home it still has to replay the intro / scroll to top. */}
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
              </div>
            </div>
          </div>
        </div>
        <div
          className={`nav_wrap${isOpen ? " is-menu-open" : ""}${aboutOpen ? " is-about-open" : ""}${navStuck ? " is-stuck" : ""}`}
          ref={navContainerRef}
        >
          <div className="nav_fade" aria-hidden="true" />
          <div className="nav_contain container gap-0">
            <nav className="nav_grid grid is-12" ref={navRef} aria-label="Main">
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
                      const text = contactOpen ? "Close" : label;
                      return (
                        <div
                          key={path}
                          className="nav_contact"
                          ref={contactClusterRef}
                        >
                          <button
                            type="button"
                            className="nav_link nav_contact_toggle"
                            aria-expanded={contactOpen}
                            aria-controls="nav_contact_dropdown"
                            onClick={() => setContactOpen((open) => !open)}
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
                                const line = isMail
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
                                      <RollingText key={line}>
                                        {line}
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
                      id === "about" && aboutOpen && pathname !== ABOUT_PATH
                        ? "Close"
                        : id === "work" && workProjectOpen
                          ? "Back"
                          : label;
                    return (
                      <a
                        key={path}
                        href={path === "/" ? "/" : path}
                        className={`nav_link${id === "hero" ? " nav_home" : ""}${id === "work" ? " nav_work" : ""}${id === "about" ? " nav_about" : ""}${isActive ? " is-active" : ""}`}
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

              <div className="nav_menu_toggle_open">
                <button
                  type="button"
                  className="nav_menu_toggle"
                  onClick={onToggle}
                  aria-expanded={isOpen}
                  aria-controls={
                    aboutInMenu ? "site-about-panel" : "site-menu-overlay"
                  }
                  aria-label={
                    aboutInMenu
                      ? "Back to menu"
                      : isOpen
                        ? "Close menu"
                        : "Open menu"
                  }
                >
                  <span className="nav_menu_toggle_viewport">
                    <span
                      className="nav_menu_toggle_track"
                      ref={toggleTrackRef}
                    >
                      <span className="nav_menu_toggle_line">
                        <h5 className="text-style-main">
                          <RollingText>Menu</RollingText>
                        </h5>
                      </span>
                      <span className="nav_menu_toggle_line">
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
      <div className="menu_wrap" ref={menuRef} aria-hidden="true" inert>
        <div
          className={`menu_overlay${aboutInMenu ? " is-about-open" : ""}`}
          id="site-menu-overlay"
          ref={menuOverlayRef}
        >
          <div
            className="menu_overlay_items"
            ref={menuItemsRef}
            aria-hidden={aboutInMenu}
          >
            <div className="revealer menu_overlay_brand">
              <a
                href="/"
                tabIndex={aboutInMenu ? -1 : undefined}
                onClick={(e) => {
                  if (phaseRef.current === "closed") return;
                  e.preventDefault();
                  void navigateTo("/");
                }}
              >
                <span className="menu_overlay_title text-style-main">
                  Naman Pratulya
                </span>
              </a>
            </div>
            <div className="menu_overlay_grid">
              {OVERLAY_COLUMNS.map((column, columnIndex) => (
                <div className="menu_overlay_col" key={columnIndex}>
                  {column.map((item) =>
                    isOverlayLink(item) ? (
                      <div
                        className="revealer"
                        key={item.path}
                        data-overlay-link={item.path}
                      >
                        <a
                          href={item.path}
                          tabIndex={aboutInMenu ? -1 : undefined}
                          onClick={(e) => {
                            if (phaseRef.current === "closed") return;
                            e.preventDefault();
                            void navigateTo(item.path);
                          }}
                        >
                          <span className="menu_overlay_title text-style-main">
                            {item.label}
                          </span>
                        </a>
                      </div>
                    ) : (
                      <div className="revealer" key={item.action}>
                        <ThemeToggle />
                      </div>
                    ),
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* The `/about` route renders the same content as a document. Mounting the
          overlay too would put a second, hidden copy of every heading and list
          in the DOM — duplicate `id="site-about-panel"` included. */}
      {pathname !== ABOUT_PATH && (
        <AboutPanel open={aboutOpen} mode={aboutMode} onClose={dismissAbout} />
      )}
    </>
  );
}
