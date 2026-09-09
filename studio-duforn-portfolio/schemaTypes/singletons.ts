import { defineArrayMember, defineField, defineType } from "sanity";
import { WORK_SERVICES } from "./constants";

const faqItem = defineArrayMember({
  type: "object",
  fields: [
    defineField({
      name: "question",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "answer",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "question" } },
});

const processCard = defineArrayMember({
  type: "object",
  fields: [
    defineField({
      name: "title",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "description",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "model",
      type: "string",
      options: {
        list: [
          { title: "1", value: "1" },
          { title: "2", value: "2" },
          { title: "3", value: "3" },
        ],
        layout: "radio",
      },
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "title", subtitle: "model" } },
});

const footerLink = defineArrayMember({
  type: "object",
  fields: [
    defineField({
      name: "label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "path",
      type: "string",
      validation: (rule) => rule.required(),
    }),
  ],
  preview: { select: { title: "label", subtitle: "path" } },
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({
      name: "eyebrow",
      title: "Eyebrow",
      type: "array",
      of: [{ type: "string" }],
      description: "Hero note lines. Each entry is a line; the break is editorial, not HTML.",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "faq",
      title: "FAQ",
      type: "object",
      fields: [
        defineField({
          name: "statement",
          type: "text",
          rows: 3,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "lead",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "items",
          type: "array",
          of: [faqItem],
          validation: (rule) => rule.required().min(1),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "process",
      title: "Process",
      type: "object",
      fields: [
        defineField({
          name: "statement",
          type: "text",
          rows: 3,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "cards",
          type: "array",
          of: [processCard],
          validation: (rule) => rule.required().min(1),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Homepage" }),
  },
});

export const footerSettings = defineType({
  name: "footerSettings",
  title: "Footer",
  type: "document",
  fields: [
    defineField({
      name: "tagline",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "links",
      type: "array",
      of: [footerLink],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Footer" }),
  },
});

export const aboutSettings = defineType({
  name: "aboutSettings",
  title: "About",
  type: "document",
  fields: [
    defineField({
      name: "lead",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "clients",
      type: "array",
      of: [{ type: "string" }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "services",
      type: "array",
      of: [{ type: "string" }],
      options: { list: [...WORK_SERVICES] },
      initialValue: [...WORK_SERVICES],
    }),
  ],
  preview: {
    prepare: () => ({ title: "About" }),
  },
});

export const marqueeSettings = defineType({
  name: "marqueeSettings",
  title: "Marquee",
  type: "document",
  fields: [
    defineField({
      name: "copy",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "enabled",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    prepare: () => ({ title: "Marquee" }),
  },
});
