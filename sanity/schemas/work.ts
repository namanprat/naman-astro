import { defineArrayMember, defineField, defineType } from "sanity";
import { WORK_SERVICES } from "../../src/lib/content/services.ts";

/**
 * Studio fields for a work document. Keys match `workSchema`.
 *
 * ponytail: `slug` is the entry id, not a data field — it is absent from the
 * zod schema on purpose (the filename stem is the `/work/[slug]` route). The
 * loader reads `slug.current` as the collection id and strips it before
 * validation, so it is allowed to exist here without appearing there.
 */
export const work = defineType({
  name: "work",
  title: "Work",
  type: "document",
  fields: [
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title" },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "order",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "description", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "image", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "alt", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "coverVideo", type: "string" }),
    defineField({ name: "coverImage", type: "string" }),
    defineField({ name: "featured", type: "boolean", initialValue: false }),
    defineField({
      name: "span",
      type: "number",
      options: { list: [2, 3, 5] },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "col",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "services",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...WORK_SERVICES] },
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "panels",
      type: "array",
      of: [
        defineArrayMember({ type: "workPanelText" }),
        defineArrayMember({ type: "workPanelImage" }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
  preview: { select: { title: "title", subtitle: "order" } },
});
