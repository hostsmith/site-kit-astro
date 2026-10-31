#!/usr/bin/env node
// The section types' props (site-kit-migration-cost design D147), so the
// agent reads the types it needs, never the kit's whole schema.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/props.mjs
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/props.mjs hero tabs
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/props.mjs settings
//
// It reads .hostsmith/schema.json, which `npx site-kit schema` writes, so the
// site's own types and collections are in it once that has run. Without
// names, it prints every section type on one line, with its props. With
// names, it prints each section type's props in full, then its hooks from the
// kit's HOOKS.md, and each collection's fields, such as the settings', with
// the header's actions and the footer's blocks. A * marks a required prop,
// and a list of choices marks its default.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { UsageError } from "./browser.mjs";

const SCHEMA = ".hostsmith/schema.json";
const HOOKS = new URL("../../../HOOKS.md", import.meta.url);

const sectionsOf = (schema) => schema.collections?.pages?.fields?.properties?.sections?.items?.oneOf ?? [];
const typeOf = (section) => section.properties?.type?.const;
const alternatives = (schema) => schema.oneOf ?? schema.anyOf;

/** What a value holds, in a few words, such as "text" or "a | b (default)". */
export function kindOf(schema) {
  if (schema.enum) return schema.enum.map((value) => (value === schema.default ? `${value} (default)` : value)).join(" | ");
  if (schema.const !== undefined) return JSON.stringify(schema.const);
  if (alternatives(schema)) return alternatives(schema).map(kindOf).join(" or ");
  const widget = schema["x-widget"];
  if (schema.type === "string") {
    if (widget === "image" || widget === "file" || /assets/.test(schema.pattern ?? "")) return "/assets/ path";
    if (widget === "link") return "link";
    if (widget === "markdown") return "markdown";
    if (widget === "datetime" || /\\d\{4\}/.test(schema.pattern ?? "")) return "date";
    return "text";
  }
  if (schema.type === "number" || schema.type === "integer") {
    const range = [schema.minimum, schema.maximum].some((value) => value !== undefined) ? ` ${schema.minimum ?? ""}-${schema.maximum ?? ""}` : "";
    return `${schema.type === "integer" ? "whole number" : "number"}${range}${schema.default !== undefined ? ` (default ${schema.default})` : ""}`;
  }
  if (schema.type === "boolean") return `true | false${schema.default !== undefined ? ` (default ${schema.default})` : ""}`;
  if (schema.type === "array") {
    const count = schema.minItems !== undefined || schema.maxItems !== undefined ? ` of ${schema.minItems ?? 0}${schema.maxItems !== undefined ? `-${schema.maxItems}` : " or more"}` : "";
    return `list${count}`;
  }
  if (schema.type === "object") return "object";
  return schema.type ?? "any";
}

// The lines of an object's props, at `depth`, with what each list or object
// holds below it.
function propsLines(schema, depth, skip = []) {
  const indent = "  ".repeat(depth);
  const required = new Set(schema.required ?? []);
  const lines = [];
  for (const [name, prop] of Object.entries(schema.properties ?? {})) {
    if (skip.includes(name)) continue;
    lines.push(`${indent}${name}${required.has(name) ? "*" : ""}: ${kindOf(prop)}`);
    lines.push(...holds(prop, depth + 1));
  }
  return lines;
}

// What a list's items or an object's props are, below its line.
function holds(schema, depth) {
  const indent = "  ".repeat(depth);
  const items = schema.type === "array" ? schema.items : schema;
  if (!items) return [];
  const choices = alternatives(items);
  if (choices && choices.every((choice) => choice.properties?.type?.const)) {
    return choices.flatMap((choice) => [`${indent}type "${choice.properties.type.const}":`, ...propsLines(choice, depth + 1, ["type"])]);
  }
  if (items.type === "object") return propsLines(items, depth);
  if (schema.type === "array") return [`${indent}each: ${kindOf(items)}`];
  return [];
}

// A section type's hooks, from HOOKS.md's "### <type>".
function hooksOf(type) {
  if (!existsSync(HOOKS)) return [];
  const text = readFileSync(HOOKS, "utf8");
  const start = text.indexOf(`\n### ${type}\n`);
  if (start === -1) return [];
  const rest = text.slice(start + 1);
  const end = rest.slice(4).search(/\n#{2,3} /);
  return rest.slice(0, end === -1 ? undefined : end + 4).trim().split("\n").slice(1);
}

/** What `names` ask for, from the schema, as text. */
export function props(schema, names = []) {
  const sections = sectionsOf(schema);
  if (sections.length === 0) throw new UsageError(`${SCHEMA} has no section types. Run \`npx site-kit schema\` first.`);
  // The props every section has alike, required or not alike too.
  const first = sections[0];
  const alike = (name, section) => JSON.stringify(section.properties[name]) === JSON.stringify(first.properties[name]) && (section.required ?? []).includes(name) === (first.required ?? []).includes(name);
  const shared = Object.keys(first.properties).filter((name) => name === "type" || sections.every((section) => name in section.properties && alike(name, section)));
  if (names.length === 0) {
    const lines = [`Every section: ${shared.map((name) => `${name}${(first.required ?? []).includes(name) ? "*" : ""}${first.properties[name].enum ? ` (${kindOf(first.properties[name])})` : ""}`).join(", ")}`, ""];
    for (const section of sections) {
      const required = new Set(section.required ?? []);
      const own = Object.keys(section.properties).filter((name) => !shared.includes(name));
      lines.push(`${typeOf(section)}: ${own.map((name) => `${name}${required.has(name) ? "*" : ""}`).join(", ")}`);
    }
    lines.push("", "Name types for their props in full and their hooks, or `settings` for the settings' fields.");
    return `${lines.join("\n")}\n`;
  }
  const out = [];
  for (const name of names) {
    const section = sections.find((candidate) => typeOf(candidate) === name);
    const collection = schema.collections?.[name];
    if (section) {
      out.push(`## ${name}`, `Every section's: ${shared.join(", ")}`, ...propsLines(section, 0, shared));
      const hooks = hooksOf(name);
      if (hooks.length) out.push("", "Hooks (HOOKS.md):", ...hooks);
    }
    // A collection may share a type's name, such as team.
    if (collection) {
      if (section) out.push("");
      out.push(`## ${name} (${collection.path})`, ...propsLines(collection.fields, 0));
    }
    if (!section && !collection) {
      out.push(`## ${name}`, `No section type or collection is named ${name}. The types: ${sections.map(typeOf).join(", ")}. The collections: ${Object.keys(schema.collections ?? {}).join(", ")}.`);
    }
    out.push("");
  }
  return `${out.join("\n").trim()}\n`;
}

function main({ values, positionals }) {
  const file = values.schema ?? SCHEMA;
  if (!existsSync(file)) throw new UsageError(`${file} doesn't exist. Run \`npx site-kit schema\` in the site's folder first.`);
  process.stdout.write(props(JSON.parse(readFileSync(file, "utf8")), positionals));
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(parseArgs({ allowPositionals: true, options: { schema: { type: "string" } } }));
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
