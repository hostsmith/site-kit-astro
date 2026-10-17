// Content collections: the kit's part, written by hand in v0, and
// defineKitContent(), which combines it with the site's part.
//
// decap/config.kit.yml (Decap) is the schema source for this file. Every field
// change goes into both files in the same commit. The site's own section types
// and collections are in the site's src/site.schema.ts. Every object is
// strict, so a key that the schemas don't define fails the build.
//
// This file doesn't read the site itself: src/content.ts passes the site's
// settings and schemas in. `defineCollection` is imported from
// "astro/content/config" rather than "astro:content", so the kit's tests can
// import this file in plain Node.
import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import type { SiteConfig } from "../index.ts";
import { FACT_NAME, factsFrom, hasPlaceholder, readFacts, withFacts } from "./lib/facts.ts";
import { formatPath, type PathPart } from "./lib/field.ts";
import { icon, itemList, labeledLink, link, mediaPath, requireAlt, section } from "./lib/schema.ts";

// What src/site.schema.ts exports.
export type SiteSchema = {
  siteSectionSchemas: Record<string, z.ZodObject>;
  siteCollections: Record<string, unknown>;
};

const navItem = z.strictObject({ label: z.string().min(1), link });

// Figures with a label, such as { value: "500+", label: "Projects completed" },
// at most four: `stats` and `split` set the minimum.
const statList = z
  .array(z.strictObject({ value: z.string().min(1), label: z.string().min(1) }))
  .max(4, { error: "has at most 4 items" });

// ---------------------------------------------------------------------------
// Section types
// ---------------------------------------------------------------------------

// The library section types. Site-local types are in src/site.schema.ts.
// `collection-list` offers the site's collections.
const librarySectionSchemas = (collectionNames: [string, ...string[]]) => ({
  hero: section("hero", {
    // A short label above the title, such as "About us".
    eyebrow: z.string().min(1).optional(),
    // A short highlight above the title, such as "Serving Springfield since 1998".
    badge: z.string().min(1).optional(),
    title: z.string().min(1),
    subtitle: z.string().min(1).optional(),
    image: mediaPath.optional(),
    imageAlt: z.string().min(1).optional(),
    cta: labeledLink.optional(),
    secondaryCta: labeledLink.optional(),
    // A short line under the buttons, such as "Typical projects from $4,800".
    note: z.string().min(1).optional(),
    variant: z.enum(["centered", "image-left", "image-right", "background", "page"]).default("centered"),
  })
    .superRefine(requireAlt("image", "imageAlt"))
    .superRefine((hero, ctx) => {
      if (hero.variant !== "centered" && hero.variant !== "page" && hero.image === undefined) {
        ctx.addIssue({ code: "custom", path: ["image"], message: `variant "${hero.variant}" needs an image` });
      }
    }),

  "rich-text": section("rich-text", {
    title: z.string().min(1).optional(),
    body: z.string().min(1),
    // title-aside: the title beside the body, stacked on narrow screens.
    variant: z.enum(["narrow", "wide", "title-aside"]).default("narrow"),
  }),

  "collection-list": section("collection-list", {
    title: z.string().min(1).optional(),
    // Parsed as { name }: Astro reads any object with string `id` and
    // `collection` keys as a content reference, and a section has an id.
    collection: z.enum(collectionNames).transform((name) => ({ name })),
    limit: z.int().positive().optional(),
    // A link beside the title, such as "All articles".
    link: labeledLink.optional(),
    variant: z.enum(["cards", "list", "featured"]).default("cards"),
  }),

  "services-grid": section("services-grid", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    // A link beside the title, such as "All services".
    link: labeledLink.optional(),
    items: itemList(
      z
        .strictObject({
          title: z.string().min(1),
          text: z.string().min(1).optional(),
          icon: icon.optional(),
          image: mediaPath.optional(),
          imageAlt: z.string().min(1).optional(),
          // The item's title links here.
          link: link.optional(),
        })
        .superRefine(requireAlt("image", "imageAlt")),
    ),
    variant: z.enum(["cards", "list"]).default("cards"),
    tone: z.enum(["plain", "surface"]).default("plain"),
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
    tone: z.enum(["surface", "dark"]).default("surface"),
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
    tone: z.enum(["accent", "dark", "surface"]).default("accent"),
  }),

  // One layout, so no variant. Links to a map and never embeds one: an embed
  // loads the provider's scripts and sends visitor data to it.
  "hours-location": section("hours-location", {
    title: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
    hours: itemList(z.strictObject({ days: z.string().min(1), time: z.string().min(1) })).optional(),
    // Shown as tel: and mailto: links.
    phone: z.string().min(1).optional(),
    email: z.email().optional(),
    note: z.string().min(1).optional(),
    mapLink: labeledLink.optional(),
  }).superRefine((value, ctx) => {
    if ([value.address, value.hours, value.phone, value.email].every((prop) => prop === undefined)) {
      ctx.addIssue({ code: "custom", path: ["address"], message: 'needs an "address", "hours", "phone" or "email"' });
    }
  }),

  // Short trust signals in a row, such as "Licensed & insured", or as chips.
  "trust-bar": section("trust-bar", {
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ text: z.string().min(1) })),
    variant: z.enum(["line", "chips"]).default("line"),
  }),

  // Two to four figures, such as "500+ projects completed".
  stats: section("stats", {
    title: z.string().min(1).optional(),
    items: statList.min(2, { error: "needs at least 2 items" }),
    tone: z.enum(["plain", "dark"]).default("plain"),
  }),

  // Numbered steps, such as a process or what's included. The theme draws the numbers.
  steps: section("steps", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    items: itemList(z.strictObject({ title: z.string().min(1), text: z.string().min(1).optional() })),
  }),

  // An image beside text, with optional stats and a link. The image comes
  // first in reading order; the variant tells the theme its side.
  split: section("split", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    image: mediaPath,
    imageAlt: z.string().min(1).optional(),
    stats: statList.min(1, { error: "needs at least 1 item" }).optional(),
    link: labeledLink.optional(),
    variant: z.enum(["image-left", "image-right"]).default("image-left"),
    tone: z.enum(["plain", "surface"]).default("plain"),
  }).superRefine(requireAlt("image", "imageAlt")),

  // The people behind the business. A member without a photo gets a placeholder.
  team: section("team", {
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    items: itemList(
      z
        .strictObject({
          name: z.string().min(1),
          role: z.string().min(1).optional(),
          image: mediaPath.optional(),
          imageAlt: z.string().min(1).optional(),
        })
        .superRefine(requireAlt("image", "imageAlt")),
    ),
  }),

  // Prices as the site writes them, such as "from $4,800".
  "pricing-list": section("pricing-list", {
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ label: z.string().min(1), price: z.string().min(1) })),
    note: z.string().min(1).optional(),
  }),
});

