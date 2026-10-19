// Per-site routing settings (design D1).
//
// `url` is the production site URL. Canonical links, Open Graph URLs, the
// sitemap and robots.txt are built from it, and astro.config.mjs reads it.
//
// Each collection's base path is part of every entry URL, every link to an
// entry and the sitemap. Hostsmith has no redirects, so a migrated site keeps
// the old site's base path, for example Webflow's "/post". A base path starts
// with "/", has no trailing slash and may have several segments.
export const siteConfig = {
  url: "https://www.example.com",
  locales: [{ code: "en" }],
  collections: {
    news: { basePath: "/news" },
  },
} as const;

export type CollectionName = keyof typeof siteConfig.collections;
