import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemaTypes";
import { SINGLETON_TYPES } from "./schemaTypes/constants";
import { structure } from "./structure";

const singletonSet = new Set<string>(SINGLETON_TYPES);

export default defineConfig({
  name: "default",
  title: "duforn portfolio",
  projectId: "dj9l9mvw",
  dataset: "production",
  plugins: [structureTool({ structure }), visionTool()],
  schema: {
    types: schemaTypes,
  },
  document: {
    newDocumentOptions: (prev, { creationContext }) => {
      if (creationContext.type !== "global") return prev;
      return prev.filter((template) => !singletonSet.has(template.templateId));
    },
    actions: (prev, { schemaType }) => {
      if (!singletonSet.has(schemaType)) return prev;
      return prev.filter((action) => {
        const name = action.action;
        return name !== "duplicate" && name !== "delete" && name !== "unpublish";
      });
    },
  },
});
