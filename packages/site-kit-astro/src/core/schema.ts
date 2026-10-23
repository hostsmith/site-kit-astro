// Field types and helpers for content schemas, in any site (site-kit-core-split
// design D70).
//
// The kit's schemas (src/kit-content.ts), a kit site's own schemas
// (src/site.schema.ts) and a core site's collections all build on these.
// Sites import them as "@hostsmith/site-kit-astro/schema", which adds the
// kit's own helpers (src/lib/schema.ts).
//
// A helper's CMS widget is Zod metadata, `x-widget`, which Astro writes into
// the collection's JSON Schema and the schema export reads (design D79). A
// site may set its own on any field, such as `.meta({ "x-widget": "text" })`.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "astro/zod";
import { isoText } from "./cms-values.ts";

// Media lives under public/assets/ and is referenced by its public path.
export const mediaPath = z
  .string()
  .regex(/^\/assets\/\S+$/, { error: "must be a media path starting with /assets/" })
  .refine((path) => existsSync(join(process.cwd(), "public", path)), {
    error: (issue) => `media file public${String(issue.input)} doesn't exist`,
  })
  .meta({ "x-widget": "image" });

// Dates are quoted ISO 8601 strings, so YAML never turns them into objects.
// An unquoted date, which a CMS may write, is read back as its ISO text
// before this checks it. The kit's collections do that for every value
// (core/cms-values.ts), and this does it for a core site's own. The JSON
// Schema keeps the string's pattern, since a preprocess step has none.
const dateError = 'must be a quoted ISO 8601 date, such as "2026-10-01"';
export const isoDate = z
  .preprocess(
    (value) => (value instanceof Date ? isoText(value) : value),
    z
      .string({ error: dateError })
      .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/, { error: dateError }),
  )
  .meta({ "x-widget": "datetime" });

// Internal links use the no-trailing-slash form, as on Webflow.
export const link = z
  .string()
  .superRefine((value, ctx) => {
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
  })
  .meta({ "x-widget": "link" });

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
