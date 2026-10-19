// Field types and helpers for the content schemas.
//
// The kit's schemas (src/kit-content.ts) and the site's own schemas
// (src/site.schema.ts in the site) both build on these. Sites import them as
// "@hostsmith/site-kit-astro/schema".
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "astro/zod";
import { CONTENT_ICONS } from "./icons.ts";

// Media lives under public/assets/ and is referenced by its public path.
export const mediaPath = z
  .string()
  .regex(/^\/assets\/\S+$/, { error: "must be a media path starting with /assets/" })
  .refine((path) => existsSync(join(process.cwd(), "public", path)), {
    error: (issue) => `media file public${String(issue.input)} doesn't exist`,
  });

// Dates are quoted ISO 8601 strings, so YAML never turns them into objects.
// An unquoted date, which a CMS may write, is read back as its ISO text
// before this checks it (lib/cms-values.ts).
const dateError = 'must be a quoted ISO 8601 date, such as "2026-10-01"';
export const isoDate = z
  .string({ error: dateError })
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/, { error: dateError });

// Internal links use the no-trailing-slash form, as on Webflow.
export const link = z.string().superRefine((value, ctx) => {
  if (!/^(\/|#|https?:\/\/|mailto:|tel:)/.test(value)) {
    ctx.addIssue({
      code: "custom",
      message: `link "${value}" must start with "/", "#", "https://", "http://", "mailto:" or "tel:"`,
    });
    return;
  }
  const path = value.split(/[?#]/)[0];
  if (value.startsWith("/") && path.length > 1 && path.endsWith("/")) {
    ctx.addIssue({ code: "custom", message: `link "${value}" ends with "/". Internal links have no trailing slash.` });
  }
});

// An icon from the kit's icon set, by name (site-kit-design-system design
// D37). An unknown name fails with the allowed names.
export const icon = z.enum(CONTENT_ICONS);

// Every image prop is paired with alt text.
export function requireAlt(imageKey: string, altKey: string) {
  return (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    if (value[imageKey] !== undefined && !value[altKey]) {
      ctx.addIssue({
        code: "custom",
        path: [altKey],
        message: `image "${String(value[imageKey])}" has no alt text. Set "${altKey}".`,
      });
    }
  };
}

// A button or a text link: what it says and where it goes.
export const labeledLink = z.strictObject({ label: z.string().min(1), link });

// A list prop of a section, such as `items`, has at least one item.
export const itemList = <T extends z.ZodType>(item: T) => z.array(item).min(1, { error: "needs at least one item" });

// A section type's schema. The record key, the `type` literal and the
// component's file name are the same kebab-case name (design D2).
export function section<const T extends string, S extends z.core.$ZodLooseShape>(type: T, props: S) {
  // The id format and per-page uniqueness are checked on the whole list.
  return z.strictObject({ id: z.string(), type: z.literal(type), ...props });
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
