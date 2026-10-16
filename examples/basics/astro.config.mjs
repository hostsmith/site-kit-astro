import siteKit from "@hostsmith/site-kit-astro";
import { defineConfig } from "astro/config";
import { siteConfig } from "./src/site.config.ts";

// The kit's integration sets the build options, the kit's routes and styles.
// This site's settings are in src/site.config.ts.
export default defineConfig({
  integrations: [siteKit(siteConfig)],
});
