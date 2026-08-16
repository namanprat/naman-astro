export type WorkPanel =
  | { kind: "text"; title: string; body: string }
  | { kind: "image"; src: string; alt: string };

/** Lumos grid column spans available as --site--span-* tokens. */
export type WorkSpan = 2 | 3 | 5;

/** About-panel vocabulary, reused per project on the case-study hero. */
export type WorkService =
  "Brand identity" | "Motion design" | "Website design" | "Low-code web dev";

export type WorkItem = {
  slug: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  /** Optional motion piece, stacked under the cover on the case-study page. */
  coverVideo?: string;
  /** Still stacked under the cover — same slot as `coverVideo`. */
  coverImage?: string;
  /** Width in Lumos column spans. */
  span: WorkSpan;
  /** Start column on the Lumos grid, 0-indexed. Clamped so col + span fits
      the column count at the current breakpoint. */
  col: number;
  services: WorkService[];
  panels: WorkPanel[];
};

/** Join case-study paragraphs into one body for the single-paragraph panel. */
function body(...paras: string[]) {
  return paras.join(" ");
}

export const workItems: WorkItem[] = [
  {
    slug: "money-me",
    title: "money.me",
    description:
      "money.me helps with financial awareness. With a simple and easy to use interface, it empowers its users to take control of their finances by tracking expenses.",
    image: "/work/money-me/money-me-cover.webp",
    alt: "money.me",
    span: 3,
    col: 1,
    services: ["Website design", "Low-code web dev"],
    panels: [
      {
        kind: "image",
        src: "/work/money-me/money-cover.webp",
        alt: "money.me cover",
      },
      {
        kind: "text",
        title: "Why this, why now",
        body: body(
          "Financial management is one of the most quietly consequential life skills a person picks up, or doesn't. Knowing how to hold the line between what comes in and what goes out shapes the texture of an entire decade, not a single month.",
          "But the further into independence you get, the harder that ledger is to hold in your head. Income arrives in fragments. Expenses leak through a dozen apps, cards, and casual taps. Without a way to see it cleanly, small decisions stack into a pattern: irresponsible by accident, not by intention.",
          "money.me started from that observation. Not as another budgeting app but as a way to give people back the visibility they had stopped expecting from their phones. We worked with the money.me team to turn that idea into something real.",
        ),
      },
      {
        kind: "image",
        src: "/work/money-me/strip-01.png",
        alt: "money.me interface strip",
      },
      {
        kind: "text",
        title: "Listening before designing",
        body: body(
          "Before drawing a single screen, we wanted to understand how people actually live with their money. We built a questionnaire and ran it across a small but varied group of users: students just managing their first stipend, working professionals juggling two or three cards, and friends who treated splitting a dinner bill like a small group project.",
          "The conversations probed the things you only learn by asking: how they keep track of expenses (or pretend to), how often they impulse buy and whether they regret it, how many cards live in their wallet, whether they had ever installed a money app and what made them open it less and less, and how a group actually splits a bill when the waiter brings the check. The aim was less to confirm a feature list and more to find the friction worth designing around.",
        ),
      },
      {
        kind: "image",
        src: "/work/money-me/strip-02.png",
        alt: "money.me research screens",
      },
      {
        kind: "text",
        title: "What people actually said",
        body: body(
          "People wanted to save, time as much as money, and they wanted financial apps to make life easier, not noisier. Several said outright that every app they had tried felt the same, and that managing their finances mattered to them but they couldn't seem to be regular about it.",
          "Underneath the surface, they were asking for control. They wanted simple, efficient ways to handle the awkward bits: splitting a bill, paying back a friend, capturing a transaction without thinking about it. They wished their app actually knew them, when a transaction happened, where, and what it meant.",
          "What they did was telling. Most fell back on bank statements at the end of the month, or kept a half-hearted log they updated for a week and abandoned. Plenty had tried multiple money apps and kept none. The same problems came up every time: no way to ask the app how much they had spent on food this month, entering income and expenses was unclear enough to put people off, alerts arrived too late or not at all, and no one wanted to install another app just to remember to open it.",
        ),
      },
      {
        kind: "image",
        src: "/work/money-me/strip-03.png",
        alt: "money.me product flow",
      },
      {
        kind: "text",
        title: "The moneymaker",
        body: body(
          "The goal that came out of the research was unusually simple: the app should ask less of the user, not more. Logging an expense should be something that has already happened by the time you look at the screen.",
          "The first move was to lean on something the user already gets for free: the transaction SMS their bank sends every time their card moves. money.me reads those messages on-device, parses them into categorised entries, and quietly fills the ledger. No manual entry, no forgotten lunches, no abandoned spreadsheets.",
          "On top of that runs a layer of small smart nudges. Instead of a single end-of-month notification telling you that you overspent, the app surfaces patterns as they form: a category creeping up, a recurring charge you forgot about, a place to trim without changing how you actually live. The tone is closer to a friend pointing something out than a bank warning you.",
          "The savings that come out of those nudges don't sit abstract. They slide into a Piggy Bank the user sets up, a container with a name and a goal, where the money saved in one place reappears as progress somewhere else. The point is to make saving feel like watching something grow, not giving something up.",
        ),
      },
      {
        kind: "image",
        src: "/work/money-me/strip-04.png",
        alt: "money.me piggy bank",
      },
      {
        kind: "image",
        src: "/work/money-me/strip-05.png",
        alt: "money.me final screens",
      },
    ],
  },
  {
    slug: "haptic",
    title: "Haptic",
    description:
      "Haptic AI needed a visual identity that felt human in a category that defaults to cold and interchangeable. We built a tactile brand system — wordmark, icon grid, campaign surfaces, and motion — that makes an abstract AI product legible and trustworthy.",
    image: "/work/haptic/haptic-cover.webp",
    alt: "Haptic",
    coverVideo: "/work/haptic/haptic-reveal.webm",
    span: 3,
    col: 7,
    services: ["Brand identity", "Motion design"],
    panels: [
      {
        kind: "image",
        src: "/work/haptic/haptic-hero.webp",
        alt: "Haptic hero",
      },
      {
        kind: "text",
        title: "Why this, why now",
        body: body(
          "AI products are arriving faster than the visual language to describe them. Most land in the same place: gradient blobs, generic sans-serif, and a name that could belong to any startup on the block. The category has a sameness problem, and users feel it before they can name it.",
          "Haptic AI came to us with a product that was genuinely different — but a brand that didn't yet show it. The challenge wasn't to decorate an AI company. It was to give people something to hold onto: a mark, a tone, a system that felt tactile in a space that often feels weightless.",
          "We started from a simple premise. If the product promises to make complex things feel within reach, the identity should do the same work before anyone opens the app.",
        ),
      },
      {
        kind: "image",
        src: "/work/haptic/haptic-wordmark.webp",
        alt: "Haptic wordmark",
      },
      {
        kind: "text",
        title: "Positioning before pixels",
        body: body(
          "Before any marks were drawn, we mapped how people actually relate to AI tools: the curiosity, the hesitation, the moment of trust when something just works. Users weren't asking for more futuristic. They were asking for clarity — something that felt designed for them, not demoed at them.",
          "That research shaped the positioning: Haptic as the interface between human intent and machine capability. Not a black box, not a chatbot costume — a product with a visible hand on the other side.",
          "The wordmark became the first expression of that idea. Custom letterforms with enough weight to feel grounded, enough openness to stay approachable. It had to work at billboard scale and favicon size without losing its character.",
        ),
      },
      {
        kind: "text",
        title: "A system, not a logo",
        body: body(
          "Identity work that stops at a logo rarely survives contact with a real product. We built Haptic as a system: a wordmark, an icon grid for product surfaces, and campaign art that could carry the same voice into the wild.",
          "The icon set was designed as a modular grid — each glyph readable at small sizes, consistent in stroke and corner language, flexible enough to grow with the product roadmap. The billboard treatment extended the palette and typography into a single campaign surface: bold, legible, unmistakably Haptic from across a street.",
          "Every asset had to answer the same question: does this make the product feel more real, more reachable, more like something you'd actually use?",
        ),
      },
      {
        kind: "image",
        src: "/work/haptic/haptic-icons.webp",
        alt: "Haptic icon system",
      },
      {
        kind: "text",
        title: "Motion as identity",
        body: body(
          "Static marks only tell half the story for a product that lives in motion. The reveal animation became the bridge between brand and product — a short sequence that introduces the wordmark, unfolds the icon system, and lands on the hero image with the same tactile confidence as the rest of the identity.",
          "We treated motion as a design material, not an afterthought. Timing, easing, and the order of appearance were tuned so the reveal feels intentional — like the brand is introducing itself, not loading.",
          "The result is an identity that works across touchpoints: a wordmark you remember, icons you recognise, campaign art that stops the scroll, and motion that ties it all together when Haptic shows up for the first time.",
        ),
      },
    ],
  },
  {
    slug: "notice",
    title: "Notice",
    description:
      "Brand and digital work for Notice — a studio that builds clear, considered creative systems for clients who need presence without noise.",
    image: "/work/notice/notice-cover.webp",
    alt: "Notice",
    span: 3,
    col: 8,
    services: ["Brand identity", "Website design"],
    panels: [
      {
        kind: "text",
        title: "Selected work",
        body: "Collaboration with Notice across brand and digital surfaces. Live site: wearenotice.com",
      },
    ],
  },
  {
    slug: "project-qaafi",
    title: "Project Qaafi",
    description:
      "Project Qaafi — identity and digital foundations for a project that needed a clear visual voice from the start.",
    image: "/work/project-qaafi/project-qaafi-cover.webp",
    alt: "Project Qaafi",
    span: 3,
    col: 1,
    services: ["Brand identity", "Website design"],
    panels: [
      {
        kind: "text",
        title: "Selected work",
        body: "Brand and product-facing design for Project Qaafi — building a system that can grow with the project.",
      },
    ],
  },
  {
    slug: "t-bonk",
    title: "t.Bonk",
    description:
      "t.Bonk — visual identity and digital craft for a brand that needed to feel sharp, ownable, and ready for the feed.",
    image: "/work/t-bonk/t-bonk-cover.webp",
    alt: "t.Bonk",
    coverImage: "/work/t-bonk/t-bonk-project.webp",
    span: 3,
    col: 9,
    services: ["Brand identity", "Motion design"],
    panels: [
      {
        kind: "text",
        title: "Selected work",
        body: "Identity and digital work for t.Bonk, developed with Notice.",
      },
    ],
  },
  {
    slug: "perception-pod",
    title: "Perception Pod",
    description:
      "Perception Pod — design for a product that turns perception into something you can see, share, and trust.",
    image: "/work/perception-pod/perception-pod-cover.webp",
    alt: "Perception Pod",
    span: 5,
    col: 5,
    services: ["Brand identity", "Website design", "Motion design"],
    panels: [
      {
        kind: "text",
        title: "Selected work",
        body: "Product and brand design for Perception Pod. Live site: perceptionpod.com",
      },
    ],
  },
];

export type WorkGroup =
  | {
      kind: "pair";
      title: string;
      body: string;
      src: string;
      alt: string;
    }
  | { kind: "text"; title: string; body: string }
  | { kind: "image"; src: string; alt: string };

export function groupWorkPanels(panels: WorkPanel[]): WorkGroup[] {
  const groups: WorkGroup[] = [];
  let index = 0;

  while (index < panels.length) {
    const current = panels[index];
    if (!current) break;
    const next = panels[index + 1];

    if (current.kind === "text" && next?.kind === "image") {
      groups.push({
        kind: "pair",
        title: current.title,
        body: current.body,
        src: next.src,
        alt: next.alt,
      });
      index += 2;
      continue;
    }

    if (current.kind === "image" && next?.kind === "text") {
      groups.push({
        kind: "pair",
        title: next.title,
        body: next.body,
        src: current.src,
        alt: current.alt,
      });
      index += 2;
      continue;
    }

    groups.push(current);
    index += 1;
  }

  return groups;
}
