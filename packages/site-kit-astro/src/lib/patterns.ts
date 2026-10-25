// A collection's title, description and Open Graph patterns
// (site-kit-webflow-migration design D134), as Webflow's Collection templates
// have them. A site writes each as its own interface string, named after the
// collection, with the entry's fields it shows as parameters:
//
//   postsPageTitle: uiString({ params: ["title"] }),   // siteUi, src/site.schema.ts
//   postsPageTitle: "{title} | Acme"                   // ui, each locale's settings
//
// <collection>PageTitle and <collection>PageDescription set an entry page's
// <title> and meta description, and <collection>OgTitle and
// <collection>OgDescription its Open Graph title and description, which
// otherwise follow the first two. `title` fills as the plain title, a date as
// the locale writes it, and an empty field as nothing. The kit checks at
// build time that each parameter is a field of the collection (kit-content.ts).
/// <reference path="../../virtual.d.ts" />
import * as siteSchema from "virtual:site-kit/site-schema";
import { getSettings } from "./settings.ts";
import { plainTitle } from "./title.ts";
import { getUi, type UiValues } from "./ui.ts";

export const PATTERNS = { title: "PageTitle", description: "PageDescription", ogTitle: "OgTitle", ogDescription: "OgDescription" } as const;

export type EntryHead = Partial<Record<keyof typeof PATTERNS, string>>;

// A date field's value, as the kit's isoDate schema leaves it.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/;

// The head of an entry's page from its collection's patterns: only the parts
// the site declares a pattern for.
export async function entryHead(collection: string, data: Record<string, unknown>, locale?: string): Promise<EntryHead> {
  const declared = siteSchema.siteUi ?? {};
  const kinds = (Object.keys(PATTERNS) as (keyof typeof PATTERNS)[]).filter((kind) => Object.hasOwn(declared, `${collection}${PATTERNS[kind]}`));
  if (kinds.length === 0) return {};
  const ui = await getUi(locale);
  const dates = new Intl.DateTimeFormat((await getSettings(locale)).language, { dateStyle: "long", timeZone: "UTC" });
  const valueOf = (name: string): string | number => {
    const value = data[name];
    if (name === "title") return plainTitle(String(value));
    if (typeof value === "number") return value;
    if (typeof value === "string") return ISO_DATE.test(value) ? dates.format(new Date(value)) : value;
    return value === undefined || value === null ? "" : String(value);
  };
  const head: EntryHead = {};
  for (const kind of kinds) {
    const key = `${collection}${PATTERNS[kind]}`;
    const values: UiValues = Object.fromEntries((declared[key].params ?? []).map((name) => [name, valueOf(name)]));
    head[kind] = ui.text(key, values);
  }
  return head;
}
