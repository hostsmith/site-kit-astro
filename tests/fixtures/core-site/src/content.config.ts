import { readFile } from "node:fs/promises";
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { pageCopy } from "@hostsmith/site-kit-astro/copy";
import { isoDate, mediaPath } from "@hostsmith/site-kit-astro/schema";

// Events come from a booking service's API, which a local file stands in for.
// The entries have no file in the repository, so the CMS can't edit them.
const events = defineCollection({
  loader: {
    name: "booking-api",
    load: async ({ config, store, parseData }) => {
      store.clear();
      const items = JSON.parse(await readFile(new URL("src/data/events.json", config.root), "utf8"));
      for (const item of items) store.set({ id: item.id, data: await parseData({ id: item.id, data: item }) });
    },
  },
  schema: z.strictObject({ id: z.string(), title: z.string().min(1), date: isoDate }),
});

const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.strictObject({
    title: z.string().min(1),
    date: isoDate,
    summary: z.string().min(1).meta({ title: "Summary", description: "One sentence for the news list." }),
    category: z.enum(["Bakery", "Events"]),
    image: mediaPath.optional(),
    featured: z.boolean().optional(),
  }),
});

// The copy that the layout and the home and about pages show, one file each.
export const copy = pageCopy({
  site: z.strictObject({
    name: z.string().min(1),
    nav: z.strictObject({ about: z.string().min(1), news: z.string().min(1) }),
    footer: z.string().min(1),
  }),
  home: z.strictObject({
    hero: z.strictObject({ title: z.string().min(1), text: z.string().min(1), linkLabel: z.string().min(1) }),
    latestTitle: z.string().min(1),
  }),
  about: z.strictObject({
    title: z.string().min(1),
    intro: z.string().min(1),
    bakes: z.strictObject({ title: z.string().min(1), items: z.array(z.string().min(1)).min(1) }),
  }),
});

export const collections = { news, events, copy: copy.collection };
