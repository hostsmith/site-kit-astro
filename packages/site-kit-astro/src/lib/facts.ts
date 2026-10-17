// Facts (site-kit-design-system design D35): business facts that appear in
// several places, such as a phone number, live once in the settings' `facts`
// list, and any text in the content writes them as `{name}`. The kit knows no
// fact names: the site picks them.
//
// Frontmatter and settings are filled before their schemas check them, so a
// filled value is validated like a written one. Markdown bodies are filled by
// `factsPlugin`, a plugin of the kit's Markdown processor, which leaves code
// alone. An unknown name fails the build.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "astro/zod";
import { parse } from "yaml";

export type Facts = ReadonlyMap<string, string>;

export const FACT_NAME = /^[a-z][a-zA-Z0-9]*$/;
const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g;
const SETTINGS_FILE = join("src", "content", "settings", "site.yml");

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

let cached: { mtimeMs: number; facts: Facts } | undefined;

// The facts of the site's settings file. Other collections are validated
// apart from the settings collection, so the kit reads the file itself. A
// missing or broken file gives no facts: the settings collection reports it.
export function readFacts(root = process.cwd()): Facts {
  const file = join(root, SETTINGS_FILE);
  try {
    const { mtimeMs } = statSync(file);
    if (cached?.mtimeMs !== mtimeMs) cached = { mtimeMs, facts: factsFrom(parse(readFileSync(file, "utf8"))?.facts) };
    return cached.facts;
  } catch {
    return new Map();
  }
}

export function unknownFact(name: string, facts: Facts): string {
  const defined = facts.size > 0 ? `The facts are ${[...facts.keys()].map((n) => `{${n}}`).join(", ")}.` : "The settings have no facts.";
  return `unknown fact "{${name}}". ${defined} Add it to "facts" in ${SETTINGS_FILE}, or fix the name.`;
}

// Fills the placeholders of one text. Unknown names are passed to onUnknown
// and left as written.
export function fillText(text: string, facts: Facts, onUnknown: (name: string) => void): string {
  return text.replace(PLACEHOLDER, (placeholder, name: string) => {
    const value = facts.get(name);
    if (value === undefined) onUnknown(name);
    return value ?? placeholder;
  });
}

export function hasPlaceholder(text: string): boolean {
  return new RegExp(PLACEHOLDER.source).test(text);
}

type PathPart = string | number;

// Fills every string in a value, leaving keys alone and skipping the
// top-level keys in `skip`.
function fillValue(value: unknown, facts: Facts, onUnknown: (path: PathPart[], name: string) => void, path: PathPart[], skip: readonly string[]): unknown {
  if (typeof value === "string") return fillText(value, facts, (name) => onUnknown(path, name));
  if (Array.isArray(value)) return value.map((item, i) => fillValue(item, facts, onUnknown, [...path, i], skip));
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, path.length === 0 && skip.includes(key) ? item : fillValue(item, facts, onUnknown, [...path, key], skip)]),
    );
  }
  return value;
}

// A schema that fills placeholders before `schema` validates. `getFacts`
// gets the raw input, so the settings can fill from their own `facts`.
export function withFacts<S extends z.ZodType>(schema: S, getFacts: (input: unknown) => Facts, skip: readonly string[] = []) {
  return z.preprocess((input, ctx) => {
    const facts = getFacts(input);
    return fillValue(input, facts, (path, name) => ctx.addIssue({ code: "custom", path, message: unknownFact(name, facts), input }), [], skip);
  }, schema);
}

// The Markdown plugin that fills placeholders in a body's text. Code spans
// and code blocks aren't text nodes, so they stay as written.
export const factsPlugin = {
  name: "site-kit-facts",
  text(node: { value: string }, ctx: { fileURL: URL | undefined; setProperty: (node: never, key: "value", value: string) => void }) {
    if (!hasPlaceholder(node.value)) return;
    const facts = readFacts();
    const where = ctx.fileURL ? `${fileURLToPath(ctx.fileURL).replace(`${process.cwd()}/`, "")}: ` : "";
    const value = fillText(node.value, facts, (name) => {
      throw new Error(`${where}${unknownFact(name, facts)}`);
    });
    ctx.setProperty(node as never, "value", value);
  },
};
