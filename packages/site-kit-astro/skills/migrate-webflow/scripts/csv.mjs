#!/usr/bin/env node
// The Webflow migration's CSV reader (site-kit-fidelity-cms-stubs design
// D186): a CMS collection's CSV export as rows by column name, for step 6 and
// the fidelity check's fill.
//
//   node node_modules/@hostsmith/site-kit-astro/skills/migrate-webflow/scripts/csv.mjs \
//     ".hostsmith/snapshot/cms/acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv" [--columns Slug,Author]
//
// For each file, it prints its number of rows and its columns, each with how
// many rows have a value in it. With --columns, it prints those columns of
// every row too, a value longer than 200 characters cut short, with its
// length. A script of the migration imports readCsv() from this file instead.
//
// Webflow writes the header row first, then a row per item. A field is in
// double quotes when it holds a comma, a double quote, written twice, or a
// line break, as a rich text field's HTML does. A byte-order mark at the
// start is dropped, and a line ends with \n or \r\n. It reads the files as
// text and runs nothing.
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { UsageError } from "./browser.mjs";

const SHOWN_LENGTH = 200;

/**
 * A CSV export's text as its `columns`, from the header row, and its `rows`,
 * each an object of its values by column name, "" where a row has none.
 */
export function parseCsv(text) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += char;
  }
  if (quoted) throw new Error("A quoted field doesn't end: the file is cut short.");
  if (field || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [columns = [], ...rest] = records.filter((values) => values.length > 1 || values[0] !== "");
  return { columns, rows: rest.map((values) => Object.fromEntries(columns.map((column, i) => [column, values[i] ?? ""]))) };
}

/** The CSV export in `file`, as parseCsv() gives it. */
export function readCsv(file) {
  try {
    return parseCsv(readFileSync(file, "utf8"));
  } catch (error) {
    throw new UsageError(`${file}: ${error.code === "ENOENT" ? "no such file" : error.message}`);
  }
}

// A value on one line, cut short when it's long.
function shown(value) {
  const line = value.replace(/\s+/g, " ").trim();
  return line.length > SHOWN_LENGTH ? `${line.slice(0, SHOWN_LENGTH)}... (${value.length} characters)` : line;
}

function main(args) {
  const { values, positionals: files } = parseArgs({ args, allowPositionals: true, options: { columns: { type: "string" } } });
  if (files.length === 0) throw new UsageError("Name the CSV exports, such as \".hostsmith/snapshot/cms/acme - Blog Posts - 64f1a2b3c4d5e6f708192a3b.csv\". See the usage at the top of this script.");
  const wanted = values.columns?.split(",").map((column) => column.trim()).filter(Boolean);
  const lines = [];
  for (const file of files) {
    const { columns, rows } = readCsv(file);
    const unknown = (wanted ?? []).filter((column) => !columns.includes(column));
    if (unknown.length > 0) throw new UsageError(`${file} has no column ${unknown.map((column) => `"${column}"`).join(", ")}. Its columns: ${columns.join(", ")}.`);
    lines.push(`# ${basename(file)}: ${rows.length} rows`);
    lines.push(columns.map((column) => `${column} (${rows.filter((row) => row[column] !== "").length})`).join(", "));
    for (const row of wanted ? rows : []) lines.push(`- ${wanted.map((column) => `${column}: ${shown(row[column])}`).join(" | ")}`);
    lines.push("");
  }
  process.stdout.write(lines.join("\n"));
}

// Run as a command, last, so every helper above is defined.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof UsageError ? error.message : error);
    process.exitCode = 1;
  }
}
