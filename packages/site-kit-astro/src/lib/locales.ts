// Locales (site-kit-locales design D47): every site lists its locales as
// `locales` in src/site.config.ts, the default first, and names each content
// file's locale before its extension, such as about.de.md (D48). The default
// locale is served at the root, and each other one under its path, as Webflow
// does:
//
//   locales: [
//     { code: "en", tag: "en-US" },
//     { code: "de", tag: "de-DE", path: "/de", label: "Deutsch" },
//   ]
//
// A site in one language lists one. Only a localized site, one with more
// than one locale, gets prefixes, alternates and a language switcher.
import { relative } from "node:path";

// A locale as the site config writes it.
export type LocaleConfig = {
  // The locale's suffix in content file names, and its CMS key: lowercase
  // BCP 47, such as "de".
  code: string;
  // The BCP 47 tag for lang, hreflang, og:locale and formatting. Defaults to code.
  tag?: string;
  // The URL prefix of a locale other than the default, one lowercase
  // segment. Defaults to the tag lowercased, such as "/es-mx".
  path?: string;
  // Its name in the language switcher. Defaults to the language's own name.
  label?: string;
  // Defaults to the tag's script direction.
  dir?: "ltr" | "rtl";
};

// A locale with every default filled in. `path` is "" for the default locale.
export type Locale = Required<LocaleConfig> & { isDefault: boolean };

const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;
const PATH = /^\/[a-z0-9][a-z0-9-]*$/;
const WHERE = "in src/site.config.ts";

// The site's locales with their defaults. Throws on a list the kit can't
// serve, naming what to fix.
export function resolveLocales(list: readonly LocaleConfig[] | undefined): Locale[] {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(`"locales" ${WHERE} is missing or empty. Every site lists its locales, the default first, such as locales: [{ code: "en", tag: "en-US" }].`);
  }
  const codes = new Set<string>();
  const paths = new Map<string, string>();
  const languages = list.map((locale) => languageOf(locale.tag ?? locale.code));

  return list.map((locale, index) => {
    const { code } = locale;
    if (typeof code !== "string" || !CODE.test(code)) {
      throw new Error(`Locale code ${JSON.stringify(code)} ${WHERE} must be a lowercase BCP 47 code, such as "de" or "fr-ca".`);
    }
    if (codes.has(code)) throw new Error(`Locale "${code}" ${WHERE} is listed twice.`);
    codes.add(code);

    const tag = locale.tag ?? code;
    let canonical: string;
    try {
      [canonical] = Intl.getCanonicalLocales(tag);
    } catch {
      throw new Error(`Locale "${code}" ${WHERE} has the tag ${JSON.stringify(tag)}, which isn't a BCP 47 tag, such as "de-DE".`);
    }

    const isDefault = index === 0;
    if (isDefault && locale.path !== undefined) {
      throw new Error(`The default locale "${code}" ${WHERE} has a path. The default locale is served at the root: leave its "path" out.`);
    }
    const path = isDefault ? "" : (locale.path ?? `/${canonical.toLowerCase()}`);
    if (!isDefault) {
      if (!PATH.test(path)) throw new Error(`Locale "${code}" ${WHERE} has the path "${path}". A path is one lowercase segment, such as "/de".`);
      const other = paths.get(path);
      if (other) throw new Error(`Locales "${other}" and "${code}" ${WHERE} both have the path "${path}".`);
      paths.set(path, code);
    }

    // The language's own name, with its region when two locales share it.
    const sharesLanguage = languages.filter((language) => language === languages[index]).length > 1;
    const label = locale.label ?? new Intl.DisplayNames([canonical], { type: "language" }).of(sharesLanguage ? canonical : languages[index]) ?? canonical;
    const dir = locale.dir ?? textDirection(canonical);
    return { code, tag: canonical, path, label, dir, isDefault };
  });
}

// An entry id's locale code and the id without it, which its translations
// share: "de" and "services/painting" for "services/painting.de". An entry's
// id is its file's path without the extension, so the code is the name's
// last part. An id without one has no code.
export function splitId(id: string): { code?: string; key: string } {
  const dot = id.lastIndexOf(".");
  if (dot <= id.lastIndexOf("/")) return { key: id };
  return { code: id.slice(dot + 1), key: id.slice(0, dot) };
}

// The locale of an entry id, such as "de" for "services/painting.de".
export function localeOfId(id: string, locales: readonly Locale[]): Locale | undefined {
  const { code } = splitId(id);
  return locales.find((locale) => locale.code === code);
}

// Why a content file has none of the site's locales, for the build's error.
// `file` is its path from the site's root.
export function noLocale(file: string, id: string, locales: readonly Locale[]): string {
  const codes = locales.map((locale) => locale.code).join(", ");
  const { code } = splitId(id);
  if (code !== undefined && CODE.test(code)) {
    return `${file} is in the locale "${code}", which isn't one of the site's locales in src/site.config.ts: ${codes}.`;
  }
  const dot = file.lastIndexOf(".");
  return `${file} has no locale in its name. A content file's name ends in its locale code, such as ${file.slice(0, dot)}.${locales[0].code}${file.slice(dot)}. The site's locales are ${codes}.`;
}

// The data key a collection's loader adds to each entry, so the entry's
// schema knows its locale (lib/facts.ts, withFacts). The schema step removes
// it before validating.
export const LOCALE_KEY = "__siteKitLocale";

type Loader = { name: string; load: (context: LoaderContext) => Promise<void> };
type LoaderContext = { parseData: (props: { id: string; data: Record<string, unknown>; filePath?: string }) => Promise<unknown> };

// A collection's loader whose entries carry their locale code under
// LOCALE_KEY. A file without one of the site's locales in its name fails
// here, before its schema checks it (design D48).
export function withLocale<L extends Loader>(loader: L, locales: readonly Locale[]): L {
  return {
    ...loader,
    load: (context: LoaderContext) =>
      loader.load({
        ...context,
        parseData: (props) => {
          const locale = localeOfId(props.id, locales);
          if (!locale) throw new Error(noLocale(relative(process.cwd(), props.filePath ?? props.id), props.id, locales));
          return context.parseData({ ...props, data: { ...props.data, [LOCALE_KEY]: locale.code } });
        },
      }),
  };
}

function languageOf(tag: string): string {
  return tag.split("-")[0].toLowerCase();
}

function textDirection(tag: string): "ltr" | "rtl" {
  const locale = new Intl.Locale(tag) as Intl.Locale & { getTextInfo?: () => { direction: string }; textInfo?: { direction: string } };
  const direction = locale.getTextInfo?.().direction ?? locale.textInfo?.direction;
  return direction === "rtl" ? "rtl" : "ltr";
}
