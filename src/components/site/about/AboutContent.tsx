import { lazy, Suspense, useMemo, type RefObject } from "react";
import type { AboutData } from "@/lib/content/models";

/**
 * The About layout, shared verbatim by the desktop overlay (`AboutPanel`) and
 * the mobile route (`AboutPage`). It owns markup and copy only — every mode's
 * positioning, scrolling and reveal choreography stays with its own wrapper, so
 * the two presentations cannot drift apart on content.
 */

const AboutAsciiCanvas = lazy(() => import("./AboutAsciiCanvas"));

/** Max items per clients column before spilling to the next with gutter. */
const CLIENTS_PER_COL = 4;

function chunkClients(items: readonly string[], size: number): string[][] {
  const columns: string[][] = [];
  for (let i = 0; i < items.length; i += size) {
    columns.push([...items.slice(i, i + size)]);
  }
  return columns;
}

type AboutContentProps = {
  about: AboutData;
  /** The media block — also the canvas's pointer `eventSource`. */
  mediaRef: RefObject<HTMLDivElement | null>;
  /** Owner decides when the WebGL bust is worth mounting; see `aboutBust.ts`. */
  mountCanvas: boolean;
  /** Only the overlay needs this — it fades the canvas in as it opens. */
  onCanvasReady?: () => void;
};

export default function AboutContent({
  about,
  mediaRef,
  mountCanvas,
  onCanvasReady,
}: AboutContentProps) {
  const clientColumns = useMemo(
    () => chunkClients(about.clients, CLIENTS_PER_COL),
    [about.clients],
  );
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
              <AboutAsciiCanvas
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
            {about.lead}
          </h3>
        </div>
      </div>

      <div className="about_panel_lists">
        <div className="about_panel_reveal about_panel_col is-services">
          <div className="about_panel_reveal_inner">
            <h5 className="about_panel_col_label text-style-main">Services</h5>
            <div className="about_panel_col_list">
              {about.services.map((item) => (
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
              {clientColumns.map((column, index) => (
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