type LibrarySectionSchemas = ReturnType<typeof librarySectionSchemas>;
type SectionSchema = z.ZodObject;

// A section entry: a library type, or a site-local type whose props only the
// site's schema knows.
export type Section = z.output<LibrarySectionSchemas[keyof LibrarySectionSchemas]> | ({ id: string; type: string } & Record<string, unknown>);

// 4 characters: a lowercase letter, then 3 lowercase letters or digits, with
// at least one digit (design D3). `npm run section-id -- <page file>` makes one.
export const SECTION_ID = /^[a-z](?=[a-z0-9]*[0-9])[a-z0-9]{3}$/;

// The kit's section types and collections, combined with the site's.
export function defineKitContent(siteConfig: SiteConfig, { siteSectionSchemas, siteCollections }: SiteSchema) {
  const library = librarySectionSchemas(Object.keys(siteConfig.collections) as [string, ...string[]]);
  for (const type of Object.keys(siteSectionSchemas)) {
    if (Object.hasOwn(library, type)) {
      throw new Error(`Site-local section type "${type}" in src/site.schema.ts has the same name as a library type. Rename it.`);
    }
  }
  for (const name of Object.keys(siteCollections)) {
    if (name === "pages" || name === "settings") {
      throw new Error(`Collection "${name}" in src/site.schema.ts has the name of a kit collection. Rename it.`);
    }
  }

  // The section registry: library types, then site-local types.
  const sectionSchemas: Record<string, SectionSchema> = { ...library, ...siteSectionSchemas };
  const sectionUnion = z.discriminatedUnion("type", Object.values(sectionSchemas) as [SectionSchema, ...SectionSchema[]]);

  // Checks each section on its own first, so errors name the section id, its
  // type and the prop. The typed union then parses the checked list.
  const sectionList = z.array(z.unknown()).superRefine(checkSections(sectionSchemas)).pipe(z.array(sectionUnion));

  return {
    sectionSchemas,
    // True for a type defined in src/site.schema.ts.
    isSiteSectionType: (type: string) => Object.hasOwn(siteSectionSchemas, type),
    collections: {
      pages: pagesCollection(sectionList),
      settings,
      ...Object.fromEntries(Object.entries(siteCollections).map(([name, collection]) => [name, withCollectionFacts(collection)])),
    },
  };
}

