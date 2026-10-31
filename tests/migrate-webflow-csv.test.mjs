// site-kit-fidelity-cms-stubs design D186: the migration skill's reader of
// Webflow's CSV exports, which step 6 and the fidelity check's fill use.
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { parseCsv, readCsv } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/csv.mjs";
import { PACKAGE, run } from "./helpers.mjs";

const SCRIPT = join(PACKAGE, "skills", "migrate-webflow", "scripts", "csv.mjs");
const BODY = `<p>Looms, then desks.</p>\r\n<p>A <a href="https://example.com/mill">"mill"</a>, rebuilt.</p>`;
// A byte-order mark, a header, quoted fields with a comma, doubled quotes and
// line breaks, an empty field, a row cut short, a blank line, and \r\n.
const CSV = `﻿Name,Slug,Summary,Main Image,Body\r\n"From Mill to Workspace, a History",from-mill,Looms and desks.,https://cdn.example.com/a_mill.jpeg,"${BODY.replaceAll('"', '""')}"\r\nThe Calendar,calendar,,,<p>Events.</p>\r\n\r\nShort Row,short\r\n`;

const dirs = [];
after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

describe("the CSV reader", () => {
  it("reads quoted fields with commas, doubled quotes and line breaks, by column name", () => {
    const { columns, rows } = parseCsv(CSV);
    assert.deepEqual(columns, ["Name", "Slug", "Summary", "Main Image", "Body"]);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].Name, "From Mill to Workspace, a History");
    assert.equal(rows[0].Body, BODY);
    assert.deepEqual(rows[1], { Name: "The Calendar", Slug: "calendar", Summary: "", "Main Image": "", Body: "<p>Events.</p>" });
    assert.deepEqual(rows[2], { Name: "Short Row", Slug: "short", Summary: "", "Main Image": "", Body: "" });
  });

  it("reads a file without a line break at its end", () => {
    assert.deepEqual(parseCsv("Name,Slug\nOne,one").rows, [{ Name: "One", Slug: "one" }]);
  });

  it("names a file cut short inside a quoted field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-csv-"));
    dirs.push(dir);
    await writeFile(join(dir, "cut.csv"), 'Name,Body\nOne,"<p>Cut');
    assert.throws(() => readCsv(join(dir, "cut.csv")), /cut\.csv: A quoted field doesn't end/);
  });

  it("prints each file's rows and columns, and the columns asked for, cut short", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-csv-"));
    dirs.push(dir);
    await writeFile(join(dir, "acme - Blog Posts - 64f1.csv"), CSV.replace(BODY.replaceAll('"', '""'), "x".repeat(250)));
    const summary = await run(process.execPath, [SCRIPT, "acme - Blog Posts - 64f1.csv"], { cwd: dir });
    assert.equal(summary.code, 0, summary.output);
    assert.equal(summary.output, "# acme - Blog Posts - 64f1.csv: 3 rows\nName (3), Slug (3), Summary (1), Main Image (1), Body (2)\n");
    const columns = await run(process.execPath, [SCRIPT, "acme - Blog Posts - 64f1.csv", "--columns", "Slug,Body"], { cwd: dir });
    assert.equal(columns.code, 0, columns.output);
    assert.match(columns.output, /^- Slug: from-mill \| Body: x{200}\.\.\. \(250 characters\)$/m);
    assert.match(columns.output, /^- Slug: calendar \| Body: <p>Events\.<\/p>$/m);
    const unknown = await run(process.execPath, [SCRIPT, "acme - Blog Posts - 64f1.csv", "--columns", "Author"], { cwd: dir });
    assert.equal(unknown.code, 1);
    assert.match(unknown.output, /has no column "Author"\. Its columns: Name, Slug, Summary, Main Image, Body\./);
  });
});
