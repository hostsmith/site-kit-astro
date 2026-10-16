// The site's content collections: the kit's, combined with the ones in the
// site's src/site.schema.ts (site-kit-updates design D19). The site's
// src/content.config.ts re-exports `collections`:
//
//   export { collections } from "@hostsmith/site-kit-astro/content";
/// <reference path="../virtual.d.ts" />
import { siteConfig } from "virtual:site-kit/config";
import * as siteSchema from "virtual:site-kit/site-schema";
import { defineKitContent } from "./kit-content.ts";

export const { collections, sectionSchemas, isSiteSectionType } = defineKitContent(siteConfig, siteSchema);
export { describeIssue, pageFields, SECTION_ID, type Section } from "./kit-content.ts";
