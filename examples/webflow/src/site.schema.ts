// This site's own content schemas: site-local section types and the site's
// collections. The kit combines them with its own.
//
// public/admin/config.site.yml mirrors these fields by hand: change both files
// in the same commit, then run `npm run decap-config`. Every object is strict,
// so a key that isn't defined here fails the build.
import { isoDate, mediaPath, requireAlt, type UiString } from "@hostsmith/site-kit-astro/schema";
import { z } from "astro/zod";

// Site-local section types, built with `section` from the kit's schema
// helpers. A ported Webflow section that no library type fits becomes one.
// Each one also needs a component in src/components/sections/site/<type>.astro
// and a Decap type under `section_types` in config.site.yml:
//
//   "menu-board": section("menu-board", { title: z.string().min(1) }),
export const siteSectionSchemas = {};

// The labels the site's own templates show, declared with uiString() from the
// kit's schema helpers, such as `keepReading: uiString()`. Their text is
// under `ui` in each locale's settings, and each has a field under `ui` in
// config.site.yml. Templates read them with getUi() from
// "@hostsmith/site-kit-astro/ui". This example's templates show none.
export const siteUi: Record<string, UiString> = {};

// The site's collections, each declared by its schema, as a Webflow CMS
// collection maps onto one. The kit loads it from src/content/<name>/, one
// file per entry and locale, such as src/content/news/collection-entry.en.md.
// Each one also needs a base path in src/site.config.ts, a detail template in
// src/components/collections/ and a Decap folder collection in
// config.site.yml.
export const siteCollections = {
  news: {
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
  },
};
