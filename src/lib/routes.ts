// The path list (design D1): every URL the site serves and where it comes
// from. The generic route, collection-list links and the sitemap all read it,
// so a base path is set in one place (src/site.config.ts).
import { getCollection, type CollectionEntry } from "astro:content";
import { collections } from "../content.config.ts";
import { siteConfig, type CollectionName } from "../site.config.ts";

export type PageRoute = { path: string; kind: "page" | "custom"; entry: CollectionEntry<"pages"> };
export type EntryRoute = { path: string; kind: "entry"; collection: CollectionName; entry: CollectionEntry<CollectionName> };
export type Route = PageRoute | EntryRoute;

// Hand-written pages, keyed by the URL they serve. Kit-owned routes and
// dynamic or private (`_`) files are not hand-written pages.
const handWrittenFiles = Object.keys(import.meta.glob("/src/pages/**/*.astro"));
const KIT_PAGES = new Set(["/src/pages/[...slug].astro", "/src/pages/404.astro"]);

export function handWrittenPages(): Map<string, string> {
  const pages = new Map<string, string>();
  for (const file of handWrittenFiles) {
    const segments = file.slice("/src/pages/".length).split("/");
    if (KIT_PAGES.has(file) || segments.some((s) => s.startsWith("_") || s.includes("["))) continue;
    let path = file.slice("/src/pages".length, -".astro".length);
    if (path === "/index") path = "/";
    else if (path.endsWith("/index")) path = path.slice(0, -"/index".length);
    pages.set(path, file.slice(1));
  }
  return pages;
}

const detailTemplates = import.meta.glob("/src/components/collections/*.astro", { eager: true, import: "default" });

export function detailTemplate(collection: string) {
  return detailTemplates[`/src/components/collections/${collection}.astro`] as (props: Record<string, unknown>) => unknown;
}

// The URL of a page entry: `home` is "/", others are "/<entry id>".
export function pagePath(id: string): string {
  return id === "home" ? "/" : `/${id}`;
}

let routes: Promise<Route[]> | undefined;

export function getRoutes(): Promise<Route[]> {
  routes ??= buildRoutes();
  return routes;
}

// Non-draft entries of a collection with their URLs, newest first by `date`
// when the collection has one.
export async function getEntryRoutes(collection: CollectionName): Promise<EntryRoute[]> {
  const list = (await getRoutes()).filter((r): r is EntryRoute => r.kind === "entry" && r.collection === collection);
  const date = (r: EntryRoute) => String((r.entry.data as { date?: string }).date ?? "");
  return list.sort((a, b) => date(b).localeCompare(date(a)) || a.entry.id.localeCompare(b.entry.id));
}

async function buildRoutes(): Promise<Route[]> {
  const list: Route[] = [];
  const sources = new Map<string, string>();
  const claim = (path: string, source: string) => {
    const other = sources.get(path);
    if (other) throw new Error(`Two sources produce the URL ${path}: ${other} and ${source}. Every URL has one source.`);
    sources.set(path, source);
  };

  const handWritten = handWrittenPages();
  for (const [path, file] of handWritten) claim(path, `hand-written page ${file}`);

  for (const entry of await getCollection("pages")) {
    const file = entry.filePath ?? `src/content/pages/${entry.id}.md`;
    if (entry.body?.trim()) {
      throw new Error(`${file} has text after its frontmatter. A page's content belongs in its sections, and the body must be empty.`);
    }
    // Page entry `404` is rendered by src/pages/404.astro as 404.html.
    if (entry.id === "404") continue;
    const path = pagePath(entry.id);
    if (entry.data.template === "custom") {
      if (!handWritten.has(path)) {
        const page = path === "/" ? "src/pages/index.astro" : `src/pages${path}.astro`;
        throw new Error(`${file} sets template: custom, but no hand-written page exists for ${path}. Add ${page}.`);
      }
      list.push({ path, kind: "custom", entry });
    } else {
      claim(path, `page entry ${file}`);
      list.push({ path, kind: "page", entry });
    }
  }

  for (const name of Object.keys(collections)) {
    if (name === "pages" || name === "settings") continue;
    if (!Object.hasOwn(siteConfig.collections, name)) {
      throw new Error(`Collection "${name}" has no base path. Add it to the collections in src/site.config.ts.`);
    }
  }

  for (const [name, { basePath }] of Object.entries(siteConfig.collections) as [CollectionName, { basePath: string }][]) {
    if (!/^(\/[a-z0-9][a-z0-9._-]*)+$/.test(basePath)) {
      throw new Error(`Base path "${basePath}" of collection "${name}" in src/site.config.ts must start with "/", use lowercase segments and have no trailing slash.`);
    }
    if (!detailTemplate(name)) {
      throw new Error(`Collection "${name}" has no detail template. Add src/components/collections/${name}.astro.`);
    }
    for (const entry of await getCollection(name)) {
      if ((entry.data as { draft?: boolean }).draft) continue;
      const path = `${basePath}/${entry.id}`;
      claim(path, `${name} entry ${entry.filePath ?? entry.id}`);
      list.push({ path, kind: "entry", collection: name, entry });
    }
  }

  return list;
}
