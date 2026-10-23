// A site's manifest, hostsmith.json, and its kind (site-kit-core-split design
// D72, D73). A site with src/site.schema.ts is a kit site, and any other is a
// core site. The commands and the core's integration both read these, so this
// is plain JavaScript: Node strips no types from a package in node_modules.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const MANIFEST = "hostsmith.json";

// "kit" or "core".
export function siteKind(root) {
  return existsSync(join(root, "src", "site.schema.ts")) ? "kit" : "core";
}

// Where the site's content lives (site-kit-core-split design D86): "repo",
// files in the site's repository, which a manifest without content.source
// means, or "external", a headless CMS the build fetches from. An external
// site's content names only its source and its provider, free text that no
// code reads. A kit site's content is always in its repository.
export function contentSource(manifest, kind) {
  const content = manifest?.content ?? {};
  const source = content.source ?? "repo";
  if (source !== "repo" && source !== "external") {
    throw new Error(`${MANIFEST} sets content.source to ${JSON.stringify(source)}. It is "repo", the default, or "external", for content in a headless CMS.`);
  }
  if (source === "external") {
    if (kind === "kit") throw new Error(`${MANIFEST} sets content.source to "external", but a kit site's content is in its repository. Remove content.source.`);
    const extra = Object.keys(content).find((key) => key !== "source" && key !== "provider");
    if (extra) {
      throw new Error(`${MANIFEST} sets content.source to "external", so its content holds only "source" and "provider", not "${extra}": the site's content lives in its CMS.`);
    }
    if (content.provider !== undefined && typeof content.provider !== "string") throw new Error(`${MANIFEST} sets content.provider to a non-string. It names the CMS, such as "sanity".`);
  }
  return source;
}

// What a command says when it has nothing to do in an external site.
export const externalSite = (what) => `content.source in ${MANIFEST} is "external": the site's content lives in its CMS, so ${what}.`;

// The parsed manifest, or null when the site has none.
export function readManifest(root) {
  const file = join(root, MANIFEST);
  if (!existsSync(file)) return null;
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${MANIFEST} isn't valid JSON: ${error.message}`);
  }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error(`${MANIFEST} must hold a JSON object.`);
  return manifest;
}
