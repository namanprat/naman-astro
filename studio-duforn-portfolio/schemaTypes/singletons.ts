import { defineArrayMember, defineField, defineType } from "sanity";
import { WORK_SERVICES } from "./constants";

const viewItem = defineArrayMember({
  type: "object",
  fields: [
    defineField({ name: "id", type: "string", validation: (rule) => rule.required() }),
    defineField({ name: "label", type: "string", validation: (rule) => rule.required() }),
  ],
  preview: {
    select: { title: "label", subtitle: "id" },
  },
});

export const siteSettings = defineType({
  name: "siteSettings",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({
      name: "heroNote",
      type: "array",
      of: [{ type: "string" }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "manifesto",
      type: "text",
      rows: 4,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "team",
      type: "object",
      fields: [
        defineField({
          name: "titleLines",
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
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "ctaHref",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "footerTagline",
      type: "text",
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "preloader",
      type: "object",
      hidden: true,
      fields: [
        defineField({ name: "locationLine", type: "string" }),
        defineField({ name: "disciplineLine", type: "string" }),
      ],
    }),
    defineField({
      name: "notFound",
      type: "object",
      hidden: true,
      fields: [
        defineField({ name: "title", type: "string" }),
        defineField({ name: "body", type: "text", rows: 3 }),
        defineField({ name: "linkLabel", type: "string" }),
      ],
    }),
    defineField({
      name: "workViews",
      type: "array",
      of: [viewItem],
      hidden: true,
    }),
    defineField({
      name: "archiveViews",
      type: "array",
      of: [viewItem],
      hidden: true,
    }),
  ],
  preview: {
    prepare: () => ({ title: "Homepage" }),
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

export const faqSettings = defineType({
  name: "faqSettings",
  title: "FAQ",
  type: "document",
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
      of: [
        defineArrayMember({
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
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare: () => ({ title: "FAQ" }),
  },
});

export const processSettings = defineType({
  name: "processSettings",
  title: "Process",
  type: "document",
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
      of: [
        defineArrayMember({
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
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Process" }),
  },
});

/** Stored on production `nav` from the old full-nav schema. Named types match `_type`. */
export const overlayLink = defineType({
  name: "overlayLink",
  title: "Overlay link",
  type: "object",
  fields: [
    defineField({ name: "label", type: "string" }),
    defineField({ name: "path", type: "string" }),
  ],
});

export const overlayAction = defineType({
  name: "overlayAction",
  title: "Overlay action",
  type: "object",
  fields: [defineField({ name: "label", type: "string" })],
});

export const overlayColumn = defineType({
  name: "overlayColumn",
  title: "Overlay column",
  type: "object",
  fields: [
    defineField({
      name: "items",
      type: "array",
      of: [{ type: "overlayLink" }, { type: "overlayAction" }],
    }),
  ],
});

export const navSettings = defineType({
  name: "navSettings",
  title: "Marquee",
  type: "document",
  fields: [
    defineField({
      name: "enabled",
      title: "Enable marquee",
      type: "boolean",
      description: "Turn the homepage availability ticker on or off.",
      initialValue: false,
    }),
    defineField({
      name: "availabilityLine",
      title: "Availability line",
      type: "string",
      description: "Text shown in the ticker when the marquee is enabled.",
      validation: (rule) =>
        rule.custom((value, context) => {
          const enabled = Boolean(
            (context.parent as { enabled?: boolean } | undefined)?.enabled,
          );
          if (!enabled) return true;
          return value?.trim() ? true : "Required when the marquee is on";
        }),
    }),
    defineField({ name: "availabilityCopies", type: "number", hidden: true }),
    defineField({ name: "email", type: "string", hidden: true }),
    defineField({
      name: "sectionIds",
      type: "array",
      of: [{ type: "string" }],
      hidden: true,
    }),
    defineField({
      name: "socials",
      type: "array",
      hidden: true,
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "label", type: "string" }),
            defineField({ name: "href", type: "string" }),
            defineField({ name: "newTab", type: "boolean" }),
          ],
        },
      ],
    }),
    defineField({
      name: "stacks",
      type: "array",
      hidden: true,
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "col", type: "string" }),
            defineField({
              name: "links",
              type: "array",
              of: [
                {
                  type: "object",
                  fields: [
                    defineField({ name: "id", type: "string" }),
                    defineField({ name: "label", type: "string" }),
                    defineField({ name: "path", type: "string" }),
                  ],
                },
              ],
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "overlayColumns",
      type: "array",
      hidden: true,
      of: [{ type: "overlayColumn" }],
    }),
  ],
  preview: {
    select: { enabled: "enabled", line: "availabilityLine" },
    prepare: ({ enabled, line }) => ({
      title: "Marquee",
      subtitle: enabled ? line || "On" : "Off",
    }),
  },
});
