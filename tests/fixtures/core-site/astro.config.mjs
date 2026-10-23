import siteKitCore from "@hostsmith/site-kit-astro/core";
import { defineConfig } from "astro/config";

// An Astro site with its own pages, layout and collections. The kit's core
// adds the CMS, the checks and the updates, and changes no page.
export default defineConfig({
  integrations: [siteKitCore()],
});
