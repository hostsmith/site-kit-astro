// The core's Astro integration (site-kit-core-split design D71), for an Astro
// site that keeps its own pages, layouts and components. A site adds it in
// astro.config.mjs:
//
//   import siteKitCore from "@hostsmith/site-kit-astro/core";
//   export default defineConfig({ integrations: [siteKitCore()] });
//
// It injects no routes, middleware, collections or styles, and sets none of
// the site's build options. Kit sites get it through the kit's integration.
import type { AstroIntegration } from "astro";
import { CORE_INTEGRATION, coreHooks } from "./src/core/integration.ts";

// No options yet. Later ones go in this object.
export type SiteKitCoreOptions = Record<string, never>;

export function siteKitCore(_options: SiteKitCoreOptions = {}): AstroIntegration {
  return { name: CORE_INTEGRATION, hooks: coreHooks() };
}

export default siteKitCore;
