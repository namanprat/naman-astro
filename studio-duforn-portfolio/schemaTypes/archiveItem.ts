import { defineField, defineType } from "sanity";
import { VIDEO_ACCEPT } from "./constants";

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
    }),
    defineField({
      name: "video",
      title: "Video (WebM)",
      description: "Use this instead of the image for motion tiles.",
      type: "file",
      options: { accept: VIDEO_ACCEPT },
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
    select: {
      title: "title",
      media: "image",
      video: "video.asset.originalFilename",
      order: "order",
    },
    prepare: ({ title, media, video, order }) => ({
      title,
      subtitle: video
        ? `WebM${typeof order === "number" ? ` · ${order}` : ""}`
        : typeof order === "number"
          ? `Order ${order}`
          : undefined,
      media,
    }),
  },
});
