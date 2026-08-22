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
    question: "What exactly does GXO do?",
    answer:
      "We operate as a single commercial transformation partner. We diagnose what's blocking growth, build the commercial system to fix it, and stay embedded until revenue moves: brand, GTM, sales, pricing, talent, operations and data under one roof.",
  },
  {
    question: "How is this different from hiring an agency?",
    answer:
      "Agencies run campaigns and hand you deliverables. We own the outcome. One connected brief, one accountable partner, and a system that ties spend to pipeline, not three agencies and four channels nobody is orchestrating.",
  },
  {
    question: "How does the engagement work?",
    answer:
      "A three-part operating system (Voice, Visibility, Velocity) led by a fractional CMO. Voice gives you the narrative, Visibility gives you the room, Velocity turns awareness into revenue. Typically 90 days to a 5× pipeline lift.",
  },
  {
    question: "What are Voice, Visibility, and Velocity?",
    answer:
      "Voice is narrative systems and executive alignment: what you say and why now. Visibility is executive and brand credibility: where you show up and how you're perceived. Velocity is performance marketing and GTM execution: how awareness becomes measurable growth.",
  },
  {
    question: "Who do you work with?",
    answer:
      "Growth-stage founders and leadership teams who are scaling but still run everything through the founder, whose message differs between sales and marketing, or who need senior leadership without the cost and ramp of a full-time CMO.",
  },
  {
    question: "Do I get a full-time CMO?",
    answer:
      "You get fractional CMO-led leadership backed by a global team: the senior firepower without the $300K hire, long ramp, and single point of risk.",
  },
  {
    question: "Where is the team based?",
    answer:
      "Battle-tested leadership across continents: an agile team spanning the USA, UK, Brussels, South Africa, Egypt, Dubai and India. Global scale, local execution.",
  },
  {
    question: "How do you measure success?",
    answer:
      "Revenue accountability. We build revenue-driven KPI dashboards that connect marketing spend to pipeline, so progress is visible, not a story you have to take on faith when the board asks.",
  },
  {
    question: "Do you host events?",
    answer:
      "Yes. GXO hosts intimate gatherings for entrepreneurs, taste makers and thought leaders, including our evening on the eve of Cannes Lions. By invitation only; share your details and we'll be in touch.",
  },
  {
    question: "How do we get started?",
    answer:
      "Use the contact form to tell us what's slowing your revenue. We'll talk through where the system is broken and what to build first.",
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

      const items = gsap.utils.toArray<HTMLElement>(".faq__item", root);
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
    <section className="faq" id="faq" aria-label="FAQ" ref={rootRef}>
      <div className="faq__inner container gap-0">
        <div className="faq__grid grid is-12">
          <div className="faq__statement">
            <span className="faq__label text-style-mono">(FAQ&apos;s)</span>
            <h2 className="faq__title text-style-h2">
              GXO exists as a single point of accountability for commercial
              growth. A reference for how we diagnose, build, and stay embedded
              until revenue moves.
            </h2>
          </div>

          <p className="faq__lead text-style-h4">
            It reflects a belief in focus, restraint, and doing fewer things
            properly: the conditions required to make growth repeatable.
          </p>

          <ul className="faq__items">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = open.has(index);
              const panelId = `faq-panel-${index}`;
              const buttonId = `faq-question-${index}`;
              return (
                <li className="faq__item" key={item.question}>
                  <button
                    className="faq__question"
                    id={buttonId}
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                  >
                    <span className="faq__index text-style-mono">
                      {`(${index + 1})`}
                    </span>
                    <span className="faq__question-text text-style-main">
                      {item.question}
                    </span>
                    <svg
                      className="faq__icon"
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
                    className="faq__answer"
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    ref={(el) => {
                      panelRefs.current[index] = el;
                    }}
                  >
                    {/* Padding lives on the inner box so `height: "auto"`
                        measures it, instead of being tweened alongside. */}
                    <div className="faq__answer-inner">
                      <p className="faq__answer-copy text-style-main">
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
