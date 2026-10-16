// Field types and helpers for the content schemas.
//
// The kit's schemas (src/kit-content.ts) and the site's own schemas
// (src/site.schema.ts in the site) both build on these. Sites import them as
// "@hostsmith/site-kit-astro/schema".
import { existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "astro/zod";

// Media lives under public/assets/ and is referenced by its public path.
export const mediaPath = z
  .string()
  .regex(/^\/assets\/\S+$/, { error: "must be a media path starting with /assets/" })
  .refine((path) => existsSync(join(process.cwd(), "public", path)), {
    error: (issue) => `media file public${String(issue.input)} doesn't exist`,
  });

// Dates are quoted ISO 8601 strings, so YAML never turns them into objects.
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
