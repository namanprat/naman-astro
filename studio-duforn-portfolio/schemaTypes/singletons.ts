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
  title: "Site",
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
      fields: [
        defineField({
          name: "locationLine",
          type: "string",
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "disciplineLine",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "notFound",
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
          rows: 3,
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: "linkLabel",
          type: "string",
          validation: (rule) => rule.required(),
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "workViews",
      type: "array",
      of: [viewItem],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "archiveViews",
      type: "array",
      of: [viewItem],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Site" }),
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

const overlayItem = defineArrayMember({
  type: "object",
  fields: [
    defineField({
      name: "label",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({ name: "path", type: "string" }),
    defineField({
      name: "action",
      type: "string",
      options: { list: [{ title: "Theme", value: "theme" }] },
    }),
  ],
  preview: {
    select: { title: "label", subtitle: "path" },
  },
});

export const navSettings = defineType({
  name: "navSettings",
  title: "Nav",
  type: "document",
  fields: [
    defineField({
      name: "availabilityLine",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "availabilityCopies",
      type: "number",
      validation: (rule) => rule.required().integer().positive(),
    }),
    defineField({
      name: "email",
      type: "string",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "stacks",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "col",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "links",
              type: "array",
              of: [
                defineArrayMember({
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
                    defineField({
                      name: "id",
                      type: "string",
                      validation: (rule) => rule.required(),
                    }),
                  ],
                  preview: { select: { title: "label", subtitle: "path" } },
                }),
              ],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: { select: { title: "col" } },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "socials",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "label",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "href",
              type: "string",
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: "newTab",
              type: "boolean",
              initialValue: false,
            }),
          ],
          preview: { select: { title: "label", subtitle: "href" } },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "overlayColumns",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          fields: [
            defineField({
              name: "items",
              type: "array",
              of: [overlayItem],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: { items: "items" },
            prepare: ({ items }) => ({
              title: Array.isArray(items)
                ? items.map((item: { label?: string }) => item.label).join(" / ")
                : "Column",
            }),
          },
        }),
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: "sectionIds",
      type: "array",
      of: [{ type: "string" }],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare: () => ({ title: "Nav" }),
  },
});
