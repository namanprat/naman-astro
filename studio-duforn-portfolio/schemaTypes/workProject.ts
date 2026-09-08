import { defineArrayMember, defineField, defineType } from "sanity";
import { WORK_SERVICES, WORK_SPANS } from "./constants";

export const workPanelText = defineType({
  name: "workPanelText",
  title: "Text panel",
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "body",
      type: "text",
      rows: 6,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "title" },
    prepare: ({ title }) => ({ title: title || "Text panel" }),
  },
});

export const workPanelImage = defineType({
  name: "workPanelImage",
  title: "Image panel",
  type: "object",
  fields: [
    defineField({
      name: "image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "alt",
      type: "string",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: "alt", media: "image" },
    prepare: ({ title, media }) => ({
      title: title || "Image panel",
      media,
    }),
  },
});

export const workProject = defineType({
  name: "workProject",
  title: "Work project",
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
      description: "Listing order: gallery, featured slider, /work.",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "image",
      title: "Cover image",
      type: "image",
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "alt",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "coverVideo",
      description: "Motion piece stacked under the cover on the case-study page.",
      type: "file",
      options: { accept: "video/*" },
    }),
    defineField({
      name: "coverImage",
      title: "Cover still (below)",
      description: "Still stacked under the cover — same slot as the video.",
      type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "featured",
      type: "boolean",
      description: "Shown in the home featured slider.",
      initialValue: false,
    }),
    defineField({
      name: "span",
      type: "number",
      options: {
        list: WORK_SPANS.map((value) => ({ title: String(value), value })),
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "col",
      type: "number",
      description: "0-indexed Lumos start column.",
      validation: (rule) => rule.required().integer().min(0),
    }),
    defineField({
      name: "services",
      type: "array",
      of: [{ type: "string" }],
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