const checkSections = (sectionSchemas: Record<string, SectionSchema>) => (items: unknown[], ctx: z.RefinementCtx<unknown[]>) => {
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
    const result = sectionSchemas[type].safeParse(item);
    if (result.success) return;
    for (const issue of result.error.issues) {
      if (issue.path[0] === "id") continue;
      ctx.addIssue({ code: "custom", path: [index, ...issue.path], message: `${label} (${type}): ${describeIssue(issue, item)}` });
    }
  });
};

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

const pagesCollection = (sectionList: z.ZodType<Section[]>) =>
  defineCollection({
    loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
    // Facts are filled first, so sections validate their filled values.
    schema: withFacts(
      z
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
      () => readFacts(),
    ),
  });

// A site collection whose frontmatter is filled with facts before its own
// schema validates it. A schema may be a function of Astro's schema context.
function withCollectionFacts(collection: unknown): unknown {
  const config = collection as { schema?: unknown };
  const { schema } = config;
  if (typeof schema === "function") {
    return { ...config, schema: (context: unknown) => withFacts((schema as (context: unknown) => z.ZodType)(context), () => readFacts()) };
  }
  if (schema instanceof z.ZodType) return { ...config, schema: withFacts(schema, () => readFacts()) };
  return collection;
}

// ---------------------------------------------------------------------------
// Header and footer blocks
// ---------------------------------------------------------------------------

// Small typed components that the layout renders in the header and footer,
// composed in settings like a page's sections (site-kit-design-system design
// D35). The kit's settings hold no business facts: a phone number, an
// address or opening hours are props of the block that shows them.
const block = <const T extends string, S extends z.core.$ZodLooseShape>(type: T, props: S) =>
  z.strictObject({ type: z.literal(type), ...props });

// The header's actions, after the nav in the menu.
const headerActionSchemas = {
  // A tel: link with the number. With callLabel, also an icon-only call
  // button outside the menu, named "<callLabel> <number>".
  phone: block("phone", { number: z.string().min(1), callLabel: z.string().min(1).optional() }),
  button: block("button", { label: z.string().min(1), link, style: z.enum(["primary", "secondary"]).default("primary") }),
  link: block("link", { label: z.string().min(1), link }),
};

// Each block in footer.blocks starts a group, such as a column, unless it
// sets withPrevious. footer.bottom, the last row, has no groups.
const footerFields = {
  title: z.string().min(1).optional(),
  withPrevious: z.boolean().optional(),
};
const footerBlockSchemas = {
  // The site's logo or name, with a line of text.
  brand: block("brand", { text: z.string().min(1).optional(), withPrevious: footerFields.withPrevious }),
  contact: block("contact", {
    ...footerFields,
    address: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    email: z.email().optional(),
  }).superRefine((value, ctx) => {
    if (value.address === undefined && value.phone === undefined && value.email === undefined) {
      ctx.addIssue({ code: "custom", path: ["address"], message: 'needs an "address", "phone" or "email"' });
    }
  }),
  // A nav, named by its title, or by ui.footerNav without one.
  links: block("links", { ...footerFields, links: z.array(navItem).min(1, { error: "needs at least one link" }) }),
  // Rows such as opening hours: "Mon-Fri", "7:30 AM - 5:00 PM".
  hours: block("hours", { ...footerFields, rows: itemList(z.strictObject({ days: z.string().min(1), time: z.string().min(1) })) }),
  text: block("text", { ...footerFields, text: z.string().min(1) }),
  // "© <year> <text>", or the site's name without text.
  copyright: block("copyright", { text: z.string().min(1).optional(), withPrevious: footerFields.withPrevious }),
};

type HeaderActionSchemas = typeof headerActionSchemas;
type FooterBlockSchemas = typeof footerBlockSchemas;
export type HeaderAction = z.output<HeaderActionSchemas[keyof HeaderActionSchemas]>;
export type FooterBlock = z.output<FooterBlockSchemas[keyof FooterBlockSchemas]>;

