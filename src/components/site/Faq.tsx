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
      "I lead every engagement: strategy, creative direction, and your primary point of contact throughout. Depending on scope, a small set of collaborators supports on design and development. The level of care stays consistent, regardless of project size.",
  },
  {
    question: "How long do projects usually take?",
    answer:
      "Most projects run 10–14 weeks end-to-end. Timelines flex with scope, but milestones are set from day one so there are no surprises.",
  },
  {
    question: "How do you communicate and manage work?",
    answer:
      "Simple and transparent. You'll get async updates and weekly communication; calls are scheduled to review important decisions or milestones. We can work in your tools so the process stays structured without getting heavy.",
  },
  {
    question: "What do you need to start?",
    answer:
      "We'll talk through your needs on a call and I'll send a tailored proposal. After that, a signed agreement and the initial deposit. That's all. Onboarding stays short so we can get to the work.",
  },
  {
    question: "What happens after launch?",
    answer:
      "A stretch of hands-on support so everything runs, plus the notes you need to update the site yourself. After that you're equipped to run it in-house — and if you want ongoing care, we can talk about that separately.",
  },
  {
    question: "Can you handle branding, design and development?",
    answer:
      "Yes. The work is delivering them together. Narrative, identity, visuals and functionality get aligned from day one, so the final experience is one thing, not three handoffs.",
  },
  {
    question: "Who do you work with?",
    answer:
      "Founders and brands whose reputation has outgrown their digital presence — established work that still looks smaller than it is. If the site no longer matches what you've built, that's the brief.",
  },
];

/**
 * The FAQ statement is an ordinary `h2`, so the site-wide gooey entrance in
 * `lib/site/gooeyReveal.ts` owns it — `.faq` is absent from that module's SKIP
 * list on purpose, and `styles/site.css` keeps the `text-indent` on the first
 * split line only.
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
            <span className="faq_label studio_label text-style-mono">
              (FAQ&apos;s)
            </span>
            <h2 className="faq_title studio_title text-style-h2">
              Here&apos;s what you need to consider before we start.
            </h2>
          </div>

          <p className="faq_lead text-style-h4">
            Fewer projects, fully present. Intention over speed — every layer
            earns its place before we move to the next.
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
