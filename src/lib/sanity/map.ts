import { WORK_SERVICES } from "../../content/services.ts";
import type { WorkPanel, WorkService } from "../../content/work.ts";
import { imageUrl, type SanityImage } from "./image.ts";

const WORK_SERVICE_SET = new Set<string>(WORK_SERVICES);

type FileAsset = {
  asset?: { url?: string; mimeType?: string; originalFilename?: string };
};

export type RawWorkPanel =
  | { _type: "workPanelText"; title?: string; body?: string }
  | { _type: "workPanelImage"; image?: SanityImage; alt?: string };

export type RawWorkProject = {
  slug?: string;
  order?: number;
  title?: string;
  description?: string;
  image?: SanityImage;
  alt?: string;
  coverVideo?: string | FileAsset;
  coverImage?: SanityImage;
  featured?: boolean;
  services?: string[];
  panels?: RawWorkPanel[];
};

export type RawArchiveItem = {
  id?: string;
  order?: number;
  span?: string;
  image?: SanityImage;
  videoPath?: string | FileAsset;
};

export type RawFaq = {
  statement?: string;
  lead?: string;
  items?: { question?: string; answer?: string }[];
};

export type RawProcess = {
  statement?: string;
  cards?: { title?: string; description?: string; model?: string }[];
};

export type RawSite = {
  eyebrow?: string[];
  heroNote?: string[];
  faq?: RawFaq;
  process?: RawProcess;
};

export type RawAbout = {
  lead?: string;
  clients?: string[];
  services?: string[];
};

export type RawFooter = {
  tagline?: string;
  links?: { label?: string; path?: string }[];
};

export type RawMarquee = {
  copy?: string;
  enabled?: boolean;
};

function asWorkService(value: string): WorkService | null {
  return WORK_SERVICE_SET.has(value) ? (value as WorkService) : null;
}

/** Studio used to store videos as `file` assets; live docs also hold string paths. */
function fileOrStringUrl(value: string | FileAsset | undefined): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  const url = value?.asset?.url?.trim();
  return url || undefined;
}

function mapPanel(panel: RawWorkPanel): WorkPanel | null {
  switch (panel._type) {
    case "workPanelText":
      if (!panel.title || !panel.body) return null;
      return { kind: "text", title: panel.title, body: panel.body };
    case "workPanelImage": {
      const src = imageUrl(panel.image, 2000);
      if (!src) return null;
      return { kind: "image", src, alt: panel.alt ?? "" };
    }
    default: {
      const _exhaustive: never = panel;
      return _exhaustive;
    }
  }
}

export function mapWorkProject(
  doc: RawWorkProject,
): { id: string; data: Record<string, unknown> } | null {
  const id = doc.slug?.trim();
  const services = (doc.services ?? [])
    .map(asWorkService)
    .filter((service): service is WorkService => service !== null);
  const panels = (doc.panels ?? [])
    .map(mapPanel)
    .filter((panel): panel is WorkPanel => panel !== null);
  const image = imageUrl(doc.image, 1800);
  if (!id || !doc.title || !doc.description || !image || !doc.alt) {
    return null;
  }
  if (!services.length || !panels.length || typeof doc.order !== "number") {
    return null;
  }
  const coverVideo = fileOrStringUrl(doc.coverVideo);
  const coverImage = imageUrl(doc.coverImage, 1800);
  return {
    id,
    data: {
      order: doc.order,
      title: doc.title,
      description: doc.description,
      image,
      alt: doc.alt,
      ...(coverVideo ? { coverVideo } : {}),
      ...(coverImage ? { coverImage } : {}),
      featured: Boolean(doc.featured),
      services,
      panels,
    },
  };
}

export function mapArchiveItem(
  doc: RawArchiveItem,
): { id: string; data: Record<string, unknown> } | null {
  const id = doc.id?.trim();
  const src = fileOrStringUrl(doc.videoPath) || imageUrl(doc.image);
  if (!id || !src) return null;
  return {
    id,
    data: {
      order: doc.order ?? 0,
      src,
      span: doc.span === "width" ? "width" : "height",
    },
  };
}

function requiredString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredList(values: string[] | undefined): string[] | null {
  const next = (values ?? []).map((value) => value.trim()).filter(Boolean);
  return next.length ? next : null;
}

export function mapFaq(
  doc: RawFaq | null | undefined,
): { statement: string; lead: string; items: { question: string; answer: string }[] } | null {
  if (!doc) return null;
  const statement = requiredString(doc.statement);
  const lead = requiredString(doc.lead);
  const items = (doc.items ?? []).filter(
    (item): item is { question: string; answer: string } =>
      Boolean(item.question && item.answer),
  );
  if (!statement || !lead || !items.length) return null;
  return { statement, lead, items };
}

export function mapProcess(
  doc: RawProcess | null | undefined,
): {
  statement: string;
  cards: { title: string; description: string; model: "1" | "2" | "3" }[];
} | null {
  if (!doc) return null;
  const statement = requiredString(doc.statement);
  const cards = (doc.cards ?? []).filter(
    (
      card,
    ): card is { title: string; description: string; model: "1" | "2" | "3" } =>
      Boolean(
        card.title &&
          card.description &&
          (card.model === "1" || card.model === "2" || card.model === "3"),
      ),
  );
  if (!statement || !cards.length) return null;
  return { statement, cards };
}

export function mapSite(
  doc: RawSite | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const eyebrow = requiredList(doc.eyebrow ?? doc.heroNote);
  const faq = mapFaq(doc.faq);
  const process = mapProcess(doc.process);
  if (!eyebrow || !faq || !process) return null;
  return {
    id: "site",
    data: { eyebrow, faq, process },
  };
}

export function mapAbout(
  doc: RawAbout | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const lead = requiredString(doc.lead);
  const clients = requiredList(doc.clients);
  if (!lead || !clients) return null;
  const services = (doc.services ?? [])
    .map(asWorkService)
    .filter((service): service is WorkService => service !== null);
  return {
    id: "about",
    data: {
      lead,
      clients,
      services: services.length ? services : [...WORK_SERVICES],
    },
  };
}

export function mapFooter(
  doc: RawFooter | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const tagline = requiredString(doc.tagline);
  const links = (doc.links ?? []).filter(
    (link): link is { label: string; path: string } =>
      Boolean(link.label && link.path),
  );
  if (!tagline || !links.length) return null;
  return { id: "footer", data: { tagline, links } };
}

export function mapMarquee(
  doc: RawMarquee | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const copy = requiredString(doc.copy);
  if (!copy) return null;
  return {
    id: "marquee",
    data: {
      copy,
      enabled: Boolean(doc.enabled),
    },
  };
}
