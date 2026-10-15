// Content collections: the kit's part, written by hand in v0.
//
// public/admin/config.kit.yml (Decap) is the schema source for this file.
// Every field change goes into both files in the same commit. The site's own
// section types and collections are in src/site.schema.ts. Every object is
// strict, so a key that the schemas don't define fails the build.
//
// `defineCollection` is imported from "astro/content/config" rather than
// "astro:content" so that the kit's tests can import this file in plain Node.
import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { formatPath, type PathPart } from "./lib/field.ts";
import { itemList, labeledLink, link, mediaPath, requireAlt, section } from "./lib/schema.ts";
import { siteConfig, type CollectionName } from "./site.config.ts";
import { siteCollections, siteSectionSchemas } from "./site.schema.ts";

const navItem = z.strictObject({ label: z.string().min(1), link });

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

// The library section types. Site-local types are in src/site.schema.ts.
const librarySectionSchemas = {
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

  "services-grid": section("services-grid", {
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    items: itemList(
      z
        .strictObject({
          title: z.string().min(1),
          text: z.string().min(1).optional(),
          image: mediaPath.optional(),
          imageAlt: z.string().min(1).optional(),
          // The item's title links here.
          link: link.optional(),
        })
        .superRefine(requireAlt("image", "imageAlt")),
    ),
    variant: z.enum(["cards", "list"]).default("cards"),
  }),

  gallery: section("gallery", {
    title: z.string().min(1).optional(),
    images: itemList(
      z
        .strictObject({
          image: mediaPath,
          // Required: optional here only so the alt check names the image.
          alt: z.string().min(1).optional(),
          caption: z.string().min(1).optional(),
        })
        .superRefine(requireAlt("image", "alt")),
    ),
    variant: z.enum(["grid", "masonry"]).default("grid"),
  }),

  testimonials: section("testimonials", {
    title: z.string().min(1).optional(),
    items: itemList(
      z
        .strictObject({
          quote: z.string().min(1),
          name: z.string().min(1),
          role: z.string().min(1).optional(),
          image: mediaPath.optional(),
          imageAlt: z.string().min(1).optional(),
        })
        .superRefine(requireAlt("image", "imageAlt")),
    ),
    variant: z.enum(["grid", "single"]).default("grid"),
  }),

  // One layout, so no variant. Answers are markdown, rendered like rich-text.
  faq: section("faq", {
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ question: z.string().min(1), answer: z.string().min(1) })),
  }),

  cta: section("cta", {
    title: z.string().min(1),
    text: z.string().min(1).optional(),
    button: labeledLink,
    secondaryButton: labeledLink.optional(),
    variant: z.enum(["banner", "card"]).default("banner"),
  }),

  // One layout, so no variant. Links to a map and never embeds one: an embed
  // loads the provider's scripts and sends visitor data to it.
  "hours-location": section("hours-location", {
    title: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    hours: itemList(z.strictObject({ days: z.string().min(1), time: z.string().min(1) })).optional(),
    note: z.string().min(1).optional(),
    mapLink: labeledLink.optional(),
  }).superRefine((value, ctx) => {
    if (value.address === undefined && value.hours === undefined) {
      ctx.addIssue({ code: "custom", path: ["address"], message: 'needs an "address", "hours" or both' });
    }
  }),
};

for (const type of Object.keys(siteSectionSchemas)) {
  if (Object.hasOwn(librarySectionSchemas, type)) {
    throw new Error(`Site-local section type "${type}" in src/site.schema.ts has the same name as a library type. Rename it.`);
  }
}

// The section registry: library types, then site-local types.
export const sectionSchemas = { ...librarySectionSchemas, ...siteSectionSchemas };

// True for a type defined in src/site.schema.ts.
export function isSiteSectionType(type: string): boolean {
  return Object.hasOwn(siteSectionSchemas, type);
}

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
    case "custom": {
      // Names the list item, such as "images[2]", when the check ran on one.
      const last = issue.path.findLastIndex((part) => typeof part === "number");
      return last === -1 ? issue.message : `${formatPath(issue.path.slice(0, last + 1) as PathPart[])}: ${issue.message}`;
    }
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

for (const name of Object.keys(siteCollections)) {
  if (name === "pages" || name === "settings") {
    throw new Error(`Collection "${name}" in src/site.schema.ts has the name of a kit collection. Rename it.`);
  }
}

export const collections = { pages, settings, ...siteCollections };
