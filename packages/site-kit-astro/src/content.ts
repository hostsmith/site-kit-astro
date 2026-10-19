// The site's content collections: the kit's, combined with the ones in the
// site's src/site.schema.ts (site-kit-updates design D19). The site's
// src/content.config.ts re-exports `collections`:
//
//   export { collections } from "@hostsmith/site-kit-astro/content";
/// <reference path="../virtual.d.ts" />
import { siteConfig } from "virtual:site-kit/config";
import * as siteSchema from "virtual:site-kit/site-schema";
import { decapUiKeys, SITE_PART } from "../scripts/decap-config.mjs";
import { defineKitContent, KIT_UI_KEYS } from "./kit-content.ts";

export const { collections, sectionSchemas, isSiteSectionType } = defineKitContent(siteConfig, siteSchema);

checkDecapUi(Object.keys(siteSchema.siteUi ?? {}));

// The site's declared interface strings and its Decap part's `ui` fields
// change together, as every site schema and its Decap part do
// (site-kit-locales design D46).
function checkDecapUi(declared: string[]) {
  const fields: string[] | undefined = decapUiKeys();
  if (fields === undefined) return;
  const own = fields.filter((name) => !(KIT_UI_KEYS as readonly string[]).includes(name));
  for (const key of declared) {
    if (!own.includes(key)) {
      throw new Error(`Interface string "${key}" is declared in siteUi in src/site.schema.ts, but ${SITE_PART} has no field for it under "ui". Add one, then run npm run decap-config.`);
    }
  }
  for (const key of own) {
    if (!declared.includes(key)) {
      throw new Error(`${SITE_PART} has a field "${key}" under "ui", but siteUi in src/site.schema.ts doesn't declare it. Declare it, or remove the field and run npm run decap-config.`);
    }
  }
}
export { describeIssue, pageFields, SECTION_ID, type Section } from "./kit-content.ts";
