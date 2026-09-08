/**
 * Studio schema. Field names match `src/lib/content/schemas.ts`; the check in
 * `tests/sanity-schema.check.ts` is what keeps them from drifting.
 */
import { work } from "./schemas/work.ts";
import {
  faq,
  process,
  about,
  nav,
  site,
  archiveItem,
} from "./schemas/singletons.ts";
import {
  workPanelText,
  workPanelImage,
  faqItem,
  processCard,
  navStackLink,
  navStack,
  navSocial,
  navOverlayLink,
  navOverlayAction,
  viewItem,
  siteTeam,
  sitePreloader,
  siteNotFound,
} from "./schemas/objects.ts";

export const schemaTypes = [
  work,
  faq,
  process,
  about,
  nav,
  site,
  archiveItem,
  workPanelText,
  workPanelImage,
  faqItem,
  processCard,
  navStackLink,
  navStack,
  navSocial,
  navOverlayLink,
  navOverlayAction,
  viewItem,
  siteTeam,
  sitePreloader,
  siteNotFound,
];
