import siteKit from "@hostsmith/site-kit-astro";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/site.config.ts";

// The kit's integration sets the build options and the kit's routes. This
// site's settings are in src/site.config.ts. Tailwind builds the site's
// stylesheet, src/styles/global.css: the kit ships no CSS.
export default defineConfig({
  integrations: [siteKit(siteConfig)],
  vite: { plugins: [tailwindcss()] },
});
