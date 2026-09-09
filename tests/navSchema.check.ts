/**
 * Production `nav` still stores leftover full-nav fields. Studio must define
 * them (hidden) or the Marquee form shows "Unknown fields found".
 *   npm run test:unit
 */
import assert from "node:assert/strict";
import { schemaTypes } from "../studio-duforn-portfolio/schemaTypes/index.ts";

const nav = schemaTypes.find((type) => type.name === "navSettings");
assert.ok(nav, "navSettings must be registered");
assert.equal(nav.type, "document");

const fields =
  "fields" in nav && Array.isArray(nav.fields)
    ? nav.fields.map((field: { name?: string }) => field.name)
    : [];

for (const name of [
  "enabled",
  "availabilityLine",
  "email",
  "overlayColumns",
  "sectionIds",
  "socials",
  "stacks",
] as const) {
  assert.ok(fields.includes(name), `navSettings must define ${name}`);
}

const availability = (
  "fields" in nav && Array.isArray(nav.fields) ? nav.fields : []
).find((field: { name?: string }) => field.name === "availabilityLine") as
  | { hidden?: unknown }
  | undefined;
assert.equal(
  availability?.hidden,
  undefined,
  "availability line stays visible when the marquee is off",
);

for (const name of ["overlayColumn", "overlayLink", "overlayAction"] as const) {
  assert.ok(
    schemaTypes.some((type) => type.name === name),
    `${name} must be registered so leftover overlay data type-checks`,
  );
}

console.log("navSchema.check: leftover marquee fields are in schema");
