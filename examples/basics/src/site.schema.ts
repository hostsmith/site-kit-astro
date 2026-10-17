// This site's own content schemas: site-local section types and the site's
// collections. The kit combines them with its own.
//
// public/admin/config.site.yml mirrors these fields by hand: change both files
// in the same commit, then run `npm run decap-config`. Every object is strict,
// so a key that isn't defined here fails the build.
import { isoDate, mediaPath, requireAlt } from "@hostsmith/site-kit-astro/schema";
import { defineCollection } from "astro/content/config";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Site-local section types, built with `section` from the kit's schema
// helpers. Each one also needs a component in
// src/components/sections/site/<type>.astro and a Decap type under
// `section_types` in config.site.yml:
//
//   "menu-board": section("menu-board", { title: z.string().min(1) }),
export const siteSectionSchemas = {};

// The blog's categories. Collection-list cards and the post template show an
// entry's category; an unknown one fails the build with these names.
export const NEWS_CATEGORIES = ["Planning", "Renovation", "Maintenance", "News"] as const;

// The site's collections. Each one also needs a base path in
// src/site.config.ts, a detail template in src/components/collections/ and a
// Decap folder collection in config.site.yml.
export const siteCollections = {
  news: defineCollection({
    loader: glob({ pattern: "*.md", base: "./src/content/news" }),
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
  }),
};
