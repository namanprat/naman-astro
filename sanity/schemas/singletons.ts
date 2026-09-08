import { defineArrayMember, defineField, defineType } from "sanity";
import { WORK_SERVICES } from "../../src/lib/content/services.ts";

export const faq = defineType({
  name: "faq",
  title: "FAQ",
  type: "document",
  fields: [
    defineField({ name: "statement", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "lead", type: "text", validation: (rule) => rule.required() }),
    defineField({
      name: "items",
      type: "array",
      of: [defineArrayMember({ type: "faqItem" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

export const process = defineType({
  name: "process",
  title: "Process",
  type: "document",
  fields: [
    defineField({ name: "statement", type: "text", validation: (rule) => rule.required() }),
    defineField({
      name: "cards",
      type: "array",
      of: [defineArrayMember({ type: "processCard" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

export const about = defineType({
  name: "about",
  title: "About",
  type: "document",
  fields: [
    defineField({ name: "lead", type: "text", validation: (rule) => rule.required() }),
    defineField({
      name: "clients",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "services",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { list: [...WORK_SERVICES] },
    }),
  ],
});

export const nav = defineType({
  name: "nav",
  title: "Nav",
  type: "document",
  fields: [
    defineField({ name: "availabilityLine", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "availabilityCopies",
      type: "number",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({ name: "email", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "stacks",
      type: "array",
      of: [defineArrayMember({ type: "navStack" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "socials",
      type: "array",
      of: [defineArrayMember({ type: "navSocial" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "overlayColumns",
      type: "array",
      of: [
        defineArrayMember({
          type: "array",
          of: [
            defineArrayMember({ type: "navOverlayLink" }),
            defineArrayMember({ type: "navOverlayAction" }),
          ],
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "sectionIds",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

export const site = defineType({
  name: "site",
  title: "Site copy",
  type: "document",
  fields: [
    defineField({
      name: "heroNote",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({ name: "manifesto", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "team", type: "siteTeam", validation: (rule) => rule.required() }),
    defineField({ name: "footerTagline", type: "text", validation: (rule) => rule.required() }),
    defineField({ name: "preloader", type: "sitePreloader", validation: (rule) => rule.required() }),
    defineField({ name: "notFound", type: "siteNotFound", validation: (rule) => rule.required() }),
    defineField({
      name: "workViews",
      type: "array",
      of: [defineArrayMember({ type: "viewItem" })],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "archiveViews",
      type: "array",
      of: [defineArrayMember({ type: "viewItem" })],
      validation: (rule) => rule.required().min(1),
    }),
  ],
});

export const archiveItem = defineType({
  name: "archiveItem",
  title: "Archive item",
  type: "document",
  fields: [
    defineField({
      name: "slug",
      type: "slug",
      options: { source: "src" },
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "src", type: "string", validation: (rule) => rule.required() }),
    defineField({
      name: "span",
      type: "string",
      options: { list: ["height", "width"] },
      initialValue: "height",
    }),
  ],
  preview: { select: { title: "src", subtitle: "span" } },
});
