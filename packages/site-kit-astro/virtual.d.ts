// The integration's virtual modules (site-kit-updates design D19), and the
// core's (site-kit-core-split design D71).

declare module "virtual:site-kit/core" {
  // A core site's `content.locales` from hostsmith.json, or null.
  export const locales: { default: string; codes: string[] } | null;
}

declare module "virtual:site-kit/config" {
  export const siteConfig: import("./index.ts").SiteConfig;
}

declare module "virtual:site-kit/site-schema" {
  export const siteSectionSchemas: Record<string, import("astro/zod").z.ZodObject>;
  export const siteCollections: Record<string, unknown>;
  export const siteUi: Record<string, import("./src/lib/schema.ts").UiString> | undefined;
}
