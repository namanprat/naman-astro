import { defineArrayMember, defineField, defineType } from "sanity";

export const workPanelText = defineType({
  name: "workPanelText",
  title: "Text panel",
  type: "object",
  fields: [
    defineField({
      name: "kind",
      type: "string",
      initialValue: "text",
      hidden: true,
      readOnly: true,
    }),
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "body", type: "text", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "title" } },
});

export const workPanelImage = defineType({
  name: "workPanelImage",
  title: "Image panel",
  type: "object",
  fields: [
    defineField({
      name: "kind",
      type: "string",
      initialValue: "image",
      hidden: true,
      readOnly: true,
    }),
    defineField({ name: "src", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "alt", type: "string", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "alt", subtitle: "src" } },
});

export const faqItem = defineType({
  name: "faqItem",
  title: "FAQ item",
  type: "object",
  fields: [
    defineField({ name: "question", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "answer", type: "text", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "question" } },
});

export const processCard = defineType({
  name: "processCard",
  title: "Process card",
  type: "object",
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "description", type: "text", validation: (rule) => rule.required() }),
    defineField({
      name: "model",
      type: "string",
      options: { list: ["1", "2", "3"] },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "title" } },
});

export const navStackLink = defineType({
  name: "navStackLink",
  title: "Nav link",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "path", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "id", type: "string", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "label", subtitle: "path" } },
});

export const navStack = defineType({
  name: "navStack",
  title: "Nav stack",
  type: "object",
  fields: [
    defineField({ name: "col", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "links",
      type: "array",
      of: [defineArrayMember({ type: "navStackLink" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: { select: { title: "col" } },
});

export const navSocial = defineType({
  name: "navSocial",
  title: "Social link",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "href", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "newTab", type: "boolean", initialValue: false }),
  ],
  preview: { select: { title: "label" } },
});

export const navOverlayLink = defineType({
  name: "navOverlayLink",
  title: "Overlay link",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "path", type: "string", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "label", subtitle: "path" } },
});

export const navOverlayAction = defineType({
  name: "navOverlayAction",
  title: "Overlay action",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "action",
      type: "string",
      options: { list: ["theme"] },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "label" } },
});

export const viewItem = defineType({
  name: "viewItem",
  title: "View",
  type: "object",
  fields: [
    defineField({ name: "id", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
  ],
  preview: { select: { title: "label", subtitle: "id" } },
});

export const siteTeam = defineType({
  name: "siteTeam",
  title: "Team copy",
  type: "object",
  fields: [
    defineField({
      name: "titleLines",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({ name: "body", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "ctaLabel", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "ctaHref", type: "string", validation: (rule) => rule.required() }),
  ],
});

export const sitePreloader = defineType({
  name: "sitePreloader",
  title: "Preloader copy",
  type: "object",
  fields: [
    defineField({ name: "locationLine", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "disciplineLine", type: "string", validation: (rule) => rule.required() }),
  ],
});

export const siteNotFound = defineType({
  name: "siteNotFound",
  title: "404 copy",
  type: "object",
  fields: [
    defineField({ name: "title", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "body", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "linkLabel", type: "string", validation: (rule) => rule.required() }),
  ],
});
