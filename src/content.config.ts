// Content collections, written by hand in v0.
//
// public/admin/config.yml (Decap) is the schema source. Every field change
// goes into both files in the same commit. Every object is strict, so a key
// that this file doesn't define fails the build.
//
// `defineCollection` is imported from "astro/content/config" rather than
// "astro:content" so that the kit's tests can import this file in plain Node.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { formatPath, type PathPart } from "./lib/field.ts";
import { siteConfig, type CollectionName } from "./site.config.ts";

// ---------------------------------------------------------------------------
// Field types
// ---------------------------------------------------------------------------

// Media lives under public/assets/ and is referenced by its public path.
const mediaPath = z
  .string()
  .regex(/^\/assets\/\S+$/, { error: "must be a media path starting with /assets/" })
  .refine((path) => existsSync(join(process.cwd(), "public", path)), {
    error: (issue) => `media file public${String(issue.input)} doesn't exist`,
  });

// Dates are quoted ISO 8601 strings, so YAML never turns them into objects.
const dateError = 'must be a quoted ISO 8601 date, such as "2026-10-01"';
const isoDate = z
  .string({ error: dateError })
  .regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/, { error: dateError });

// Internal links use the no-trailing-slash form, as on Webflow.
const link = z.string().superRefine((value, ctx) => {
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
function requireAlt(imageKey: string, altKey: string) {
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

const navItem = z.strictObject({ label: z.string().min(1), link });

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

// A section type's schema. The record key, the `type` literal and the
// component's file name are the same kebab-case name (design D2).
function section<const T extends string, S extends z.core.$ZodLooseShape>(type: T, props: S) {
  // The id format and per-page uniqueness are checked on the whole list.
  return z.strictObject({ id: z.string(), type: z.literal(type), ...props });
}

// The section registry: library types, then site-local types. A site-local
// type is added here, as a Decap type in config.yml, and as a component in
// src/components/sections/site/<type>.astro.
export const sectionSchemas = {
  hero: section("hero", {
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    image: mediaPath.optional(),
    imageAlt: z.string().min(1).optional(),
    cta: z.strictObject({ label: z.string().min(1), link }).optional(),
    variant: z.enum(["centered", "image-left", "image-right", "background"]).default("centered"),
  })
    .superRefine(requireAlt("image", "imageAlt"))
    .superRefine((hero, ctx) => {
      if (hero.variant !== "centered" && hero.image === undefined) {
        ctx.addIssue({ code: "custom", path: ["image"], message: `variant "${hero.variant}" needs an image` });
      }
    }),

  "rich-text": section("rich-text", {
    title: z.string().min(1).optional(),
    body: z.string().min(1),
    variant: z.enum(["narrow", "wide"]).default("narrow"),
  }),

  "collection-list": section("collection-list", {
    title: z.string().min(1).optional(),
    // Parsed as { name }: Astro reads any object with string `id` and
    // `collection` keys as a content reference, and a section has an id.
    collection: z
      .enum(Object.keys(siteConfig.collections) as [CollectionName, ...CollectionName[]])
      .transform((name) => ({ name })),
    limit: z.int().positive().optional(),
    variant: z.enum(["cards", "list"]).default("cards"),
  }),
};

export type SectionType = keyof typeof sectionSchemas;
type SectionSchema = (typeof sectionSchemas)[SectionType];
export type Section = z.output<SectionSchema>;

// 4 characters: a lowercase letter, then 3 lowercase letters or digits, with
// at least one digit (design D3). `npm run section-id -- <page file>` makes one.
export const SECTION_ID = /^[a-z](?=[a-z0-9]*[0-9])[a-z0-9]{3}$/;

const sectionUnion = z.discriminatedUnion("type", Object.values(sectionSchemas) as [SectionSchema, ...SectionSchema[]]);

// Checks each section on its own first, so errors name the section id, its
// type and the prop. The typed union then parses the checked list.
export const sectionList = z.array(z.unknown()).superRefine(checkSections).pipe(z.array(sectionUnion));

function checkSections(items: unknown[], ctx: z.RefinementCtx<unknown[]>) {
  const seen = new Map<string, number>();
  items.forEach((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      ctx.addIssue({ code: "custom", path: [index], message: `section ${index + 1} must be an object with an id, a type and props` });
      return;
    }
    const { id, type } = item as Record<string, unknown>;
    const label = typeof id === "string" && id !== "" ? `section "${id}"` : `section ${index + 1}`;
    const getId = 'Run "npm run section-id -- <page file>" to get one.';

    if (id === undefined) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: `${label} has no id. ${getId}` });
    } else if (typeof id !== "string" || !SECTION_ID.test(id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `${label}: invalid section id ${JSON.stringify(id)}. An id is a lowercase letter, then 3 lowercase letters or digits, with at least one digit. ${getId}`,
      });
    } else if (seen.has(id)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "id"],
        message: `duplicate section id "${id}" (sections ${seen.get(id)! + 1} and ${index + 1}). Ids are unique per page. ${getId}`,
      });
    } else {
      seen.set(id, index);
    }

    if (typeof type !== "string" || !Object.hasOwn(sectionSchemas, type)) {
      ctx.addIssue({
        code: "custom",
        path: [index, "type"],
        message: `${label}: unknown section type ${JSON.stringify(type)}. Registered types: ${Object.keys(sectionSchemas).join(", ")}.`,
      });
      return;
    }
    const result = sectionSchemas[type as SectionType].safeParse(item);
    if (result.success) return;
    for (const issue of result.error.issues) {
      if (issue.path[0] === "id") continue;
      ctx.addIssue({ code: "custom", path: [index, ...issue.path], message: `${label} (${type}): ${describeIssue(issue, item)}` });
    }
  });
}

