import siteKitCore from "@hostsmith/site-kit-astro/core";
import { defineConfig } from "astro/config";

// An Astro site in English and German, with its own pages and Astro's i18n
// routing: English at the root, German under /de. The core reads the locales
// from hostsmith.json and checks that they match these.
export default defineConfig({
  i18n: { defaultLocale: "en", locales: ["en", "de"] },
  integrations: [siteKitCore()],
});
