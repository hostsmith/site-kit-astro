import siteKitCore from "@hostsmith/site-kit-astro/core";
import { defineConfig } from "astro/config";

// An Astro site whose content is in a headless CMS, fetched at build time.
// The core gives it hosting and upkeep, and no editor (content.source is
// "external" in hostsmith.json).
export default defineConfig({
  integrations: [siteKitCore()],
});
