// The localized test site's schemas. The kit loads its news from
// src/content/news/<slug>.<code>.md.
import { isoDate, mediaPath, requireAlt, uiString } from "@hostsmith/site-kit-astro/schema";
import { z } from "astro/zod";

export const siteSectionSchemas = {};

export const siteUi = {
  minRead: uiString({ params: ["minutes"], plural: "minutes" }),
};

export const siteCollections = {
  news: {
    schema: z
      .strictObject({
        title: z.string().min(1),
        date: isoDate,
        description: z.string().min(1).optional(),
        image: mediaPath.optional(),
        imageAlt: z.string().min(1).optional(),
      })
      .superRefine(requireAlt("image", "imageAlt")),
  },
};
