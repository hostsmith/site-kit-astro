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
import { EMBED_ASPECTS, videoSource } from "./lib/embed.ts";
import { FACT_NAME, factsFrom, hasPlaceholder, readFacts, withFacts } from "./lib/facts.ts";
import { formatPath, type PathPart } from "./core/field.ts";
import { type Locale, LOCALE_KEY, resolveLocales, withLocale } from "./lib/locales.ts";
import { icon, itemList, labeledLink, link, mediaPath, requireAlt, section, type UiString } from "./lib/schema.ts";

// What src/site.schema.ts exports. `siteUi` is optional: a site without it
// has only the kit's interface strings.
export type SiteSchema = {
  siteSectionSchemas: Record<string, z.ZodObject>;
  siteCollections: Record<string, unknown>;
  siteUi?: Record<string, UiString>;
};

const navItem = z.strictObject({ label: z.string().min(1), link });

// A main nav item (site-kit-webflow-example design D108): a link, a list of
// child links one level deep, as in Webflow's Dropdown, or both.
const navChild = z
  .strictObject({ label: z.string().min(1), link, children: z.unknown().optional() })
  .superRefine((child, ctx) => {
    if (child.children === undefined) return;
    ctx.addIssue({ code: "custom", path: ["children"], message: `nav item "${child.label}" is a child with children of its own. Nav items nest one level deep: make them items of their own.` });
  });
const navEntry = z
  .strictObject({ label: z.string().min(1), link: link.optional(), children: z.array(navChild).min(1, { error: "needs at least one child" }).optional() })
  .superRefine((item, ctx) => {
    if (item.link === undefined && item.children === undefined) {
      ctx.addIssue({ code: "custom", path: ["link"], message: `nav item "${item.label}" has neither a "link" nor "children". Give it one or both.` });
    }
  });

// The URL of an embed, the one external URL the content dialect allows besides
// a video link in a body (site-kit-webflow-example design D105). Only https.
const httpsUrl = z
  .string()
  .superRefine((value, ctx) => {
    if (!URL.canParse(value)) ctx.addIssue({ code: "custom", message: `prop "url": "${value}" isn't a URL. An embed's url starts with https://` });
    else if (new URL(value).protocol !== "https:") ctx.addIssue({ code: "custom", message: `prop "url": "${value}" doesn't use https, which an embed's url must` });
  })
  .meta({ "x-widget": "string" });

// A video file under /assets/, for `hero` and `split` (site-kit-webflow-example
// design D103): the MP4 in `video`, and an optional WebM in `videoWebm`.
const videoPath = (prop: string, extension: "mp4" | "webm") =>
  mediaPath.refine((path) => path.toLowerCase().endsWith(`.${extension}`), { error: `prop "${prop}" must be an .${extension} file` }).meta({ "x-widget": "file" });

