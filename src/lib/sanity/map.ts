import { WORK_SERVICES } from "../../content/services.ts";
import type { WorkPanel, WorkService, WorkSpan } from "../../content/work.ts";
import { imageUrl, type SanityImage } from "./image.ts";

const WORK_SERVICE_SET = new Set<string>(WORK_SERVICES);
const WORK_SPANS = new Set<WorkSpan>([2, 3, 5]);

type FileAsset = {
  asset?: { url?: string; mimeType?: string; originalFilename?: string };
};

export type RawWorkPanel =
  | { _type: "workPanelText"; title?: string; body?: string }
  | { _type: "workPanelImage"; image?: SanityImage; alt?: string }
  | { _type: "workPanelVideo"; video?: FileAsset; alt?: string };

export type RawWorkProject = {
  slug?: string;
  order?: number;
  title?: string;
  description?: string;
  image?: SanityImage;
  alt?: string;
  coverVideo?: FileAsset;
  coverImage?: SanityImage;
  featured?: boolean;
  span?: number;
  col?: number;
  services?: string[];
  panels?: RawWorkPanel[];
};

export type RawArchiveItem = {
  id?: string;
  order?: number;
  span?: string;
  image?: SanityImage;
  video?: FileAsset;
};

export type RawSite = {
  heroNote?: string[];
  manifesto?: string;
  team?: {
    titleLines?: string[];
    body?: string;
    ctaLabel?: string;
    ctaHref?: string;
  };
  footerTagline?: string;
  preloader?: { locationLine?: string; disciplineLine?: string };
  notFound?: { title?: string; body?: string; linkLabel?: string };
  workViews?: { id?: string; label?: string }[];
  archiveViews?: { id?: string; label?: string }[];
};

export type RawAbout = {
  lead?: string;
  clients?: string[];
  services?: string[];
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

export type RawNav = {
  availabilityLine?: string;
  enabled?: boolean;
};

function asWorkService(value: string): WorkService | null {
  return WORK_SERVICE_SET.has(value) ? (value as WorkService) : null;
}

function asWorkSpan(value: number | undefined): WorkSpan | null {
  return value !== undefined && WORK_SPANS.has(value as WorkSpan)
    ? (value as WorkSpan)
    : null;
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
    case "workPanelVideo": {
      const src = panel.video?.asset?.url;
      if (!src) return null;
      return { kind: "video", src, alt: panel.alt ?? "" };
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
  const span = asWorkSpan(doc.span);
  const services = (doc.services ?? [])
    .map(asWorkService)
    .filter((service): service is WorkService => service !== null);
  const panels = (doc.panels ?? [])
    .map(mapPanel)
    .filter((panel): panel is WorkPanel => panel !== null);
  const image = imageUrl(doc.image, 1800);
  if (!id || !doc.title || !doc.description || !image || !doc.alt || span === null) {
    return null;
  }
  if (!services.length || !panels.length || typeof doc.order !== "number") {
    return null;
  }
  const coverVideo = doc.coverVideo?.asset?.url;
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
      span,
      col: doc.col ?? 0,
      services,
      panels,
    },
  };
}

export function mapArchiveItem(
  doc: RawArchiveItem,
): { id: string; data: Record<string, unknown> } | null {
  const id = doc.id?.trim();
  const videoUrl = doc.video?.asset?.url;
  const src = videoUrl || imageUrl(doc.image);
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

export function mapSite(
  doc: RawSite | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const heroNote = requiredList(doc.heroNote);
  const manifesto = requiredString(doc.manifesto);
  const teamLines = requiredList(doc.team?.titleLines);
  const teamBody = requiredString(doc.team?.body);
  const ctaLabel = requiredString(doc.team?.ctaLabel);
  const ctaHref = requiredString(doc.team?.ctaHref);
  const footerTagline = requiredString(doc.footerTagline);
  const locationLine = requiredString(doc.preloader?.locationLine);
  const disciplineLine = requiredString(doc.preloader?.disciplineLine);
  const notFoundTitle = requiredString(doc.notFound?.title);
  const notFoundBody = requiredString(doc.notFound?.body);
  const notFoundLink = requiredString(doc.notFound?.linkLabel);
  const workViews = (doc.workViews ?? []).filter(
    (view): view is { id: string; label: string } =>
      Boolean(view.id && view.label),
  );
  const archiveViews = (doc.archiveViews ?? []).filter(
    (view): view is { id: string; label: string } =>
      Boolean(view.id && view.label),
  );
  if (
    !heroNote ||
    !manifesto ||
    !teamLines ||
    !teamBody ||
    !ctaLabel ||
    !ctaHref ||
    !footerTagline ||
    !locationLine ||
    !disciplineLine ||
    !notFoundTitle ||
    !notFoundBody ||
    !notFoundLink ||
    !workViews.length ||
    !archiveViews.length
  ) {
    return null;
  }
  return {
    id: "site",
    data: {
      heroNote,
      manifesto,
      team: {
        titleLines: teamLines,
        body: teamBody,
        ctaLabel,
        ctaHref,
      },
      footerTagline,
      preloader: { locationLine, disciplineLine },
      notFound: {
        title: notFoundTitle,
        body: notFoundBody,
        linkLabel: notFoundLink,
      },
      workViews,
      archiveViews,
    },
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

export function mapFaq(
  doc: RawFaq | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const statement = requiredString(doc.statement);
  const lead = requiredString(doc.lead);
  const items = (doc.items ?? []).filter(
    (item): item is { question: string; answer: string } =>
      Boolean(item.question && item.answer),
  );
  if (!statement || !lead || !items.length) return null;
  return { id: "faq", data: { statement, lead, items } };
}

export function mapProcess(
  doc: RawProcess | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
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
  return { id: "process", data: { statement, cards } };
}

export function mapNav(
  doc: RawNav | null | undefined,
): { id: string; data: Record<string, unknown> } | null {
  if (!doc) return null;
  const availabilityLine = requiredString(doc.availabilityLine) ?? "";
  const enabled = Boolean(doc.enabled) && Boolean(availabilityLine);
  if (!enabled && !availabilityLine && doc.enabled == null) {
    return null;
  }
  return {
    id: "nav",
    data: {
      availabilityLine,
      enabled,
    },
  };
}
