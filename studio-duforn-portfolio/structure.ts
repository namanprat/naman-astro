import type { StructureResolver } from "sanity/structure";
import { SINGLETON_IDS, SINGLETON_TYPES } from "./schemaTypes/constants";

const SINGLETON_TITLES: Record<(typeof SINGLETON_TYPES)[number], string> = {
  site: "Home page",
  marquee: "Marquee",
  social: "Social",
  footer: "Footer",
  siteSettings: "Site settings",
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
