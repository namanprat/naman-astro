import { defineField, defineType } from "sanity";

export const archiveItem = defineType({
  name: "archiveItem",
  title: "Archive item",
  type: "document",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "order",
      type: "number",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "image",
      type: "image",
      options: { hotspot: true },
      hidden: ({ parent }) => Boolean(parent?.video),
    }),
    defineField({
      name: "video",
      type: "file",
      options: { accept: "video/*" },
      hidden: ({ parent }) => Boolean(parent?.image),
    }),
    defineField({
      name: "span",
      type: "string",
      options: {
        list: [
          { title: "Height (portrait)", value: "height" },
          { title: "Width (landscape)", value: "width" },
        ],
        layout: "radio",
      },
      initialValue: "height",
    }),
  ],
  orderings: [
    {
      title: "Listing order",
      name: "orderAsc",
      by: [{ field: "order", direction: "asc" }],
    },
  ],
  preview: {
    select: { title: "title", media: "image", order: "order" },
    prepare: ({ title, media, order }) => ({
      title,
      subtitle: typeof order === "number" ? `Order ${order}` : undefined,
      media,
    }),
  },
});
