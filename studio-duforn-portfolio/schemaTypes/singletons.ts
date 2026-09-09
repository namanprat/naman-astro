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

export const site = defineType({
  name: "site",
  title: "Homepage",
  type: "document",
  fieldsets: [
    { name: "sitecopy", title: "Sitecopy", options: { collapsible: false } },
    { name: "faq", title: "FAQ", options: { collapsible: false } },
    { name: "process", title: "Process", options: { collapsible: false } },
  ],
  fields: [
    defineField({
      name: "eyebrow",
      title: "Hero note",
      type: "array",
      of: [{ type: "string" }],
      fieldset: "sitecopy",
      description:
        "Hero note lines. Each entry is a line; the break is editorial, not HTML.",
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "manifesto",
      title: "Manifesto",
      type: "text",
      rows: 4,
      fieldset: "sitecopy",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "team",
      title: "Team",
      type: "object",
      fieldset: "sitecopy",
      fields: [
        defineField({
          name: "titleLines",
          title: "Title lines",
          type: "array",
          of: [{ type: "string" }],
          validation: (rule) => rule.required().min(1),
        }),
        defineField({
          name: "body",
          type: "text",
          rows: 4,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "ctaLabel",
          title: "CTA label",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "ctaHref",
          title: "CTA href",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "preloader",
      title: "Preloader",
      type: "object",
      fieldset: "sitecopy",
      fields: [
        defineField({
          name: "locationLine",
          title: "Location line",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "disciplineLine",
          title: "Discipline line",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "notFound",
      title: "404",
      type: "object",
      fieldset: "sitecopy",
      fields: [
        defineField({
          name: "title",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "body",
          type: "text",
          rows: 3,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "linkLabel",
          title: "Link label",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "faq",
      title: "FAQ",
      type: "object",
      fieldset: "faq",
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
      fieldset: "process",
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

export const marquee = defineType({
  name: "marquee",
  title: "Marquee",
  type: "document",
  fields: [
    defineField({
      name: "copy",
      title: "Copy",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "enabled",
      title: "Enabled",
      type: "boolean",
      description: "Show the availability ticker.",
      initialValue: false,
    }),
  ],
  preview: {
    prepare: () => ({ title: "Marquee" }),
  },
});

export const social = defineType({
  name: "social",
  title: "Social",
  type: "document",
  fields: [
    defineField({
      name: "email",
      title: "Email",
      type: "string",
      validation: (rule) => rule.required().email(),
    }),
    defineField({
      name: "instagram",
      title: "Instagram",
      type: "url",
      validation: (rule) => rule.required().uri({ scheme: ["https"] }),
    }),
    defineField({
      name: "discoveryCall",
      title: "Discovery call",
      type: "url",
      validation: (rule) => rule.required().uri({ scheme: ["https"] }),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Social" }),
  },
});

export const footer = defineType({
  name: "footer",
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

export const about = defineType({
  name: "about",
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
