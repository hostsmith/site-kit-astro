// Per-site routing settings (design D1).
//
// `url` is the production site URL. Canonical links, Open Graph URLs, the
// sitemap and robots.txt are built from it, and astro.config.mjs reads it.
//
// `locales` lists the site's languages, the default first. Each content file
// names its code before the extension, such as src/content/pages/about.en.md,
// and its tag sets the pages' language.
// The default locale is served at the root; adding a second one serves it
// under its own path, such as /de.
//
// Each collection's base path is part of every entry URL, every link to an
// entry and the sitemap. Hostsmith has no redirects, so a migrated site keeps
// the old site's base path, for example Webflow's "/post". A base path starts
// with "/", has no trailing slash and may have several segments.
//
// `siteVariants` adds the site's own looks for library section types, each
// with the label the CMS shows, such as
//
//   siteVariants: { faq: { boxed: { label: "Boxed, with a border" } } },
//
// A section entry then picks one with `siteVariant: boxed`, and the theme's
// sections.css styles `.sk-faq[data-site-variant="boxed"]`. Run
// `npm run decap-config` after a change, so the CMS offers it.
//
// This file is plain TypeScript without imports: the kit's commands read it
// outside the build.
export const siteConfig = {
  url: "https://www.example.com",
  locales: [{ code: "en", tag: "en-US" }],
  collections: {
    // The news collection is the blog: its entries are served at /blog/<slug>.
    news: { basePath: "/blog" },
  },
} as const;

export type CollectionName = keyof typeof siteConfig.collections;
