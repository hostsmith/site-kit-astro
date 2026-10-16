// The integration's virtual modules (site-kit-updates design D19).

declare module "virtual:site-kit/config" {
  export const siteConfig: import("./index.ts").SiteConfig;
}

declare module "virtual:site-kit/site-schema" {
  export const siteSectionSchemas: Record<string, import("astro/zod").z.ZodObject>;
  export const siteCollections: Record<string, unknown>;
}
