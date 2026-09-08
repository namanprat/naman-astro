/**
 * What the studio sells, tagged per project and listed on the About panel.
 *
 * ponytail: a file with no Astro import, because `sanity/schemas/` has to
 * read this list and the Studio's Vite cannot resolve `astro/zod`. One array,
 * two readers; the check in `tests/sanity-schema.check.ts` also asserts the
 * Studio field `list` equals this.
 */
export const WORK_SERVICES = [
  "Brand identity",
  "Website design",
  "Website development",
  "Motion design",
  "3D",
] as const;

export type WorkService = (typeof WORK_SERVICES)[number];
