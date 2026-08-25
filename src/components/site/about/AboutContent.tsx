import { lazy, Suspense, type RefObject } from "react";
import RollingText from "../RollingText";

/**
 * The About layout, shared verbatim by the desktop overlay (`AboutPanel`) and
 * the mobile route (`AboutPage`). It owns markup and copy only — every mode's
 * positioning, scrolling and reveal choreography stays with its own wrapper, so
 * the two presentations cannot drift apart on content.
 */

const AboutDitherCanvas = lazy(() => import("./AboutDitherCanvas"));

const SERVICES = [
  "Brand strategy",
  "Visual identity",
  "Website design",
  "Website development",
  "Motion design",
] as const;

const CLIENTS = [
  "Animal",
  "Notice",
  "Project Qaafi",
  "Perception Pod",
  "November",
  "Egodeath",
  "Haptic AI",
  "t.Bonk",
] as const;

/** Max items per clients column before spilling to the next with gutter. */
const CLIENTS_PER_COL = 4;

function chunkClients(items: readonly string[], size: number): string[][] {
  const columns: string[][] = [];
  for (let i = 0; i < items.length; i += size) {
    columns.push([...items.slice(i, i + size)]);
  }
  return columns;
}

/* Hoisted: the split never depends on props, so it must not be recomputed per
   render (rerender-lazy-state-init / js-cache-function-results). */
const CLIENT_COLUMNS = chunkClients(CLIENTS, CLIENTS_PER_COL);

type AboutContentProps = {
  /** The media block — also the canvas's pointer `eventSource`. */
  mediaRef: RefObject<HTMLDivElement | null>;
  /** Owner decides when the WebGL bust is worth mounting; see `aboutBust.ts`. */
  mountCanvas: boolean;
  /** Only the overlay needs this — it fades the canvas in as it opens. */
  onCanvasReady?: () => void;
};

export default function AboutContent({
  mediaRef,
  mountCanvas,
  onCanvasReady,
}: AboutContentProps) {
  return (
    <div className="about_panel_grid grid is-12">
      <div
        ref={mediaRef}
        className="about_panel_reveal about_panel_media"
        aria-hidden="true"
      >
        <div className="about_panel_reveal_inner">
          {mountCanvas && (
            <Suspense fallback={null}>
              <AboutDitherCanvas
                eventSource={mediaRef}
                onReady={onCanvasReady}
              />
            </Suspense>
          )}
        </div>
      </div>

      <div className="about_panel_reveal about_panel_intro">
        <div className="about_panel_reveal_inner">
          <h3 className="about_panel_lead text-style-h3">
            I make things look good and work better. Immersed in your story,
            ruthless about what moves people, and built to close the gap between
            who you are and how the world sees you.
          </h3>
          <span className="about_panel_cv_clip">
            <a
              className="about_panel_cv text-style-main"
              href="/main-assets/cv.pdf"
              download
            >
              <span className="about_panel_cv_label">
                <RollingText>Download CV</RollingText>
              </span>
              <span className="about_panel_cv_icon" aria-hidden="true">
                ↗
              </span>
            </a>
          </span>
        </div>
      </div>

      <div className="about_panel_lists">
        <div className="about_panel_reveal about_panel_col is-services">
          <div className="about_panel_reveal_inner">
            <h5 className="about_panel_col_label text-style-main">Services</h5>
            <div className="about_panel_col_list">
              {SERVICES.map((item) => (
                <h5 key={item} className="text-style-main">
                  {item}
                </h5>
              ))}
            </div>
          </div>
        </div>

        <div className="about_panel_reveal about_panel_col is-clients">
          <div className="about_panel_reveal_inner">
            <h5 className="about_panel_col_label text-style-main">Clients</h5>
            <div className="about_panel_clients_cols">
              {CLIENT_COLUMNS.map((column, index) => (
                <div
                  key={`clients-col-${index}`}
                  className="about_panel_col_list"
                >
                  {column.map((item) => (
                    <h5 key={item} className="text-style-main">
                      {item}
                    </h5>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
