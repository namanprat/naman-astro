import { useRef, useState } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { prefersReducedMotion } from "@/lib/site/prefersReducedMotion";
import "./Faq.css";

gsap.registerPlugin(ScrollTrigger);

const OPEN_S = 0.5;
const CLOSE_S = 0.4;

const FAQ_ITEMS = [
  {
    question: "Who will actually be working on the project?",
    answer:
      "We lead every project: strategy, creative direction, and your point of contact throughout. Depending on scope, a few trusted collaborators help on design and build. You get us in the work with you, not a vendor you brief and wait on. Small projects get the same attention as large ones.",
  },
  {
    question: "How long do projects usually take?",
    answer:
      "Most projects run 10 to 14 weeks start to finish. Timelines move with scope, but milestones are set on day one so nothing catches you off guard.",
  },
  {
    question: "How do you keep me in the loop?",
    answer:
      "Simple and transparent. You get written updates as things move, plus a weekly check-in, and we get on a call for the decisions that actually need one. We'll work in whatever tools you already use.",
  },
  {
    question: "What do you need to start?",
    answer:
      "We get on a call, you tell us what you need, and we send back a proposal built for it. Then a signed agreement and the deposit. That's it. Onboarding stays short so we can get to the actual work.",
  },
  {
    question: "What happens after launch?",
    answer:
      "A stretch of hands-on support while everything settles, plus notes clear enough that you can update it yourself. After that it's yours to run. If you'd rather we stay on, that's a separate conversation.",
  },
  {
    question: "Can you handle branding, design and development?",
    answer:
      "Yes, and doing them together is the point. Story, identity, visuals and build line up from day one, so what you end up with is one thing instead of three handoffs.",
  },
  {
    question: "Who do you work with?",
    answer:
      "Early-stage brands and startups, usually right before they meet the world properly for the first time. We're in Mumbai and Bangalore, and work with clients anywhere. If you'd rather not look like every other company in your category, that's the brief.",
  },
];

/**
 * The FAQ statement is an ordinary `h2`, so the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts` owns it — `.faq` is absent from that module's SKIP
 * list on purpose. The hanging first line is the empty `.studio_title_indent`
 * box rather than a `text-indent`: it is exactly three columns wide and, being
 * ordinary inline content, it wraps and splits with the rest of the heading.
 *
 * Panels animate to `height: "auto"` rather than a cached `scrollHeight`, so a
 * resize or a late font swap can't leave a panel clipped. Every settled toggle
 * refreshes ScrollTrigger: opening one changes `.studio`'s height, and both the
 * footer's scale scrub and the nav-hide trigger measure `.studio`'s bottom.
 */
export default function Faq() {
  const rootRef = useRef<HTMLElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || prefersReducedMotion()) return;

      const items = gsap.utils.toArray<HTMLElement>(".faq_item", root);
      if (!items.length) return;

      gsap.from(items, {
        opacity: 0,
        y: 20,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.1,
        scrollTrigger: { trigger: root, start: "top 75%", once: true },
      });
    },
    { scope: rootRef },
  );

  const toggle = (index: number) => {
    const panel = panelRefs.current[index];
    const isOpen = open.has(index);

    setOpen((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(index);
      else next.add(index);
      return next;
    });

    if (!panel) return;

    const height = isOpen ? 0 : "auto";
    if (prefersReducedMotion()) {
      gsap.set(panel, { height });
      ScrollTrigger.refresh();
      return;
    }

    gsap.to(panel, {
      height,
      duration: isOpen ? CLOSE_S : OPEN_S,
      ease: "power2.out",
      overwrite: true,
      onComplete: () => ScrollTrigger.refresh(),
    });
  };

  return (
    <section
      className="faq_wrap studio_section"
      id="faq"
      aria-label="FAQ"
      ref={rootRef}
    >
      <div className="faq_contain container gap-0">
        <div className="faq_layout studio_layout grid is-12">
          <div className="faq_statement studio_statement">
            <h2 className="faq_title studio_title text-style-h2">
              <span className="studio_title_indent" aria-hidden="true" />We take
              on fewer projects so we can be fully present on each one. Every
              layer earns its place before we move to the next.
            </h2>
          </div>

          <p className="faq_lead text-style-h4">
            Here&apos;s what&apos;s worth knowing before we start.
          </p>

          <ul className="faq_items">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = open.has(index);
              const panelId = `faq-panel-${index}`;
              const buttonId = `faq-question-${index}`;
              return (
                <li className="faq_item" key={item.question}>
                  <button
                    className="faq_question"
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                  >
                    <span className="faq_question_text text-style-main">
                      {item.question}
                    </span>
                    <svg
                      className="faq_icon"
                      viewBox="0 0 20 20"
                      width="20"
                      height="20"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M3.5 10h12M11 5.5 15.5 10 11 14.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  <div
                    className="faq_answer"
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    ref={(el) => {
                      panelRefs.current[index] = el;
                    }}
                  >
                    {/* Padding lives on the inner box so `height: "auto"`
                        measures it, instead of being tweened alongside. */}
                    <div className="faq_answer_inner">
                      <p className="faq_answer_copy text-style-main">
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
