import { readFile } from "node:fs/promises";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

// Posts come from the site's headless CMS at build time. In this fixture, a
// local file stands in for the CMS's API: no network, no CMS package.
const posts = defineCollection({
  loader: {
    name: "cms-posts",
    load: async ({ config, store, parseData }) => {
      store.clear();
      const items = JSON.parse(await readFile(new URL("src/data/posts.json", config.root), "utf8"));
      for (const item of items) store.set({ id: item.slug, data: await parseData({ id: item.slug, data: item }) });
    },
  },
  schema: z.strictObject({ slug: z.string(), title: z.string().min(1), excerpt: z.string() }),
});

export const collections = { posts };
