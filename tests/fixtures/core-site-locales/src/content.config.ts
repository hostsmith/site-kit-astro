import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { pageCopy } from "@hostsmith/site-kit-astro/copy";
import { isoDate } from "@hostsmith/site-kit-astro/schema";

// One folder per locale: src/content/news/en/ and src/content/news/de/.
const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: z.strictObject({
    title: z.string().min(1),
    date: isoDate,
    summary: z.string().min(1),
  }),
});

// Each file holds every locale's copy, under its code.
export const copy = pageCopy({
  home: z.strictObject({ hero: z.strictObject({ title: z.string().min(1), text: z.string().min(1) }) }),
  about: z.strictObject({ title: z.string().min(1), intro: z.string().min(1) }),
});

export const collections = { news, copy: copy.collection };
