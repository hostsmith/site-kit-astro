// Per-site routing settings (design D1).
//
// `url` is the production site URL. Canonical links, Open Graph URLs, the
// sitemap and robots.txt are built from it, and astro.config.mjs reads it.
//
// `locales` lists the site's languages, the default first. Each content file
// names its code before the extension, such as src/content/pages/about.en.md,
// and its tag sets the pages' language.
//
// Each collection's base path is part of every entry URL, every link to an
// entry and the sitemap. Hostsmith has no redirects, so a ported Webflow site
// keeps its collection's path, such as Webflow's "/post" or the site's own
// "/blog". A base path starts with "/", has no trailing slash and may have
// several segments.
export const siteConfig = {
  url: "https://www.example.com",
  locales: [{ code: "en", tag: "en-US" }],
  collections: {
    news: { basePath: "/news" },
  },
} as const;

export type CollectionName = keyof typeof siteConfig.collections;
