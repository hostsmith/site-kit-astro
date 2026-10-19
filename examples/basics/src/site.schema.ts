// This site's own content schemas: site-local section types and the site's
// collections. The kit combines them with its own.
//
// public/admin/config.site.yml mirrors these fields by hand: change both files
// in the same commit, then run `npm run decap-config`. Every object is strict,
// so a key that isn't defined here fails the build.
import { isoDate, mediaPath, requireAlt, uiString } from "@hostsmith/site-kit-astro/schema";
import { z } from "astro/zod";

// Site-local section types, built with `section` from the kit's schema
// helpers. Each one also needs a component in
// src/components/sections/site/<type>.astro and a Decap type under
// `section_types` in config.site.yml:
//
//   "menu-board": section("menu-board", { title: z.string().min(1) }),
export const siteSectionSchemas = {};

// The labels the site's own templates show, such as the blog post's "Keep
// reading". Their text is under `ui` in each locale's settings,
// src/content/settings/<code>/site.yml, and each has a field under `ui` in
// config.site.yml. Templates read them with getUi() from
// "@hostsmith/site-kit-astro/ui".
export const siteUi = {
  keepReading: uiString(),
  // "4 min read": `minutes` picks the plural form.
  minRead: uiString({ params: ["minutes"], plural: "minutes" }),
};

// The blog's categories. Collection-list cards and the post template show an
// entry's category; an unknown one fails the build with these names.
export const NEWS_CATEGORIES = ["Planning", "Renovation", "Maintenance", "News"] as const;

// The site's collections, each declared by its schema. The kit loads it from
// src/content/<name>/, one file per entry and locale, such as
// src/content/news/spring-painting-dates.en.md. Each one also needs a base
// path in src/site.config.ts, a detail template in
// src/components/collections/ and a Decap folder collection in
// config.site.yml.
export const siteCollections = {
  news: {
    schema: z
      .strictObject({
        title: z.string().min(1),
        date: isoDate,
        category: z.enum(NEWS_CATEGORIES).optional(),
        description: z.string().min(1).optional(),
        image: mediaPath.optional(),
        imageAlt: z.string().min(1).optional(),
        draft: z.boolean().optional(),
      })
      .superRefine(requireAlt("image", "imageAlt")),
  },
};