// A list of blocks, checked one by one first, so errors name the block, its
// type and the prop, like sections.
function blockList<S extends Record<string, z.ZodObject>>(schemas: S, kind: string) {
  const union = z.discriminatedUnion("type", Object.values(schemas) as [S[keyof S], ...S[keyof S][]]);
  return z
    .array(z.unknown())
    .superRefine((items, ctx) => {
      items.forEach((item, index) => {
        const label = `${kind} ${index + 1}`;
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          ctx.addIssue({ code: "custom", path: [index], message: `${label} must be an object with a type and props` });
          return;
        }
        const { type } = item as Record<string, unknown>;
        if (typeof type !== "string" || !Object.hasOwn(schemas, type)) {
          ctx.addIssue({
            code: "custom",
            path: [index, "type"],
            message: `${label}: unknown type ${JSON.stringify(type)}. ${kind[0].toUpperCase()}${kind.slice(1)} types: ${Object.keys(schemas).join(", ")}.`,
          });
          return;
        }
        const result = schemas[type].safeParse(item);
        if (result.success) return;
        for (const issue of result.error.issues) {
          ctx.addIssue({ code: "custom", path: [index, ...issue.path], message: `${label} (${type}): ${describeIssue(issue, item)}` });
        }
      });
    })
    .pipe(z.array(union));
}

const headerActions = blockList(headerActionSchemas, "header action").superRefine((actions, ctx) => {
  const calls = actions.flatMap((action, i) => (action.type === "phone" && action.callLabel ? [i] : []));
  if (calls.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: [calls[1], "callLabel"],
      message: `header action ${calls[1] + 1} (phone): only one phone action may set "callLabel", so the header has one call button`,
    });
  }
});

const footer = z
  .strictObject({ blocks: blockList(footerBlockSchemas, "footer block").optional(), bottom: blockList(footerBlockSchemas, "footer bottom block").optional() })
  .superRefine((value, ctx) => {
    value.bottom?.forEach((item, i) => {
      if (item.withPrevious === true) {
        ctx.addIssue({ code: "custom", path: ["bottom", i, "withPrevious"], message: `footer bottom block ${i + 1} (${item.type}): "withPrevious" groups footer.blocks only, and the bottom row has no groups` });
      }
    });
    // An untitled links block's nav takes ui.footerNav as its name, so only one may go without a title.
    const untitled = (["blocks", "bottom"] as const).flatMap((list) =>
      (value[list] ?? []).flatMap((item, i) => (item.type === "links" && item.title === undefined ? [{ list, i }] : [])),
    );
    if (untitled.length > 1) {
      const { list, i } = untitled[1];
      ctx.addIssue({
        code: "custom",
        path: [list, i, "title"],
        message: `footer ${list === "blocks" ? "block" : "bottom block"} ${i + 1} (links): a second "links" block without a title. Two navs would share the name ui.footerNav, so give it a "title".`,
      });
    }
  });

const settings = defineCollection({
  loader: glob({ pattern: "site.yml", base: "./src/content/settings" }),
  schema: withFacts(
    z.strictObject({
      name: z.string().min(1),
      language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { error: 'must be a BCP 47 language tag, such as "en" or "et"' }),
      logo: z.strictObject({ image: mediaPath, alt: z.string().min(1) }).optional(),
      nav: z.array(navItem),
      header: z.strictObject({ actions: headerActions.optional() }).optional(),
      footer: footer.optional(),
      seo: z.strictObject({ description: z.string().min(1), ogImage: mediaPath.optional() }),
      // The site's facts, such as { name: "phone", value: "(218) 555-0142" }.
      // Any text in the content writes one as "{phone}" (lib/facts.ts).
      facts: z
        .array(
          z.strictObject({
            name: z.string().regex(FACT_NAME, { error: 'must start with a lowercase letter, then letters or digits, such as "phone" or "licenseNo"' }),
            value: z.string().min(1).refine((value) => !hasPlaceholder(value), { error: "can't hold a placeholder: a fact's value is written out" }),
          }),
        )
        .superRefine((facts, ctx) => {
          const seen = new Set<string>();
          facts.forEach(({ name }, i) => {
            if (seen.has(name)) ctx.addIssue({ code: "custom", path: [i, "name"], message: `duplicate fact "${name}"` });
            seen.add(name);
          });
        })
        .optional(),
      // The interface strings of the kit's own parts, in the site's language.
      // They name what has no visible text, such as the navs and the menu
      // button, so all of them are required. A block's labels and titles are
      // its own props.
      ui: z.strictObject({
        skipLink: z.string().min(1),
        menu: z.string().min(1),
        readMore: z.string().min(1),
        mainNav: z.string().min(1),
        footerNav: z.string().min(1),
        breadcrumb: z.string().min(1),
        home: z.string().min(1),
      }),
    }),
    // The settings fill from their own facts, which stay as written.
    (input) => factsFrom((input as { facts?: unknown } | null)?.facts),
    ["facts"],
  ),
});
