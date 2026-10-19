// The path list (design D1): every URL the site serves and where it comes
// from. The generic route, collection-list links and the sitemap all read it,
// so a base path is set in one place (the site's src/site.config.ts).
//
// Each locale's pages and entries are served under its prefix, with their
// localized slugs and base paths (site-kit-locales design D49). The default
// locale has no prefix, so a site with one locale serves "about.en" at
// /about. A route's `key` is its id without the locale, which its
// translations share: "services/painting" for "services/painting.de".
//
// The site's hand-written pages and collection templates are found by
// root-relative globs, resolved from the site's root (site-kit-updates design
// D20).
/// <reference path="../../virtual.d.ts" />
import { getCollection, type CollectionEntry } from "astro:content";
import { siteConfig } from "virtual:site-kit/config";
import { collections } from "../content.ts";
import { type Locale, noLocale, splitId } from "./locales.ts";
import { localeOfCode, localeOfPath, locales, localized } from "./site-locales.ts";

type CollectionName = string;

type RouteBase = { path: string; key: string; locale: Locale };
// A `custom` page with `template` is rendered by its page template; without
// it, by a hand-written page in src/pages/.
export type PageRoute = RouteBase & { kind: "page" | "custom"; entry: CollectionEntry<"pages">; template?: boolean };
export type EntryRoute = RouteBase & { kind: "entry"; collection: CollectionName; entry: CollectionEntry<CollectionName> };
export type Route = PageRoute | EntryRoute;

// Hand-written pages, keyed by the URL they serve. Dynamic or private (`_`)
// files are not hand-written pages.
const handWrittenFiles = Object.keys(import.meta.glob("/src/pages/**/*.astro"));

