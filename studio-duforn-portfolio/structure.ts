import type { StructureResolver } from "sanity/structure";
import { SINGLETON_IDS, SINGLETON_TYPES } from "./schemaTypes/constants";

const SINGLETON_TITLES: Record<(typeof SINGLETON_TYPES)[number], string> = {
  siteSettings: "Site",
  aboutSettings: "About",
  faqSettings: "FAQ",
  processSettings: "Process",
  navSettings: "Marquee",
};

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      S.documentTypeListItem("workProject").title("Work"),
      S.documentTypeListItem("archiveItem").title("Archive"),
      S.divider(),
      ...SINGLETON_TYPES.map((type) =>
        S.listItem()
          .title(SINGLETON_TITLES[type])
          .id(SINGLETON_IDS[type])
          .child(
            S.document().schemaType(type).documentId(SINGLETON_IDS[type]),
          ),
      ),
    ]);
