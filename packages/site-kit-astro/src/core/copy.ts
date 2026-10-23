// Page copy for a site with its own pages (site-kit-core-split design D77,
// D85). The copy a page used to hard-code moves into one YAML file per page in
// src/content/copy/, each page with its own schema, so the CMS can edit it:
//
//   // src/content.config.ts
//   import { pageCopy } from "@hostsmith/site-kit-astro/copy";
//   export const copy = pageCopy({
//     home: z.strictObject({ hero: z.strictObject({ title: z.string().min(1) }) }),
//   });
//   export const collections = { news, copy: copy.collection };
//
//   // src/pages/index.astro
//   const home = await copy.get("home");
//   const f = copy.fields("home");
//   <h1 {...f("hero.title")}>{home.hero.title}</h1>
//
// With `content.locales` in hostsmith.json, each file holds every locale's
// copy under its code, and get() and fields() take a locale, the default
// one without it.
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { defineCollection, getEntry } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { version } from "../../package.json";
import { fromCms } from "./cms-values.ts";
import { type FieldAttrs, fieldsFor, formatPath, type PathPart } from "./field.ts";

/// <reference path="../../virtual.d.ts" />
type Locales = { default: string; codes: string[] } | null;

// The core's integration gives the manifest's locales. Without it, the
// import fails, and the message says what to add.
const { locales }: { locales: Locales } = await import("virtual:site-kit/core").catch(() => {
  throw new Error('pageCopy() needs the core\'s integration: add siteKitCore() from "@hostsmith/site-kit-astro/core" to the integrations in astro.config.mjs.');
});

const COLLECTION = "copy";

export type PageCopyOptions = {
  // The folder with the copy files, relative to the site's root.
  base?: string;
};

export function pageCopy<const S extends Record<string, z.ZodType>>(schemas: S, { base = "src/content/copy" }: PageCopyOptions = {}) {
  const pages = Object.keys(schemas);
  if (pages.length === 0) throw new Error("pageCopy() needs at least one page's schema.");

  // A page's file holds its copy, or, with locales, each locale's under its code.
  const fileSchema = (schema: z.ZodType) => (locales ? z.strictObject(Object.fromEntries(locales.codes.map((code) => [code, schema]))) : schema);
  // Each branch names its page, so the schema export lists `copy` as files.
  const branches = pages.map((page) => fileSchema(schemas[page]).meta({ "x-file": page }));
  const schema = z.union(branches as [z.ZodType, ...z.ZodType[]]);

  const inner = glob({ pattern: "*.yml", base: `./${base}` });
  const loader = {
    name: "@hostsmith/site-kit-astro/copy",
    load: async (context: Parameters<typeof inner.load>[0]) => {
      // glob() skips a file it has seen unchanged, so a kit update that
      // checks copy differently starts again.
      if (context.meta.get("version") !== version) {
        context.store.clear();
        context.meta.set("version", version);
      }
      const root = fileURLToPath(context.config.root);
      const parseData: typeof context.parseData = async ({ id, data, filePath }) => {
        const file = filePath ? relative(root, filePath) : `${base}/${id}.yml`;
        const pageSchema = schemas[id];
        if (!pageSchema) throw new Error(`${file}: no page "${id}" is declared in pageCopy(). Declare it, or remove the file.`);
        return parseCopy(file, pageSchema, fromCms(data)) as typeof data;
      };
      await inner.load({ ...context, parseData });
      for (const page of pages) {
        if (!context.store.has(page)) throw new Error(`Page "${page}" is declared in pageCopy(), but ${base}/${page}.yml doesn't exist.`);
      }
    },
  };

  // The locale a reader asked for, or the default one.
  const localeOf = (page: string, locale: string | undefined) => {
    if (!locales) return undefined;
    const code = locale ?? locales.default;
    if (!locales.codes.includes(code)) throw new Error(`copy.get("${page}") got the locale "${code}". The site's locales are ${locales.codes.join(", ")}.`);
    return code;
  };

  return {
    collection: defineCollection({ loader, schema }),

    // One page's copy, in one locale.
    async get<P extends keyof S & string>(page: P, locale?: string): Promise<z.output<S[P]>> {
      const code = localeOf(page, locale);
      const entry = await getEntry(COLLECTION as never, page).catch(() => undefined);
      if (!entry) throw new Error(`No copy for page "${page}". Register the collection as "${COLLECTION}": collections = { ${COLLECTION}: copy.collection }.`);
      const data = (entry as { data: Record<string, unknown> }).data;
      return (code ? data[code] : data) as z.output<S[P]>;
    },

    // Field attributes for one page's copy: `data-field="copy/home#hero.title"`,
    // with the locale code first in a site with locales.
    fields(page: keyof S & string, locale?: string): (...path: PathPart[]) => FieldAttrs {
      const code = localeOf(page, locale);
      const f = fieldsFor(COLLECTION, page);
      return code ? (...path) => f(code, ...path) : f;
    },
  };
}

// A file's copy, checked against its page's schema, per locale with locales.
function parseCopy(file: string, schema: z.ZodType, value: unknown): unknown {
  if (!locales) return check(file, schema, value, []);
  const data = (value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>;
  for (const key of Object.keys(data)) {
    if (!locales.codes.includes(key)) throw new Error(`${file}: "${key}" isn't one of the site's locales (${locales.codes.join(", ")}).`);
  }
  return Object.fromEntries(
    locales.codes.map((code) => {
      if (!(code in data)) throw new Error(`${file}: no copy for the locale "${code}". The file holds each locale's copy under its code (${locales.codes.join(", ")}).`);
      return [code, check(file, schema, data[code], [code])];
    }),
  );
}

function check(file: string, schema: z.ZodType, value: unknown, prefix: PathPart[]): unknown {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const path = formatPath([...prefix, ...(issue.path as PathPart[])]);
  throw new Error(`${file}: ${path ? `${path}: ` : ""}${issue.message}`);
}
