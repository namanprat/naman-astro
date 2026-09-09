export type WorkPanel =
  | { kind: "text"; title: string; body: string }
  | { kind: "image"; src: string; alt: string };

/** About-panel vocabulary, reused per project on the case-study hero. */
export type WorkService =
  | "Brand identity"
  | "Website design"
  | "Website development"
  | "Motion design"
  | "3D";

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
  /** Shown in the home featured slider when true. */
  featured?: boolean;
  services: WorkService[];
  panels: WorkPanel[];
};

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