export function handWrittenPages(): Map<string, string> {
  const pages = new Map<string, string>();
  for (const file of handWrittenFiles) {
    const segments = file.slice("/src/pages/".length).split("/");
    if (segments.some((s) => s.startsWith("_") || s.includes("["))) continue;
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

// Page templates of `template: custom` pages, keyed by the page's id without
// its locale: src/components/pages/<page>.astro (site-kit-locales design D53).
const pageTemplates = import.meta.glob("/src/components/pages/**/*.astro", { eager: true, import: "default" });

export function pageTemplate(key: string) {
  return pageTemplates[`/src/components/pages/${key}.astro`] as ((props: Record<string, unknown>) => unknown) | undefined;
}

let routes: Promise<Route[]> | undefined;

export function getRoutes(): Promise<Route[]> {
  routes ??= buildRoutes();
  return routes;
}

// Non-draft entries of a collection with their URLs, newest first by `date`
// when the collection has one: a locale's entries, the default locale's
// without a code.
export async function getEntryRoutes(collection: CollectionName, locale?: string): Promise<EntryRoute[]> {
  const code = localeOfCode(locale)?.code;
  const list = (await getRoutes()).filter((r): r is EntryRoute => r.kind === "entry" && r.collection === collection && r.locale?.code === code);
  const date = (r: EntryRoute) => String((r.entry.data as { date?: string }).date ?? "");
  return list.sort((a, b) => date(b).localeCompare(date(a)) || a.entry.id.localeCompare(b.entry.id));
}

// A route's translations, itself included, in the order of the site's
// locales. A single-locale site's route has none but itself.
export async function getTranslations(route: Route): Promise<Route[]> {
  if (!localized) return [route];
  const all = await getRoutes();
  const same = (other: Route) =>
    other.key === route.key && (other.kind === "entry" ? route.kind === "entry" && other.collection === route.collection : route.kind !== "entry");
  return locales.flatMap((locale) => all.filter((other) => other.locale?.code === locale.code && same(other)));
}

// The 404 page entry of each locale, the default locale's first
// (site-kit-locales design D57).
export async function getNotFoundPages(): Promise<{ entry: CollectionEntry<"pages">; locale: Locale }[]> {
  const pages = await getCollection("pages");
  return locales.flatMap((locale) => {
    const entry = pages.find((page) => page.id === `404.${locale.code}`);
    return entry ? [{ entry, locale }] : [];
  });
}

// The route a URL path is served from, if the route table has it.
export async function routeOf(path: string): Promise<Route | undefined> {
  return (await getRoutes()).find((route) => route.path === path);
}

export type Crumb = { path: string; title: string; ref: string };

// The breadcrumb of a page whose path, after its locale's prefix, has more
// than one segment (site-kit-design-system design D38): each ancestor path
// that has a page, then the page itself, each by its entry's title. Undefined
// for a top-level page. The layout adds the home link before it.
export async function breadcrumbTrail(path: string): Promise<Crumb[] | undefined> {
  const prefix = localeOfPath(path).path;
  const segments = path.slice(prefix.length).split("/").filter(Boolean);
  if (segments.length < 2) return undefined;
  const byPath = new Map((await getRoutes()).map((route) => [route.path, route]));
  const crumb = (route: Route): Crumb => ({
    path: route.path,
    title: (route.entry.data as { title: string }).title,
    ref: `${route.kind === "entry" ? route.collection : "pages"}/${route.entry.id}`,
  });
  const trail: Crumb[] = [];
  for (let i = 1; i <= segments.length; i++) {
    const route = byPath.get(`${prefix}/${segments.slice(0, i).join("/")}`);
    if (route) trail.push(crumb(route));
  }
  // A hand-written page without a page entry has no title to show.
  return trail.at(-1)?.path === path ? trail : undefined;
}

const BASE_PATH = /^(\/[a-z0-9][a-z0-9._-]*)+$/;

// A collection's base path in a locale: one string for every locale, or one
// per locale code.
function basePathOf(name: string, locale: Locale): string {
  const { basePath } = siteConfig.collections[name];
  const path = typeof basePath === "string" ? basePath : basePath[locale.code];
  if (typeof path !== "string" || !BASE_PATH.test(path)) {
    throw new Error(`Base path "${path}" of collection "${name}"${typeof basePath === "string" ? "" : ` in locale "${locale.code}"`} in src/site.config.ts must start with "/", use lowercase segments and have no trailing slash.`);
  }
  return path;
}

function checkBasePaths() {
  for (const [name, { basePath }] of Object.entries(siteConfig.collections)) {
    if (typeof basePath === "string") continue;
    const missing = locales.filter((locale) => typeof basePath[locale.code] !== "string").map((locale) => locale.code);
    const unknown = Object.keys(basePath).filter((code) => !locales.some((locale) => locale.code === code));
    if (missing.length > 0 || unknown.length > 0) {
      throw new Error(
        `Collection "${name}" in src/site.config.ts needs a base path for each locale (${locales.map((l) => l.code).join(", ")}).${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}${unknown.length ? ` Not a locale: ${unknown.join(", ")}.` : ""}`,
      );
    }
  }
}

// The locale and key of an entry id: "de" and "services/painting" for
// "services/painting.de". A file without one of the site's locales in its
// name fails the build (site-kit-locales design D48).
function split(id: string, file: string): { locale: Locale; key: string } {
  const { code, key } = splitId(id);
  const locale = locales.find((l) => l.code === code);
  if (!locale) throw new Error(noLocale(file, id, locales));
  return { locale, key };
}

// A translation's own URL segment, its `localSlug`, checked where the kit
// allows one.
function slugOf(entry: { data: unknown }, locale: Locale, key: string, file: string): string | undefined {
  const { localSlug } = entry.data as { localSlug?: string };
  if (localSlug === undefined) return undefined;
  if (locale.isDefault) {
    throw new Error(`${file} sets "localSlug", but it is in the default locale "${locale.code}", where the filename is the slug. Only a translation sets its own.`);
  }
  if (key === "home" || key === "404") throw new Error(`${file} sets "localSlug", but "${key}" has no URL segment to change.`);
  return localSlug;
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
  for (const locale of locales.filter((l) => !l.isDefault)) {
    if (!handWritten.has(locale.path)) sources.set(locale.path, `the home page of locale "${locale.code}"`);
  }

  // Pages by locale and key, for localized slugs along a nested path.
  const pages = (await getCollection("pages")).map((entry) => {
    const file = entry.filePath ?? `src/content/pages/${entry.id}.md`;
    return { entry, file, ...split(entry.id, file) };
  });
  const byKey = new Map(pages.map((page) => [`${page.locale.code}:${page.key}`, page]));
  const slugs = new Map(pages.map((page) => [page, slugOf(page.entry, page.locale, page.key, page.file)]));
  const pathOf = (key: string, locale: Locale) => {
    const prefix = locale.path;
    if (key === "home") return prefix || "/";
    const segments = key.split("/");
    return `${prefix}/${segments
      .map((segment, i) => {
        const ancestor = byKey.get(`${locale.code}:${segments.slice(0, i + 1).join("/")}`);
        return (ancestor && slugs.get(ancestor)) ?? segment;
      })
      .join("/")}`;
  };

  for (const { entry, file, locale, key } of pages) {
    if (entry.body?.trim()) {
      throw new Error(`${file} has text after its frontmatter. A page's content belongs in its sections, and the body must be empty.`);
    }
    // Page entry `404` is rendered by the kit's src/routes/404.astro as 404.html.
    if (key === "404") continue;
    const path = pathOf(key, locale);
    if (entry.data.template === "custom") {
      const page = path === "/" ? "src/pages/index.astro" : `src/pages${path}.astro`;
      const template = `src/components/pages/${key}.astro`;
      if (pageTemplate(key) && handWritten.has(path)) {
        throw new Error(`${file} sets template: custom, and both ${template} and ${handWritten.get(path)} render it. Keep one.`);
      }
      if (pageTemplate(key)) {
        if (!(!locale.isDefault && key === "home")) claim(path, `page entry ${file}`);
        list.push({ path, key, locale, kind: "custom", entry, template: true });
        continue;
      }
      if (!handWritten.has(path)) {
        // Only a page template renders a page's translations.
        throw new Error(`${file} sets template: custom, but nothing renders it. Add the page template ${template}${locale.isDefault ? `, or the hand-written page ${page}` : ""}.`);
      }
      list.push({ path, key, locale, kind: "custom", entry });
    } else {
      // A locale's home page is served at the locale's path, which it claims.
      if (!(!locale.isDefault && key === "home")) claim(path, `page entry ${file}`);
      else sources.set(path, `page entry ${file}`);
      list.push({ path, key, locale, kind: "page", entry });
    }
  }

  for (const name of Object.keys(collections)) {
    if (name === "pages" || name === "settings") continue;
    if (!Object.hasOwn(siteConfig.collections, name)) {
      throw new Error(`Collection "${name}" has no base path. Add it to the collections in src/site.config.ts.`);
    }
  }
  checkBasePaths();

  for (const name of Object.keys(siteConfig.collections) as CollectionName[]) {
    if (!detailTemplate(name)) {
      throw new Error(`Collection "${name}" has no detail template. Add src/components/collections/${name}.astro.`);
    }
    for (const entry of await getCollection(name)) {
      const file = entry.filePath ?? `src/content/${name}/${entry.id}.md`;
      const { locale, key } = split(entry.id, file);
      if ((entry.data as { draft?: boolean }).draft) continue;
      const slug = slugOf(entry, locale, key, file) ?? key;
      const path = `${locale.path}${basePathOf(name, locale)}/${slug}`;
      claim(path, `${name} entry ${file}`);
      list.push({ path, key, locale, kind: "entry", collection: name, entry });
    }
  }

  await checkLocales(pages);
  return list;
}

// Every locale has its settings, home page and 404 page, and in a localized
// site its settings agree with the others (site-kit-locales design D48, D54).
// The settings are one file per locale, site.<code>.yml.
async function checkLocales(pages: { locale: Locale; key: string }[]) {
  const settings = new Map<string, CollectionEntry<"settings">>();
  for (const entry of await getCollection("settings")) {
    settings.set(split(entry.id, entry.filePath ?? `src/content/settings/${entry.id}.yml`).locale.code, entry);
  }
  const factNames = (code: string) => ((settings.get(code)?.data as { facts?: { name: string }[] }).facts ?? []).map((fact) => fact.name).sort();
  for (const locale of locales) {
    const file = `src/content/settings/site.${locale.code}.yml`;
    const own = settings.get(locale.code);
    if (!own) throw new Error(`Missing ${file}. Every locale has its settings.`);
    for (const key of ["home", "404"]) {
      if (!pages.some((page) => page.locale.code === locale.code && page.key === key)) {
        throw new Error(`Missing src/content/pages/${key}.${locale.code}.md. Every locale has its ${key === "home" ? "home page" : "404 page"}.`);
      }
    }
    const { ui } = own.data as { ui: { locales?: string } };
    if (localized && !ui.locales) {
      throw new Error(`${file} has no "locales" under "ui". In a site with several locales, every locale names its language switcher there.`);
    }
  }
  if (!localized) return;
  // Visitors need a way to change the language (site-kit-locales design D52).
  const blocks = [...settings.values()].flatMap((entry) => {
    const { header, footer } = entry.data as { header?: { actions?: { type: string }[] }; footer?: { blocks?: { type: string }[]; bottom?: { type: string }[] } };
    return [...(header?.actions ?? []), ...(footer?.blocks ?? []), ...(footer?.bottom ?? [])];
  });
  if (!blocks.some((block) => block.type === "locales")) {
    console.warn('[site-kit] The site has several locales, but no "locales" header action or footer block in its settings, so visitors can\'t change the language.');
  }
  const [first, ...others] = locales;
  for (const locale of others) {
    const ours = factNames(first.code);
    const theirs = factNames(locale.code);
    const lacking = ours.filter((name) => !theirs.includes(name));
    const extra = theirs.filter((name) => !ours.includes(name));
    if (lacking.length > 0 || extra.length > 0) {
      const name = lacking[0] ?? extra[0];
      const where = lacking.length > 0 ? locale.code : first.code;
      throw new Error(`The fact "${name}" is missing from src/content/settings/site.${where}.yml. Every locale's settings have the same facts.`);
    }
  }
}