// Turns a Zod issue into a message that names the prop.
export function describeIssue(issue: z.core.$ZodIssue, value: unknown): string {
  const path = formatPath(issue.path as PathPart[]);
  switch (issue.code) {
    case "unrecognized_keys":
      return issue.keys.map((key) => `unknown prop "${formatPath([...(issue.path as PathPart[]), key])}"`).join(", ");
    case "invalid_type":
      return valueAt(value, issue.path) === undefined
        ? `missing required prop "${path}"`
        : `prop "${path}" must be ${issue.expected === "array" ? "a list" : `a ${issue.expected}`}`;
    case "invalid_value":
      return `prop "${path}" has the value ${JSON.stringify(valueAt(value, issue.path))}, expected one of ${issue.values
        .map((v) => JSON.stringify(v))
        .join(", ")}`;
    case "custom":
      return issue.message;
    default:
      return `prop "${path}": ${issue.message}`;
  }
}

function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  let current = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<PropertyKey, unknown>)[key];
  }
  return current;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

// Fields every page has. A `template: custom` page adds its own props, which
// its hand-written page declares (src/lib/custom-page.ts).
export const pageFields = {
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  ogImage: mediaPath.optional(),
};
const PAGE_KEYS = ["title", "description", "ogImage", "template", "sections"];

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z
    .looseObject({
      ...pageFields,
      template: z.literal("custom").optional(),
      sections: sectionList.optional(),
    })
    .superRefine((page, ctx) => {
      if (page.template === "custom") return;
      for (const key of Object.keys(page)) {
        if (!PAGE_KEYS.includes(key)) {
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: `unknown frontmatter key "${key}". A page has ${PAGE_KEYS.join(", ")}. Content goes in sections.`,
          });
        }
      }
      if (page.sections === undefined) {
        ctx.addIssue({ code: "custom", path: ["sections"], message: 'missing "sections". The list may be empty.' });
      }
    }),
});

const settings = defineCollection({
  loader: glob({ pattern: "site.yml", base: "./src/content/settings" }),
  schema: z.strictObject({
    name: z.string().min(1),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { error: 'must be a BCP 47 language tag, such as "en" or "et"' }),
    logo: z.strictObject({ image: mediaPath, alt: z.string().min(1) }).optional(),
    nav: z.array(navItem),
    footer: z.strictObject({ text: z.string().min(1).optional(), links: z.array(navItem).optional() }),
    contact: z
      .strictObject({ email: z.email().optional(), phone: z.string().min(1).optional(), address: z.string().min(1).optional() })
      .optional(),
    social: z.array(z.strictObject({ label: z.string().min(1), url: z.url({ protocol: /^https?$/ }) })).optional(),
    seo: z.strictObject({ description: z.string().min(1), ogImage: mediaPath.optional() }),
    // Interface strings the layout and sections show, in the site's language.
    ui: z.strictObject({ skipLink: z.string().min(1), menu: z.string().min(1), readMore: z.string().min(1) }),
  }),
});

const news = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/news" }),
  schema: z
    .strictObject({
      title: z.string().min(1),
      date: isoDate,
      description: z.string().min(1).optional(),
      image: mediaPath.optional(),
      imageAlt: z.string().min(1).optional(),
      draft: z.boolean().optional(),
    })
    .superRefine(requireAlt("image", "imageAlt")),
});

export const collections = { pages, settings, news };
