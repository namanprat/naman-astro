import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./sanity/schema.ts";

/**
 * Embedded Studio. `projectId` / `dataset` come from the environment; the
 * Astro integration only mounts `/studio` when `PUBLIC_SANITY_PROJECT_ID` is
 * set, so a missing id never boots a studio against a placeholder project.
 */
export default defineConfig({
  name: "duforn",
  title: "duforn",
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID ?? "",
  dataset: process.env.PUBLIC_SANITY_DATASET ?? "production",
  plugins: [
    structureTool({
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.listItem()
              .title("About")
              .id("about")
              .child(S.document().schemaType("about").documentId("about")),
            S.listItem()
              .title("FAQ")
              .id("faq")
              .child(S.document().schemaType("faq").documentId("faq")),
            S.listItem()
              .title("Nav")
              .id("nav")
              .child(S.document().schemaType("nav").documentId("nav")),
            S.listItem()
              .title("Process")
              .id("process")
              .child(S.document().schemaType("process").documentId("process")),
            S.listItem()
              .title("Site")
              .id("site")
              .child(S.document().schemaType("site").documentId("site")),
            S.divider(),
            S.documentTypeListItem("work").title("Work"),
            S.documentTypeListItem("archiveItem").title("Archive"),
          ]),
    }),
  ],
  schema: { types: schemaTypes },
});
