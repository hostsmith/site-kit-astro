// Field types and helpers for the content schemas.
//
// The kit's schemas (src/kit-content.ts) and the site's own schemas
// (src/site.schema.ts in the site) both build on these. Sites import them as
// "@hostsmith/site-kit-astro/schema". The generic helpers are the core's
// (core/schema.ts), and the kit's own are below.
import { z } from "astro/zod";
import { CONTENT_ICONS } from "./icons.ts";
import { siteIcons } from "./site-icons.ts";

export { isoDate, itemList, labeledLink, link, mediaPath, requireAlt } from "../core/schema.ts";

// An icon from the kit's icon set (site-kit-design-system design D37) or the
// site's own, in src/icons/ (site-kit-webflow-example design D107), by name.
// An unknown name fails with the allowed names.
export const icon = z.enum([...CONTENT_ICONS, ...siteIcons.map((siteIcon) => siteIcon.name)]);

// The entrance animations a section entry, or an element of the site's own
// markup, may ask for with `reveal` (site-kit-webflow-example design D104). The
// kit marks the element, and the theme animates it.
export const REVEAL_PRESETS = ["fade", "fade-up", "fade-down", "slide-left", "slide-right", "scale"] as const;

// A section type's schema. The record key, the `type` literal and the
// component's file name are the same kebab-case name (design D2). Every
// section may set `reveal`, which sectionFields() puts on its root.
export function section<const T extends string, S extends z.core.$ZodLooseShape>(type: T, props: S) {
  // The id format and per-page uniqueness are checked on the whole list.
  return z.strictObject({ id: z.string(), type: z.literal(type), reveal: z.enum(REVEAL_PRESETS).optional(), ...props });
}

// An interface string the site declares in `siteUi`, in src/site.schema.ts
// (site-kit-locales design D46): a label its own templates show, such as
// "Keep reading", whose text lives in the settings' `ui`.
//
//   keepReading: uiString(),
//   minRead: uiString({ params: ["minutes"], plural: "minutes" }),
//
// `params` are the placeholders that site code fills, such as {minutes}.
// `plural` names the parameter whose number picks a plural form: the value is
// then an object of CLDR plural forms (one, few, other...).
export type UiString = { params: readonly string[]; plural?: string };

const UI_NAME = /^[a-z][a-zA-Z0-9]*$/;

export function uiString({ params = [], plural }: { params?: readonly string[]; plural?: string } = {}): UiString {
  for (const name of params) {
    if (!UI_NAME.test(name)) throw new Error(`Interface string parameter "${name}" must start with a lowercase letter, then letters or digits.`);
  }
  if (plural !== undefined && !params.includes(plural)) {
    throw new Error(`Interface string plural "${plural}" must be one of its params (${params.join(", ") || "none"}).`);
  }
  return { params, plural };
}
