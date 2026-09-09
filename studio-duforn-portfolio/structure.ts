import type { StructureResolver } from "sanity/structure";
import { SINGLETON_IDS } from "./schemaTypes/constants";

function singleton(
  S: Parameters<StructureResolver>[0],
  type: keyof typeof SINGLETON_IDS,
  title: string,
) {
  const id = SINGLETON_IDS[type];
  return S.listItem()
    .title(title)
    .id(id)
    .child(S.document().schemaType(type).documentId(id));
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title("Content")
    .items([
      singleton(S, "siteSettings", "Homepage"),
      S.divider(),
      S.documentTypeListItem("workProject").title("Work"),
      S.documentTypeListItem("archiveItem").title("Archive"),
      S.divider(),
      singleton(S, "aboutSettings", "About"),
      singleton(S, "faqSettings", "FAQ"),
      singleton(S, "processSettings", "Process"),
      singleton(S, "navSettings", "Marquee"),
    ]);
