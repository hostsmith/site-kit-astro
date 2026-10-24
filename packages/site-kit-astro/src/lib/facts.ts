// Facts (site-kit-design-system design D35): business facts that appear in
// several places, such as a phone number, live once in the settings' `facts`
// list, and any text in the content writes them as `{name}`. The kit knows no
// fact names: the site picks them.
//
// Frontmatter and settings are filled before their schemas check them, so a
// filled value is validated like a written one. Markdown bodies are filled by
// `factsPlugin`, a plugin of the kit's Markdown processor, which leaves code
// alone. An unknown name fails the build.
//
// Each locale's settings have their own facts, and an entry fills from its own
// locale's (site-kit-locales design D54).
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "astro/zod";
import { parse } from "yaml";
import { fromCms } from "../core/cms-values.ts";
import { LOCALE_KEY, splitId } from "./locales.ts";

export type Facts = ReadonlyMap<string, string>;

export const FACT_NAME = /^[a-z][a-zA-Z0-9]*$/;
const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g;

// The settings file of a locale, site.<code>.yml. A content file without a
// locale in its name has none, and the route table reports it.
export const settingsFile = (locale?: string) => join("src", "content", "settings", locale ? `site.${locale}.yml` : "site.yml");

// A settings `facts` list as a map, skipping malformed items: the settings
// schema reports those.
export function factsFrom(list: unknown): Facts {
  const facts = new Map<string, string>();
  if (!Array.isArray(list)) return facts;
  for (const item of list) {
    if (item && typeof item === "object" && typeof item.name === "string" && typeof item.value === "string") facts.set(item.name, item.value);
  }
  return facts;
}

const cached = new Map<string, { mtimeMs: number; facts: Facts }>();

// The facts of the site's settings file, or of a locale's. Other collections
// are validated apart from the settings collection, so the kit reads the file
// itself. A missing or broken file gives no facts: the settings collection
// reports it.
export function readFacts(root = process.cwd(), locale?: string): Facts {
  const file = join(root, settingsFile(locale));
  try {
    const { mtimeMs } = statSync(file);
    if (cached.get(file)?.mtimeMs !== mtimeMs) cached.set(file, { mtimeMs, facts: factsFrom(parse(readFileSync(file, "utf8"))?.facts) });
    return cached.get(file)!.facts;
  } catch {
    return new Map();
  }
}

// Without the locale's settings file, the content's facts can't be found, so
// the message names the missing file, as the route table would.
export function unknownFact(name: string, facts: Facts, locale?: string, root = process.cwd()): string {
  const file = settingsFile(locale);
  if (!existsSync(join(root, file))) return `unknown fact "{${name}}". Missing ${file}. Every locale has its settings, with its facts.`;
  const defined = facts.size > 0 ? `The facts are ${[...facts.keys()].map((n) => `{${n}}`).join(", ")}.` : "The settings have no facts.";
  return `unknown fact "{${name}}". ${defined} Add it to "facts" in ${file}, or fix the name.`;
}

// The locale of a content file: the code before its extension, such as "de"
// for news/fresh-rye.de.md.
export function localeOfFile(file: string): string | undefined {
  return splitId(basename(file).replace(/\.[^.]+$/, "")).code;
}

// Fills the placeholders of one text. Unknown names are passed to onUnknown
// and left as written. Names that `keep` claims, such as an interface
// string's parameters, stay as written even when a fact has the name.
export function fillText(text: string, facts: Facts, onUnknown: (name: string) => void, keep: (name: string) => boolean = () => false): string {
  return text.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (keep(name)) return placeholder;
    const value = facts.get(name);
    if (value === undefined) onUnknown(name);
    return value ?? placeholder;
  });
}

export function hasPlaceholder(text: string): boolean {
  return new RegExp(PLACEHOLDER.source).test(text);
}

export type PathPart = string | number;

// Which placeholders at a path stay as written: an interface string's
// parameters (site-kit-locales design D46).
export type KeepPlaceholder = (path: readonly PathPart[], name: string) => boolean;

type FillOptions = { onUnknown: (path: PathPart[], name: string) => void; skip: readonly string[]; keep: KeepPlaceholder };

// Fills every string in a value, leaving keys alone and skipping the
// top-level keys in `skip`.
function fillValue(value: unknown, facts: Facts, options: FillOptions, path: PathPart[]): unknown {
  if (typeof value === "string") {
    return fillText(value, facts, (name) => options.onUnknown(path, name), (name) => options.keep(path, name));
  }
  if (Array.isArray(value)) return value.map((item, i) => fillValue(item, facts, options, [...path, i]));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, path.length === 0 && options.skip.includes(key) ? item : fillValue(item, facts, options, [...path, key])]),
    );
  }
  return value;
}

// A schema that reads what the CMSs write as the content dialect
// (core/cms-values.ts), then fills placeholders, before `schema` validates.
// `getFacts` gets that input and the entry's locale, which its loader added
// under LOCALE_KEY (lib/locales.ts, withLocale), so the settings can fill
// from their own `facts`.
export function withFacts<S extends z.ZodType>(
  schema: S,
  getFacts: (input: unknown, locale: string | undefined) => Facts,
  skip: readonly string[] = [],
  keep: KeepPlaceholder = () => false,
) {
  return z.preprocess((raw, ctx) => {
    const { [LOCALE_KEY]: locale, ...rest } = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const input = fromCms(raw && typeof raw === "object" ? rest : raw);
    const code = typeof locale === "string" ? locale : undefined;
    const facts = getFacts(input, code);
    const onUnknown = (path: PathPart[], name: string) => ctx.addIssue({ code: "custom", path, message: unknownFact(name, facts, code), input });
    return fillValue(input, facts, { onUnknown, skip, keep }, []);
  }, schema);
}

// The Markdown plugin that fills placeholders in a body's text. Code spans
// and code blocks aren't text nodes, so they stay as written.
export const factsPlugin = {
  name: "site-kit-facts",
  text(node: { value: string }, ctx: { fileURL: URL | undefined; setProperty: (node: never, key: "value", value: string) => void }) {
    if (!hasPlaceholder(node.value)) return;
    const file = ctx.fileURL ? fileURLToPath(ctx.fileURL) : undefined;
    const locale = file ? localeOfFile(file) : undefined;
    const facts = readFacts(process.cwd(), locale);
    const where = file ? `${file.replace(`${process.cwd()}/`, "")}: ` : "";
    const value = fillText(node.value, facts, (name) => {
      throw new Error(`${where}${unknownFact(name, facts, locale)}`);
    });
    ctx.setProperty(node as never, "value", value);
  },
};
