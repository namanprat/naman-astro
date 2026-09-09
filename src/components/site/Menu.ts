/**
 * Nav chrome behaviour. Markup is `Menu.astro`; this file is the controller
 * that used to live in the React island.
 */
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import type Lenis from "lenis";
import { type GoOptions } from "@/lib/site/nav/navigate";
import { goToRoute } from "@/lib/site/nav/navRoutes";
import { hashId } from "@/lib/site/scroll/scrollToSection";
import { LINE_PARK_PERCENT, parkLines } from "@/lib/site/reveal/lineMask";
import { prefersReducedMotion } from "@/lib/site/util/prefersReducedMotion";
import {
  ABOUT_OPEN_CLASS,
  ABOUT_PATH,
  closeAboutPanel,
  installAboutInterceptors,
  registerAboutPanel,
} from "@/lib/site/about/aboutPanel";
import { followAboutNav, releaseAboutNav } from "@/lib/site/about/aboutNavDock";
import { getSiteLenis, subscribeSiteLenis } from "@/lib/site/scroll/lenisBridge";
import { bootHomeIntro } from "@/lib/site/reveal/heroIntro";
import { bindCopyEmail } from "@/lib/site/util/copyEmail";
import {
  addGooeyReveal,
  addGooeyUnreveal,
  armGooey,
  parkGooey,
  prepareGooey,
  prepareGooeyAll,
  settleGooey,
  type GooeyTarget,
} from "@/lib/site/reveal/gooeyReveal";
import { SECTION_IDS } from "@/lib/content/nav";
import { DESKTOP_NAV_MQ } from "@/lib/site/util/isMobileLayout";
import { bootThemeToggles } from "@/lib/site/util/themeToggle";
import { bootAboutPanel, setAboutOverlay, aboutOverlayIsOpen, aboutOverlayMode } from "@/lib/site/about/bootAboutPanel";
import { bootRollingText, initRollingText } from "@/lib/site/reveal/rollingText";
import "@/lib/site/util/eases";

gsap.registerPlugin(SplitText);

const PANEL_DURATION = 0.9;
const MENU_COPY = ".menu_overlay_items .revealer :is(a, button)";
const ABOUT_MEDIA =
  ".about_panel.is-in-menu .about_panel_media .about_panel_reveal_inner";
const ABOUT_HEAD = ".about_panel.is-in-menu .about_panel_lead";
const ABOUT_LINES = [
  ".about_panel.is-in-menu .about_panel_col_label",
  ".about_panel.is-in-menu .about_panel_col_list h5",
].join(", ");

const rootVars = new Map<string, string>();

function setRootVar(name: string, value: string): void {
  if (rootVars.get(name) === value) return;
  rootVars.set(name, value);
  document.documentElement.style.setProperty(name, value);
}

function clearRootVar(name: string): void {
  rootVars.delete(name);
  document.documentElement.style.removeProperty(name);
}

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

function relabel(host: HTMLElement, text: string): void {
  const roll = host.querySelector<HTMLElement>("[data-roll-text]");
  const target = roll ?? host;
  target.textContent = text;
  if (roll) initRollingText(roll);
}