// A section's video needs its image, the poster, and a WebM goes with an MP4.
const checkVideo = (value: { video?: string; videoWebm?: string; image?: string }, ctx: z.RefinementCtx) => {
  if (value.video !== undefined && value.image === undefined) {
    ctx.addIssue({ code: "custom", path: ["image"], message: 'prop "video" needs "image", the poster that shows until the video plays' });
  }
  if (value.videoWebm !== undefined && value.video === undefined) {
    ctx.addIssue({ code: "custom", path: ["video"], message: 'prop "videoWebm" needs "video", the MP4 every browser plays' });
  }
};

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
    // A decorative video behind the text, muted and looping, with `image` as
    // its poster. Only with the variant `background`.
    video: videoPath("video", "mp4").optional(),
    videoWebm: videoPath("videoWebm", "webm").optional(),
    cta: labeledLink.optional(),
    secondaryCta: labeledLink.optional(),
    // A short line under the buttons, such as "Typical projects from $4,800".
    note: z.string().min(1).optional(),
    variant: z.enum(["centered", "image-left", "image-right", "background", "page"]).default("centered"),
  })
    .superRefine(requireAlt("image", "imageAlt"))
    .superRefine(checkVideo)
    .superRefine((hero, ctx) => {
      if (hero.variant !== "centered" && hero.variant !== "page" && hero.image === undefined && hero.video === undefined) {
        ctx.addIssue({ code: "custom", path: ["image"], message: `variant "${hero.variant}" needs an image` });
      }
      if (hero.video !== undefined && hero.variant !== "background") {
        ctx.addIssue({ code: "custom", path: ["video"], message: `prop "video" goes only with variant "background", not "${hero.variant}"` });
      }
    }),

  "rich-text": section("rich-text", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    body: z.string().min(1),
    // title-aside: the title beside the body, stacked on narrow screens.
    variant: z.enum(["narrow", "wide", "title-aside"]).default("narrow"),
  }),

  "collection-list": section("collection-list", {
    eyebrow: z.string().min(1).optional(),
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
    eyebrow: z.string().min(1).optional(),
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
    // Each image opens large in a dialog, with its caption and the others a
    // button away (site-kit-webflow-example design D103).
    lightbox: z.boolean().optional(),
    variant: z.enum(["grid", "masonry"]).default("grid"),
  }),

  testimonials: section("testimonials", {
    eyebrow: z.string().min(1).optional(),
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
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ question: z.string().min(1), answer: z.string().min(1) })),
  }),

  cta: section("cta", {
    eyebrow: z.string().min(1).optional(),
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
    eyebrow: z.string().min(1).optional(),
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
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ text: z.string().min(1) })),
    variant: z.enum(["line", "chips"]).default("line"),
  }),

  // Two to four figures, such as "500+ projects completed".
  stats: section("stats", {
    eyebrow: z.string().min(1).optional(),
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
    // The media as a muted, looping video, with `image` as its poster and
    // `imageAlt` as its text alternative.
    video: videoPath("video", "mp4").optional(),
    videoWebm: videoPath("videoWebm", "webm").optional(),
    stats: statList.min(1, { error: "needs at least 1 item" }).optional(),
    link: labeledLink.optional(),
    variant: z.enum(["image-left", "image-right"]).default("image-left"),
    tone: z.enum(["plain", "surface"]).default("plain"),
  })
    .superRefine(requireAlt("image", "imageAlt"))
    .superRefine(checkVideo),

  // Panels behind a row of tabs, such as floors or plans (site-kit-webflow-example
  // design D103). Without scripts, each panel shows under its label.
  tabs: section("tabs", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    items: z
      .array(
        z
          .strictObject({
            label: z.string().min(1),
            title: z.string().min(1).optional(),
            body: z.string().min(1).optional(),
            image: mediaPath.optional(),
            imageAlt: z.string().min(1).optional(),
            link: labeledLink.optional(),
          })
          .superRefine(requireAlt("image", "imageAlt")),
      )
      .min(2, { error: "needs at least 2 items" }),
    variant: z.enum(["horizontal", "vertical"]).default("horizontal"),
  }),

  // Slides one at a time, or cards in a row, with previous and next buttons
  // (site-kit-webflow-example design D103). It rotates only with `autoplay`,
  // the seconds between slides. Without scripts, a list that scrolls sideways.
  slider: section("slider", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    intro: z.string().min(1).optional(),
    slides: itemList(
      z
        .strictObject({
          image: mediaPath.optional(),
          imageAlt: z.string().min(1).optional(),
          title: z.string().min(1).optional(),
          body: z.string().min(1).optional(),
          link: labeledLink.optional(),
        })
        .superRefine(requireAlt("image", "imageAlt"))
        .superRefine((slide, ctx) => {
          if (slide.image === undefined && slide.title === undefined && slide.body === undefined) {
            ctx.addIssue({ code: "custom", path: ["image"], message: 'needs an "image", a "title" or a "body"' });
          }
        }),
    ),
    autoplay: z.number().min(3, { error: "is the seconds between slides, at least 3" }).optional(),
    variant: z.enum(["full", "cards"]).default("full"),
  }),

  // The people behind the business. A member without a photo gets a placeholder.
  team: section("team", {
    eyebrow: z.string().min(1).optional(),
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
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    items: itemList(z.strictObject({ label: z.string().min(1), price: z.string().min(1) })),
    note: z.string().min(1).optional(),
  }),

  // A map, a video or other content in a frame, which loads only when the
  // visitor asks for it (site-kit-webflow-example design D105). The title
  // names the frame. `direct` loads it at once: only for a site whose privacy
  // notice names the provider.
  embed: section("embed", {
    eyebrow: z.string().min(1).optional(),
    title: z.string().min(1),
    url: httpsUrl,
    kind: z.enum(["map", "video", "other"]).default("other"),
    aspect: z.enum(EMBED_ASPECTS).default("16:9"),
    caption: z.string().min(1).optional(),
    load: z.enum(["click", "direct"]).default("click"),
  }).superRefine((embed, ctx) => {
    if (embed.kind === "video" && URL.canParse(embed.url) && videoSource(embed.url) === undefined) {
      ctx.addIssue({ code: "custom", path: ["url"], message: `prop "url": "${embed.url}" isn't a YouTube or Vimeo video, which kind "video" plays. Use kind "other" for another player.` });
    }
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
export function defineKitContent(siteConfig: SiteConfig, { siteSectionSchemas, siteCollections, siteUi = {} }: SiteSchema) {
  checkSiteUi(siteUi);
  // Every site's content is in a folder per locale (site-kit-locales design D48).
  const locales = resolveLocales(siteConfig.locales);
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
  checkPatterns(siteCollections, siteUi);

  // The section registry: library types, then site-local types.
  const sectionSchemas: Record<string, SectionSchema> = { ...library, ...siteSectionSchemas };
  const sectionUnion = z.discriminatedUnion("type", Object.values(sectionSchemas) as [SectionSchema, ...SectionSchema[]]);

  // Checks each section on its own first, so errors name the section id, its
  // type and the prop. The typed union then parses the checked list.
  const sectionList = checkedList(checkSections(sectionSchemas), sectionUnion);

  return {
    sectionSchemas,
    // True for a type defined in src/site.schema.ts.
    isSiteSectionType: (type: string) => Object.hasOwn(siteSectionSchemas, type),
    collections: {
      pages: pagesCollection(sectionList, locales),
      settings: settingsCollection(siteUi, locales),
      ...Object.fromEntries(Object.entries(siteCollections).map(([name, collection]) => [name, siteCollection(name, collection, locales)])),
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
      // An empty list reads as absent (core/cms-values.ts), so a required list
      // without items is reported as one.
      if (valueAt(value, issue.path) === undefined && issue.expected === "array") return `prop "${path}": needs at least one item`;
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

// Fields every page has. A `template: custom` page has no others: its
// content is in sections, which a CMS can translate (site-kit-locales design
// D53).
export const pageFields = {
  title: z.string().min(1),
  description: z.string().min(1).optional(),
  ogImage: mediaPath.optional(),
};
const PAGE_KEYS = ["title", "description", "ogImage", "template", "sections"];

// A translation's own URL segment, `localSlug` (site-kit-locales design D49).
// Not `slug`, which Astro's glob loader reads as the entry's id by default.
// Where it's allowed, the route table checks: only in a locale other than the
// default.
export const LOCAL_SLUG = "localSlug";
export const localSlugField = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/, { error: 'must be one lowercase URL segment, such as "ueber-uns"' });

// The loader of every collection, the site's too (site-kit-locales design
// D63): the files of `pattern` in src/content/<name>/, each with its path
// without the extension as its id, such as "services/painting.de" for
// services/painting.de.md. Astro's default id would drop the dot. Each entry
// carries its locale, from the code in its name (D48).
function localeLoader(name: string, pattern: string, locales: Locale[]) {
  return withLocale(glob({ pattern, base: `./src/content/${name}`, generateId: ({ entry }) => entry.replace(/\.[^./]+$/, "") }), locales);
}

// A translation exists only in a site with more than one locale.
const pagesCollection = (sectionList: z.ZodType<Section[]>, locales: Locale[]) => {
  const localized = locales.length > 1;
  const keys = localized ? [...PAGE_KEYS, LOCAL_SLUG] : PAGE_KEYS;
  return defineCollection({
    loader: localeLoader("pages", "**/*.md", locales),
    // Facts are filled first, so sections validate their filled values.
    schema: withFacts(
      z
        .looseObject({
          ...pageFields,
          template: z.literal("custom").optional(),
          sections: sectionList.optional(),
          ...(localized ? { [LOCAL_SLUG]: localSlugField.optional() } : {}),
        })
        .superRefine((page, ctx) => {
          for (const key of Object.keys(page)) {
            if (keys.includes(key)) continue;
            ctx.addIssue({
              code: "custom",
              path: [key],
              message:
                key === LOCAL_SLUG
                  ? `unknown frontmatter key "${LOCAL_SLUG}": a page sets its own URL segment only as a translation, in a site with several locales. The filename is the slug.`
                  : `unknown frontmatter key "${key}". A page has ${keys.join(", ")}. Content goes in sections${page.template === "custom" ? ", a custom page's too" : ""}.`,
            });
          }
          // A page without "sections" has none: a CMS leaves an empty list out.
        }),
      (_, locale) => readFacts(process.cwd(), locale),
    ),
  });
};

// A site collection, which the site declares by its schema alone, and the
// kit loads from src/content/<name>/, one file per entry and locale
// (site-kit-locales design D63). Its frontmatter is filled with facts before
// its own schema validates it, each entry from its own locale's facts, and in
// a localized site a translation may set `localSlug`. A schema may be a
// function of Astro's schema context.
function siteCollection(name: string, collection: unknown, locales: Locale[]) {
  const config = (collection && typeof collection === "object" ? collection : {}) as Record<string, unknown>;
  const declare = `Declare it by its schema alone, as ${name}: { schema: z.strictObject({ ... }) }: the kit loads every collection from src/content/<name>/, one file per entry and locale, such as <slug>.${locales[0].code}.md.`;
  const extra = Object.keys(config).find((key) => key !== "schema");
  if (extra) throw new Error(`Collection "${name}" in src/site.schema.ts sets "${extra}". ${declare}`);
  const { schema } = config;
  const loader = localeLoader(name, "*.md", locales);
  const wrap = (site: z.ZodType) => withFacts(locales.length > 1 ? withSlug(site) : site, (_, locale) => readFacts(process.cwd(), locale));
  if (typeof schema === "function") return defineCollection({ loader, schema: (context) => wrap((schema as (context: unknown) => z.ZodType)(context)) });
  if (schema instanceof z.ZodType) return defineCollection({ loader, schema: wrap(schema) });
  throw new Error(`Collection "${name}" in src/site.schema.ts has no Zod schema. ${declare}`);
}

// The site's own schema, with a translation's `localSlug` checked by the kit:
// the site's strict schema doesn't know the key.
function withSlug(site: z.ZodType) {
  return z.unknown().transform((input, ctx) => {
    if (!input || typeof input !== "object" || !(LOCAL_SLUG in input)) return parseOrReport(site, input, ctx);
    const { [LOCAL_SLUG]: slug, ...rest } = input as Record<string, unknown>;
    const checked = localSlugField.safeParse(slug);
    if (!checked.success) {
      ctx.addIssue({ code: "custom", path: [LOCAL_SLUG], message: checked.error.issues[0].message });
      return z.NEVER;
    }
    const data = parseOrReport(site, rest, ctx);
    return data === z.NEVER ? data : { ...(data as object), [LOCAL_SLUG]: checked.data };
  });
}

function parseOrReport(schema: z.ZodType, input: unknown, ctx: z.RefinementCtx) {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  for (const issue of result.error.issues) ctx.addIssue({ ...issue, code: "custom", message: issue.message } as never);
  return z.NEVER;
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
  // With pinned, also a copy outside the menu, beside the menu button
  // (site-kit-webflow-migration design D137).
  button: block("button", { label: z.string().min(1), link, style: z.enum(["primary", "secondary"]).default("primary"), pinned: z.boolean().optional() }),
  link: block("link", { label: z.string().min(1), link }),
  // The language switcher of a localized site (site-kit-locales design D52).
  locales: block("locales", {}),
};

// Each block in footer.blocks starts a group, such as a column, unless it
// sets withPrevious. footer.bottom, the last row, has no groups.
const footerFields = {
  title: z.string().min(1).optional(),
  withPrevious: z.boolean().optional(),
};
const footerBlockSchemas = {
  // The site's logo or name, with a line of text. Its own logo, such as a
  // reversed one for a dark footer, replaces the settings' logo here
  // (site-kit-webflow-example design D108).
  brand: block("brand", {
    text: z.string().min(1).optional(),
    logo: mediaPath.optional(),
    logoAlt: z.string().min(1).optional(),
    withPrevious: footerFields.withPrevious,
  }).superRefine(requireAlt("logo", "logoAlt")),
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
  // The language switcher of a localized site (site-kit-locales design D52).
  locales: block("locales", { withPrevious: footerFields.withPrevious }),
};

type HeaderActionSchemas = typeof headerActionSchemas;
type FooterBlockSchemas = typeof footerBlockSchemas;
export type HeaderAction = z.output<HeaderActionSchemas[keyof HeaderActionSchemas]>;
export type FooterBlock = z.output<FooterBlockSchemas[keyof FooterBlockSchemas]>;

// A list of blocks, checked one by one first, so errors name the block, its
// type and the prop, like sections.
function blockList<S extends Record<string, z.ZodObject>>(schemas: S, kind: string) {
  const union = z.discriminatedUnion("type", Object.values(schemas) as [S[keyof S], ...S[keyof S][]]);
  return checkedList((items, ctx) => {
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
  }, union);
}

// A list whose items are checked one by one before the typed union parses
// them: a page's sections, and the header's and footer's blocks. The checks
// run in a preprocess step, not a refinement piped to the union, because
// Astro writes a collection's JSON Schema from its input side: this way it
// lists every type with its fields (site-kit-core-split design D74, Q10). A
// value that isn't a list fails as z.array() fails it.
function checkedList<U extends z.ZodType>(check: (items: unknown[], ctx: z.RefinementCtx<unknown[]>) => void, union: U) {
  const list = z.array(z.unknown());
  return z.preprocess((value, ctx) => {
    const result = list.safeParse(value);
    if (!result.success) {
      for (const issue of result.error.issues) ctx.addIssue(issue);
    } else {
      check(result.data, ctx as unknown as z.RefinementCtx<unknown[]>);
    }
    return value;
  }, z.array(union));
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
  const pinned = actions.flatMap((action, i) => (action.type === "button" && action.pinned ? [i] : []));
  if (pinned.length > 1) {
    ctx.addIssue({
      code: "custom",
      path: [pinned[1], "pinned"],
      message: `header action ${pinned[1] + 1} (button): only one button action may set "pinned", so the header has room for it beside the menu button`,
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

// ---------------------------------------------------------------------------
// Interface strings
// ---------------------------------------------------------------------------

// The interface strings of the interactive parts (site-kit-webflow-example
// design D104), with the parameters the kit fills, such as "Slide {current}
// of {total}". They are optional in the settings: a page that renders a part
// needs its strings, and the part fails the build without them
// (lib/part-ui.ts), so a site that uses no part needs none.
export const PART_UI_PARAMS: Record<string, readonly string[]> = {
  sliderPrevious: [],
  sliderNext: [],
  sliderPause: [],
  sliderPlay: [],
  sliderStatus: ["current", "total"],
  lightboxClose: [],
  lightboxPrevious: [],
  lightboxNext: [],
  videoPause: [],
  videoPlay: [],
  embedShowMap: [],
  embedPlayVideo: [],
  embedShowContent: [],
  embedNotice: ["host"],
  embedOpen: ["host"],
  navSubmenu: ["label"],
};

// The interface strings of the kit's own parts, in the site's language. The
// layout's name what has no visible text, such as the navs and the menu
// button, so they are required, and none takes a parameter. `locales` names
// the language switcher: only a localized site needs it, and the route table
// checks that it has it (site-kit-locales design D52). The interactive parts'
// strings follow them. A block's labels and titles are its own props.
export const KIT_UI_KEYS: readonly string[] = ["skipLink", "menu", "readMore", "mainNav", "footerNav", "breadcrumb", "home", "locales", ...Object.keys(PART_UI_PARAMS)];
const OPTIONAL_KIT_UI_KEYS: readonly string[] = ["locales", ...Object.keys(PART_UI_PARAMS)];

const UI_KEY = /^[a-z][a-zA-Z0-9]*$/;
const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

// The site's declared keys (site-kit-locales design D46).
// A collection's title, description and Open Graph patterns are site
// interface strings named after it, such as postsPageTitle, whose parameters
// are its entries' fields (site-kit-webflow-migration design D134). The same
// suffixes as PATTERNS in lib/patterns.ts, which fills them.
const PATTERN_SUFFIXES = ["PageTitle", "PageDescription", "OgTitle", "OgDescription"];

function checkPatterns(siteCollections: Record<string, unknown>, siteUi: Record<string, UiString>) {
  for (const [name, collection] of Object.entries(siteCollections)) {
    const fields = fieldNames((collection as { schema?: unknown } | undefined)?.schema);
    if (!fields) continue;
    for (const key of PATTERN_SUFFIXES.map((suffix) => `${name}${suffix}`)) {
      const param = (siteUi[key]?.params ?? []).find((param) => param !== "title" && !fields.includes(param));
      if (param) {
        throw new Error(
          `Interface string "${key}" in siteUi in src/site.schema.ts has the parameter {${param}}, which isn't a field of the collection "${name}". Its fields are ${fields.map((field) => `{${field}}`).join(", ")}.`,
        );
      }
    }
  }
}

// The fields of a collection's object schema, called with a stand-in for
// Astro's schema context when it's a function, or undefined when it isn't an
// object.
function fieldNames(schema: unknown): string[] | undefined {
  const site = typeof schema === "function" ? (schema as (context: unknown) => unknown)({ image: () => z.string() }) : schema;
  return site instanceof z.ZodObject ? Object.keys(site.shape) : undefined;
}

function checkSiteUi(siteUi: Record<string, UiString>) {
  for (const key of Object.keys(siteUi)) {
    if (!UI_KEY.test(key)) {
      throw new Error(`Interface string "${key}" in siteUi in src/site.schema.ts must start with a lowercase letter, then letters or digits.`);
    }
    if (KIT_UI_KEYS.includes(key)) {
      throw new Error(`Interface string "${key}" in siteUi in src/site.schema.ts is one of the kit's own. Rename it.`);
    }
  }
}

// A plural string: its text in each CLDR plural form the language uses.
const pluralForms = (error: (issue: { input: unknown }) => string | undefined) =>
  z.strictObject(
    Object.fromEntries(PLURAL_CATEGORIES.map((category) => [category, category === "other" ? z.string().min(1) : z.string().min(1).optional()])),
    { error },
  );

// The settings' `ui`: the kit's keys and the site's declared ones, each
// required, and nothing else.
function uiSchema(siteUi: Record<string, UiString>) {
  const missing = (key: string, where: string) => (issue: { input: unknown }) =>
    issue.input === undefined ? `missing "${key}", ${where}, so the settings need its text` : undefined;
  const shape: Record<string, z.ZodType> = {};
  for (const key of KIT_UI_KEYS) {
    const text = z.string({ error: missing(key, "one of the kit's interface strings") }).min(1);
    shape[key] = OPTIONAL_KIT_UI_KEYS.includes(key) ? text.optional() : text;
  }
  for (const [key, declared] of Object.entries(siteUi)) {
    const where = "declared in siteUi in src/site.schema.ts";
    shape[key] = declared.plural ? pluralForms(missing(key, where)) : z.string({ error: missing(key, where) }).min(1);
  }
  return z.looseObject(shape).superRefine((ui, ctx) => {
    for (const key of Object.keys(ui)) {
      if (Object.hasOwn(shape, key)) continue;
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: `"${key}" is neither one of the kit's interface strings (${KIT_UI_KEYS.join(", ")}) nor declared in siteUi in src/site.schema.ts`,
      });
    }
  });
}

// Every plural form the settings' language uses, for each plural string.
function checkPluralForms(siteUi: Record<string, UiString>) {
  return (settings: { language: string; ui: Record<string, unknown> }, ctx: z.RefinementCtx) => {
    const needed = new Intl.PluralRules(settings.language).resolvedOptions().pluralCategories;
    for (const [key, declared] of Object.entries(siteUi)) {
      const value = settings.ui[key];
      if (!declared.plural || typeof value !== "object" || value === null) continue;
      const lacking = needed.filter((category) => !(value as Record<string, unknown>)[category]);
      if (lacking.length === 0) continue;
      ctx.addIssue({
        code: "custom",
        path: ["ui", key],
        message: `missing the plural form${lacking.length > 1 ? "s" : ""} ${lacking.map((c) => `"${c}"`).join(", ")}, which ${settings.language} uses. Its forms are ${needed.join(", ")}.`,
      });
    }
  };
}

// An interface string's own parameters stay as written in the settings: site
// code fills a site string's (lib/ui.ts), and the kit an interactive part's.
const keepUiParams = (siteUi: Record<string, UiString>) => (path: readonly (string | number)[], name: string) =>
  path[0] === "ui" && typeof path[1] === "string" && ((siteUi[path[1]]?.params.includes(name) ?? false) || (PART_UI_PARAMS[path[1]]?.includes(name) ?? false));

// The settings' `language` is their locale's tag (site-kit-locales design
// D54). A settings file doesn't write it: the kit fills it in before the
// schema checks the settings, so plural rules and site code read it as before.
function withLanguage(schema: z.ZodType, locales: Locale[]) {
  return z.preprocess((raw, ctx) => {
    if (!raw || typeof raw !== "object") return raw;
    const input = raw as Record<string, unknown>;
    const locale = locales.find((l) => l.code === input[LOCALE_KEY]) ?? locales[0];
    if ("language" in input) {
      ctx.addIssue({
        code: "custom",
        path: ["language"],
        message: `"language" isn't a setting: the locale's tag in src/site.config.ts sets it, here "${locale.tag}". Remove "language" from the settings.`,
        input,
      });
    }
    return { ...input, language: locale.tag };
  }, schema);
}

// One settings file per locale: settings/site.<code>.yml. A settings file
// without the locale, such as 0.5's site.yml, isn't loaded, and the route
// table names the file each locale lacks.
const settingsCollection = (siteUi: Record<string, UiString>, locales: Locale[]) => defineCollection({
  loader: localeLoader("settings", "site.*.yml", locales),
  schema: withLanguage(withFacts(
    z.strictObject({
      name: z.string().min(1),
      // Filled in from the locale's tag (withLanguage).
      language: z.string(),
      logo: z.strictObject({ image: mediaPath, alt: z.string().min(1) }).optional(),
      // May be empty, and a CMS leaves an empty list out.
      nav: z.array(navEntry).default([]),
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
      // The interface strings: the kit's and the site's (KIT_UI_KEYS, siteUi).
      ui: uiSchema(siteUi),
    }).superRefine(checkPluralForms(siteUi)),
    // The settings fill from their own facts, which stay as written.
    (input) => factsFrom((input as { facts?: unknown } | null)?.facts),
    ["facts"],
    keepUiParams(siteUi),
  ), locales),
});
