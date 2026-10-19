// A localized test site: English at the root, German under /de.
export const siteConfig = {
  url: "https://www.example.com",
  locales: [
    { code: "en", tag: "en-US" },
    { code: "de", tag: "de-DE", path: "/de" },
  ],
  collections: {
    news: { basePath: { en: "/blog", de: "/aktuelles" } },
  },
} as const;

export type CollectionName = keyof typeof siteConfig.collections;