function paintActive(id: string): void {
  const nav = document.querySelector(".nav_grid");
  if (!nav) return;
  for (const link of nav.querySelectorAll<HTMLElement>("[data-nav-id]")) {
    const on = link.dataset.navId === id;
    link.classList.toggle("is-active", on);
    if (on) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

export function bootMenu(): void {
  bootAboutPanel();
  bootThemeToggles();
  bootRollingText(document.querySelector(".hero_chrome") ?? document);

  const marquee = document.querySelector<HTMLElement>(".nav_marquee");
  const chrome = document.querySelector<HTMLElement>(".hero_chrome");
  const navWrap = document.querySelector<HTMLElement>(".nav_wrap");
  const menuWrap = document.querySelector<HTMLElement>(".menu_wrap");
  const overlay = document.querySelector<HTMLElement>("#site-menu-overlay");
  const menuItems = overlay?.querySelector<HTMLElement>(".menu_overlay_items");
  const toggle = document.querySelector<HTMLButtonElement>(".nav_menu_toggle");
  const toggleTrack = document.querySelector<HTMLElement>(".nav_menu_toggle_track");
  const toggleAlt = document.querySelector<HTMLElement>("[data-menu-toggle-alt] [data-roll-text]");
  const contactRoot = document.querySelector<HTMLElement>(".nav_contact");
  const contactToggle = document.querySelector<HTMLButtonElement>(".nav_contact_toggle");
  const contactDropdown = document.querySelector<HTMLElement>("#nav_contact_dropdown");
  const aboutLink = document.querySelector<HTMLElement>(".nav_about");

  if (!navWrap || !menuWrap || !overlay || !toggle) return;

  let phase: "closed" | "opening" | "open" | "closing" | "leaving" = "closed";
  let overlayTl: gsap.core.Timeline | null = null;
  let closePromise: Promise<void> | null = null;
  let pendingPath: string | null = null;
  let aboutMenuSeq = 0;
  let contactOpen = false;
  let contactReady = false;
  let contactTl: gsap.core.Timeline | null = null;
  let homeSectionId = "hero";
  let menuHeadsCache: GooeyTarget[] = [];
  let aboutHeadCache: GooeyTarget | null = null;
  let aboutSplit: SplitText | null = null;
  let lenis: Lenis | null = getSiteLenis();
  subscribeSiteLenis((next) => {
    lenis = next;
  });

  const desktopNav = () => window.matchMedia(DESKTOP_NAV_MQ).matches;
  const aboutInMenu = () =>
    aboutOverlayIsOpen() && aboutOverlayMode() === "inMenu";

  const goTo = (path: string, options?: GoOptions) =>
    goToRoute(path, { lenis, options });

  const activeId = (): string => {
    const pathname = window.location.pathname;
    if (aboutOverlayIsOpen() || pathname === ABOUT_PATH) return "about";
    if (pathname === "/work" || pathname.startsWith("/work/")) return "work";
    if (pathname === "/archive") return "archive";
    if (homeSectionId === "team") return "hero";
    return homeSectionId;
  };

  const syncActive = () => paintActive(activeId());

  const killOverlayTl = () => {
    overlayTl?.kill();
    overlayTl = null;
  };

  const menuHeads = (): GooeyTarget[] => {
    if (menuHeadsCache.length) return menuHeadsCache;
    if (!menuItems) return [];
    menuHeadsCache = prepareGooeyAll(
      menuItems.querySelectorAll<HTMLElement>(".menu_overlay_title"),
    );
    return menuHeadsCache;
  };

  const aboutHead = (): GooeyTarget | null => {
    const el = document.querySelector<HTMLElement>(ABOUT_HEAD);
    if (!el) return null;
    if (aboutHeadCache?.el === el) return aboutHeadCache;
    aboutHeadCache = prepareGooey(el);
    return aboutHeadCache;
  };

  const parkOverlayCopy = () => {
    gsap.set(MENU_COPY, { y: "0%", autoAlpha: 1 });
    parkGooey(menuHeads());
  };

  const parkOverlay = () => {
    // y: 0 is load-bearing — without it GSAP inherits the CSS
    // `translateY(100%)` park as `y` and yPercent stacks on top, which
    // lands the accent overlay at identity over the whole page.
    gsap.set(overlay, { y: 0, yPercent: -100, pointerEvents: "none" });
    parkOverlayCopy();
    gsap.set(toggleTrack, { yPercent: 0 });
  };

  const unrevealCopy = (tl: gsap.core.Timeline) => {
    addGooeyUnreveal(tl, menuHeads(), 0);
  };

  const revertAboutCopy = () => {
    aboutSplit?.revert();
    aboutSplit = null;
    const head = aboutHead();
    if (head) settleGooey(head);
  };

  const parkAboutCopy = (): HTMLElement[] => {
    const lines = gsap.utils.toArray<HTMLElement>(ABOUT_LINES);
    aboutSplit?.revert();
    aboutSplit = new SplitText(lines, { type: "lines", linesClass: "line" });
    const splitLines = aboutSplit.lines as HTMLElement[];
    parkLines(splitLines);
    const head = aboutHead();
    if (head) parkGooey(head);
    return splitLines;
  };

  const revealAboutCopy = (tl: gsap.core.Timeline, lines: HTMLElement[]) => {
    const head = aboutHead();
    if (head) addGooeyReveal(tl, head, 0);
    tl.to(
      lines,
      { yPercent: 0, duration: 0.9, ease: "introHop", stagger: 0.04 },
      0.05,
    );
    tl.fromTo(
      ABOUT_MEDIA,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 0.6, ease: "power2.out" },
      0.1,
    );
  };

  const resetNavDock = () => {
    gsap.set(navWrap, { clearProps: "transform" });
  };

  const setMenuOpenUi = (open: boolean) => {
    toggle.setAttribute("aria-expanded", String(open));
    navWrap.classList.toggle("is-menu-open", open);
    menuWrap.toggleAttribute("inert", !open);
    menuWrap.setAttribute("aria-hidden", String(!open));
    document.documentElement.classList.toggle("menu-open", open);
    if (open) getSiteLenis()?.stop();
    else if (!aboutOverlayIsOpen()) getSiteLenis()?.start();
  };

  const finishClose = () => {
    phase = "closed";
    closePromise = null;
    overlayTl = null;
    setMenuOpenUi(false);
    parkOverlay();
    resetNavDock();
    if (aboutOverlayMode() === "inMenu" && !desktopNav()) {
      setAboutOverlay(false);
    }
    syncToggleAlt();
    syncActive();
  };

  const closeMenu = (): Promise<void> => {
    if (phase === "closed" || phase === "leaving") return Promise.resolve();
    if (closePromise) return closePromise;

    killOverlayTl();
    phase = "closing";
    aboutMenuSeq += 1;
    if (aboutOverlayMode() === "inMenu") setAboutOverlay(false);

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
      overlayTl = tl;
      unrevealCopy(tl);
      tl.to(
        toggleTrack,
        { yPercent: 0, duration: 0.45, ease: "power3.out" },
        "-=0.45",
      );
      tl.to(overlay, {
        y: 0,
        yPercent: -100,
        duration: PANEL_DURATION,
        ease: "introHop",
      });
      tl.to(
        navWrap,
        { y: 0, duration: PANEL_DURATION, ease: "introHop" },
        "<",
      );
    });
    closePromise = done;
    return done;
  };

  const openMenu = () => {
    if (phase !== "closed") return;
    if (aboutOverlayIsOpen()) closeAboutPanel();

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

    phase = "opening";
    setMenuOpenUi(true);
    parkOverlayCopy();
    gsap.set(navWrap, { clearProps: "transform" });

    if (prefersReducedMotion()) {
      gsap.set(overlay, { y: 0, yPercent: 0, pointerEvents: "all" });
      gsap.set(MENU_COPY, { y: "0%" });
      gsap.set(toggleTrack, { yPercent: -50 });
      phase = "open";
      syncToggleAlt();
      return;
    }

    gsap.set(overlay, { pointerEvents: "all", y: 0, yPercent: 100 });
    const tl = gsap.timeline({
      onComplete: () => {
        if (phase !== "opening") return;
        phase = "open";
        syncToggleAlt();
      },
    });
    overlayTl = tl;
    tl.to(
      overlay,
      { yPercent: 0, duration: PANEL_DURATION, ease: "introHop" },
      0,
    );
    tl.to(
      toggleTrack,
      { yPercent: -50, duration: 0.45, ease: "power3.out" },
      "-=0.75",
    );
    addGooeyReveal(tl, menuHeads(), "-=0.15");
  };

  const focusAboutPanel = () => {
    document.getElementById("site-about-panel")?.focus({ preventScroll: true });
  };

  const finishAboutInMenuClose = () => {
    revertAboutCopy();
    gsap.set(ABOUT_MEDIA, { clearProps: "opacity,visibility" });
    const heads = menuHeads();
    if (heads.length) settleGooey(heads);
    overlayTl = null;
    setAboutOverlay(false);
    overlay.classList.remove("is-about-open");
    if (menuItems) menuItems.setAttribute("aria-hidden", "false");
    syncToggleAlt();
    syncActive();
  };

  const openAboutInMenu = () => {
    if (phase !== "open") return;
    if (aboutInMenu()) return;

    aboutMenuSeq += 1;
    setAboutOverlay(true, "inMenu");
    overlay.classList.add("is-about-open");
    if (menuItems) menuItems.setAttribute("aria-hidden", "true");
    navWrap.classList.add("is-about-open");
    if (aboutLink) relabel(aboutLink, "Close");
    syncToggleAlt();
    syncActive();

    if (prefersReducedMotion()) {
      gsap.set(MENU_COPY, { y: "-100%" });
      gsap.set(ABOUT_MEDIA, { autoAlpha: 1 });
      revertAboutCopy();
      focusAboutPanel();
      return;
    }

    killOverlayTl();
    const lines = parkAboutCopy();
    const tl = gsap.timeline({ onComplete: focusAboutPanel });
    overlayTl = tl;
    unrevealCopy(tl);
    revealAboutCopy(tl, lines);
  };

  const closeAboutInMenu = () => {
    aboutMenuSeq += 1;
    toggle.focus({ preventScroll: true });
    overlay.classList.remove("is-about-open");
    if (menuItems) menuItems.setAttribute("aria-hidden", "false");
    navWrap.classList.remove("is-about-open");
    if (aboutLink) relabel(aboutLink, "About");

    if (prefersReducedMotion()) {
      gsap.set(ABOUT_MEDIA, { autoAlpha: 0 });
      revertAboutCopy();
      gsap.set(MENU_COPY, { y: "0%", autoAlpha: 1 });
      setAboutOverlay(false);
      syncToggleAlt();
      syncActive();
      return;
    }

    const tl = overlayTl;
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
    setAboutOverlay(false);
    syncToggleAlt();
    syncActive();
  };

  const syncToggleAlt = (): void => {
    const back = aboutInMenu();
    toggle.setAttribute(
      "aria-controls",
      back ? "site-about-panel" : "site-menu-overlay",
    );
    toggle.setAttribute(
      "aria-label",
      back ? "Back to menu" : phase === "closed" ? "Open menu" : "Close menu",
    );
    if (toggleAlt) relabel(toggleAlt, back ? "Back" : "Close");
  };

  const unrevealMenuText = (): Promise<void> => {
    if (prefersReducedMotion()) {
      gsap.set(MENU_COPY, { y: "-100%" });
      gsap.set(toggleTrack, { yPercent: 0 });
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const tl = gsap.timeline({ onComplete: resolve });
      unrevealCopy(tl);
      tl.to(
        toggleTrack,
        { yPercent: 0, duration: 0.45, ease: "power3.out" },
        "-=0.45",
      );
    });
  };

  const navigateTo = async (path: string) => {
    if (phase === "closed" || phase === "leaving") return;
    if (hashId(path) === "about" && !desktopNav()) {
      openAboutInMenu();
      return;
    }
    if (isInPageMenuNav(path) || phase === "closing") {
      pendingPath = path;
      await closeMenu();
      const dest = pendingPath;
      if (dest == null) return;
      pendingPath = null;
      goTo(dest);
      return;
    }
    phase = "leaving";
    killOverlayTl();
    gsap.set(overlay, { y: 0, yPercent: 0, pointerEvents: "all" });
    gsap.set(MENU_COPY, { y: "0%" });
    await unrevealMenuText();
    goTo(path, { alreadyCovered: true });
  };

  const onToggle = () => {
    if (phase !== "closed" && aboutInMenu()) {
      closeAboutInMenu();
      return;
    }
    if (phase !== "closed") void closeMenu();
    else openMenu();
  };

  const setContactOpen = (next: boolean) => {
    contactOpen = next;
    contactToggle?.setAttribute("aria-expanded", String(next));
    if (contactToggle) relabel(contactToggle, next ? "Close" : "Contact");

    const lines = contactDropdown?.querySelectorAll<HTMLElement>(".nav_link h5");
    if (!contactDropdown || !lines?.length) return;
    contactTl?.kill();
    contactTl = null;

    if (!contactReady) {
      contactReady = true;
      parkLines(lines);
      gsap.set(contactDropdown, { display: "none" });
    } else if (prefersReducedMotion()) {
      gsap.set(lines, { yPercent: next ? 0 : LINE_PARK_PERCENT });
      gsap.set(contactDropdown, { display: next ? "flex" : "none" });
    } else if (next) {
      gsap.set(contactDropdown, { display: "flex" });
      parkLines(lines);
      contactTl = gsap.timeline();
      contactTl.to(lines, {
        yPercent: 0,
        duration: 0.9,
        ease: "introHop",
        stagger: 0.06,
      });
    } else {
      contactTl = gsap.timeline({
        onComplete: () => gsap.set(contactDropdown, { display: "none" }),
      });
      contactTl.to(lines, {
        yPercent: LINE_PARK_PERCENT,
        duration: 0.9,
        ease: "introHop",
        stagger: 0.06,
      });
    }
  };

  toggle.addEventListener("click", onToggle);
  contactToggle?.addEventListener("click", () => setContactOpen(!contactOpen));

  document.addEventListener("pointerdown", (event) => {
    if (!contactOpen) return;
    if (!contactRoot?.contains(event.target as Node)) setContactOpen(false);
  });

  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-nav-path]")) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      goTo(link.dataset.navPath ?? "/");
    });
  }

  for (const link of document.querySelectorAll<HTMLAnchorElement>("[data-overlay-nav]")) {
    link.addEventListener("click", (event) => {
      if (phase === "closed") return;
      event.preventDefault();
      void navigateTo(link.dataset.overlayNav ?? "/");
    });
  }

  const mail = document.querySelector<HTMLAnchorElement>(
    ".nav_contact_dropdown [data-copy-email]",
  );
  const mailRoll = mail?.querySelector<HTMLElement>("[data-roll-text]");
  if (mail && mailRoll) {
    let dispose = initRollingText(mailRoll);
    bindCopyEmail(mail, mail.dataset.copyEmail ?? "", (text) => {
      dispose();
      mailRoll.textContent = text;
      dispose = initRollingText(mailRoll);
    });
  }

  parkOverlay();
  setContactOpen(false);
  installAboutInterceptors();
  bootHomeIntro();
  syncActive();

  const syncPath = () => {
    setContactOpen(false);
    syncActive();
    if (aboutLink && window.location.pathname !== ABOUT_PATH) {
      relabel(aboutLink, aboutOverlayIsOpen() ? "Close" : "About");
    }
  };
  window.addEventListener("popstate", syncPath);
  const workMo = new MutationObserver(syncPath);
  workMo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const mq = window.matchMedia(DESKTOP_NAV_MQ);
  mq.addEventListener("change", () => {
    if (mq.matches && phase !== "closed" && phase !== "leaving") {
      void closeMenu();
    }
  });

  if (chrome) {
    const setChromeHeight = () => {
      let height = 0;
      for (const child of chrome.children) {
        const el = child as HTMLElement;
        const position = getComputedStyle(el).position;
        if (position === "absolute" || position === "fixed") continue;
        height += el.offsetHeight;
      }
      setRootVar("--hero-chrome-height", `${height}px`);
      const lockup = chrome.querySelector<HTMLElement>(".name_hero_contain");
      const navHeight = navWrap.offsetHeight ?? 0;
      setRootVar("--nav-height", `${navHeight}px`);
      const navFixed = getComputedStyle(navWrap).position === "fixed";
      const content = (lockup?.offsetHeight ?? 0) + (navFixed ? 0 : navHeight);
      setRootVar("--hero-chrome-content", `${content}px`);
      const grid = chrome.querySelector<HTMLElement>(".nav_grid");
      const archive = grid?.querySelector<HTMLElement>(".nav_archive");
      if (grid && archive && window.matchMedia("(width < 48rem)").matches) {
        const label = archive.querySelector<HTMLElement>("h5") ?? archive;
        const inset =
          label.getBoundingClientRect().left - grid.getBoundingClientRect().left;
        setRootVar("--nav-mid-inset", `${Math.max(0, inset)}px`);
      } else {
        clearRootVar("--nav-mid-inset");
      }
    };
    setChromeHeight();
    const chromeRo = new ResizeObserver(setChromeHeight);
    for (const child of chrome.children) chromeRo.observe(child);
    const lockup = chrome.querySelector(".name_hero_contain");
    if (lockup) chromeRo.observe(lockup);
    document.fonts?.ready?.then(setChromeHeight);
    window.addEventListener("resize", setChromeHeight);
  }

  if (marquee) {
    const setHeight = () =>
      setRootVar("--nav-marquee-height", `${marquee.offsetHeight}px`);
    setHeight();
    new ResizeObserver(setHeight).observe(marquee);
    window.addEventListener("resize", setHeight);
  }

  {
    let dock = 0;
    let lastOffset = -1;
    let raf = 0;
    const readDock = () => {
      dock = Number.parseFloat(getComputedStyle(navWrap).top) || 0;
    };
    const setOffset = () => {
      raf = 0;
      const rect = navWrap.getBoundingClientRect();
      const needsNavOffset =
        document.documentElement.classList.contains(ABOUT_OPEN_CLASS) ||
        (!desktopNav() && !document.querySelector(".hero"));
      if (needsNavOffset) {
        const offset = Math.round(rect.bottom);
        if (offset !== lastOffset) {
          lastOffset = offset;
          setRootVar("--nav-offset", `${offset}px`);
        }
      } else if (lastOffset !== -1) {
        lastOffset = -1;
        clearRootVar("--nav-offset");
      }
      navWrap.classList.toggle("is-stuck", rect.top <= dock + 1);
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(setOffset);
    };
    const remeasure = () => {
      readDock();
      setOffset();
    };
    readDock();
    setOffset();
    new ResizeObserver(remeasure).observe(navWrap);
    new MutationObserver(remeasure).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    window.addEventListener("resize", remeasure);
    const unsub = lenis?.on?.("scroll", schedule);
    if (!lenis) window.addEventListener("scroll", schedule, { passive: true });
    subscribeSiteLenis((next) => {
      unsub?.();
      next?.on?.("scroll", schedule);
    });
  }

  {
    const nodes = new Map<string, Element>();
    let raf = 0;
    const resolve = (id: string): Element | null => {
      const cached = nodes.get(id);
      if (cached?.isConnected) return cached;
      const el =
        id === "hero"
          ? document.querySelector(".hero")
          : document.getElementById(id);
      if (el) nodes.set(id, el);
      return el;
    };
    const pickHomeSection = () => {
      raf = 0;
      if (aboutOverlayIsOpen() || window.location.pathname !== "/") return;
      const marker = window.innerHeight * 0.28;
      let current = "hero";
      for (const id of SECTION_IDS) {
        const el = resolve(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= marker) current = id;
      }
      homeSectionId = current;
      syncActive();
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(pickHomeSection);
    };
    pickHomeSection();
    const unsub = lenis?.on?.("scroll", schedule);
    if (!lenis) window.addEventListener("scroll", schedule, { passive: true });
    subscribeSiteLenis((next) => {
      unsub?.();
      next?.on?.("scroll", schedule);
    });
  }

  {
    let docked = false;
    const follow = () => {
      if (!desktopNav()) return;
      const open = document.documentElement.classList.contains(ABOUT_OPEN_CLASS);
      const panel = open
        ? document.querySelector<HTMLElement>(
            ".about_panel.is-open:not(.is-in-menu)",
          )
        : null;
      const surface = panel?.querySelector<HTMLElement>(".about_panel_surface");
      if (!surface) {
        if (docked) {
          docked = false;
          releaseAboutNav();
        }
        return;
      }
      docked = true;
      followAboutNav(surface);
    };
    gsap.ticker.add(follow);
  }

  registerAboutPanel((value) => {
    const prev = aboutOverlayIsOpen();
    const next = typeof value === "function" ? value(prev) : value;
    setAboutOverlay(next, next && !prev ? "ride" : aboutOverlayMode());
    navWrap.classList.toggle("is-about-open", next);
    if (aboutLink && window.location.pathname !== ABOUT_PATH) {
      relabel(aboutLink, next ? "Close" : "About");
    }
    if (next || phase !== "closed") setContactOpen(false);
    syncActive();
    syncToggleAlt();
  });
}
