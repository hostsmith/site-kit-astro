// site-core, "Text coverage check": `site-kit check-fields` on small pages,
// on the `basics` example and on the core fixture (site-kit-core-split design
// D81).
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { checkFields, pageCoverage } from "../packages/site-kit-astro/scripts/core/check-fields.mjs";
import { assertBuilt, buildCoreSite, buildFixture, siteKit } from "./helpers.mjs";

const page = (body, head = "<title>Page</title>") => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const text = (length) => "x".repeat(length);

describe("a page's coverage", () => {
  it("is the share of its visible text inside data-field elements", () => {
    const html = page(`<h1 data-field="copy/home#title">${text(100)}</h1><p><span data-field="copy/home#intro">${text(50)}</span>${text(50)}</p>`);
    assert.deepEqual(pageCoverage(html), { covered: 150, total: 200 });
  });

  it("leaves out a data-field-ignore subtree", () => {
    const html = page(`<p data-field="a#b">${text(10)}</p><footer data-field-ignore><p>© 2026 Corner Bakery</p></footer>`);
    assert.deepEqual(pageCoverage(html), { covered: 10, total: 10 });
  });

  it("leaves out hidden and aria-hidden text", () => {
    const html = page(`<p data-field="a#b">${text(10)}</p><p hidden>${text(7)}</p><span aria-hidden="true">${text(5)}</span><span aria-hidden="false">abc</span>`);
    assert.deepEqual(pageCoverage(html), { covered: 10, total: 13 });
  });

  it("leaves out the head, script, style, noscript and template", () => {
    const html = page(`<p>${text(4)}</p><script>let a = 1;</script><style>p { color: red }</style><noscript>No script</noscript><template><p>Later</p></template>`, "<title>A long title</title><meta name=x>");
    assert.deepEqual(pageCoverage(html), { covered: 0, total: 4 });
  });

  it("counts a run of whitespace as one, without leading and trailing whitespace, and an entity as its character", () => {
    // "Fresh bread and rye & more ©": 28 characters.
    const html = page(`<p data-field="a#b">\n   Fresh   bread\n   and&nbsp;rye &amp; more &#169;  </p>`);
    assert.deepEqual(pageCoverage(html), { covered: 28, total: 28 });
  });

  it("is nothing for a page without text", () => {
    assert.deepEqual(pageCoverage(page("<img src=/a.png alt=''>")), { covered: 0, total: 0 });
  });
});

describe("site-kit check-fields", () => {
  const dirs = [];
  after(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true, force: true }))));

  // A site whose build output holds these pages, by path under dist/.
  async function siteWith(pages) {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-fields-"));
    dirs.push(dir);
    for (const [path, html] of Object.entries(pages)) {
      await mkdir(dirname(join(dir, "dist", path)), { recursive: true });
      await writeFile(join(dir, "dist", path), html);
    }
    return dir;
  }
  const PAGES = {
    "index.html": page(`<h1 data-field="a#b">${text(90)}</h1><p>${text(10)}</p>`),
    "about/index.html": page(`<h1 data-field="a#c">${text(74)}</h1><p>${text(26)}</p>`),
    "empty.html": page(""),
  };

  it("reports each page, lowest first, a page without text last, and the site over all its text", async () => {
    const result = checkFields(join(await siteWith(PAGES), "dist"));
    assert.deepEqual(result, {
      overall: { covered: 164, total: 200, percent: 82 },
      pages: [
        { path: "/about", covered: 74, total: 100, percent: 74 },
        { path: "/", covered: 90, total: 100, percent: 90 },
        { path: "/empty", covered: 0, total: 0, percent: null },
      ],
    });
  });

  it("fails below --min, printing the coverage and the pages below it", async () => {
    const result = await siteKit(await siteWith(PAGES), ["check-fields", "--min", "90"]);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /Field coverage: 82% of 200 characters/);
    assert.match(result.output, /Field coverage is 82%, below --min 90\. Pages below 90%: \/about\./);
  });

  it("passes at --min or above", async () => {
    const result = await siteKit(await siteWith(PAGES), ["check-fields", "--min", "80"]);
    assert.equal(result.code, 0, result.output);
  });

  it("prints the report as JSON", async () => {
    const result = await siteKit(await siteWith(PAGES), ["check-fields", "--json"]);
    assert.equal(result.code, 0, result.output);
    const report = JSON.parse(result.output);
    assert.deepEqual(report.overall, { covered: 164, total: 200, percent: 82 });
    assert.deepEqual(Object.keys(report.pages[0]), ["path", "covered", "total", "percent"]);
  });

  it("fails without a build output", async () => {
    const result = await siteKit(await siteWith({}), ["check-fields"]);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /No build output in dist\/\. Build the site first\./);
  });

  it("reports a kit site's pages, which the kit binds", async () => {
    const build = await buildFixture(null);
    dirs.push(build.dir);
    assertBuilt(build);
    const result = await siteKit(build.dir, ["check-fields", "--json"]);
    assert.equal(result.code, 0, result.output);
    const report = JSON.parse(result.output);
    assert.ok(report.pages.some((p) => p.path === "/about"), "no /about page");
    assert.ok(report.overall.percent >= 90, `basics covers ${report.overall.percent}%`);
  });

  it("passes --min 90 in the core fixture", async () => {
    const build = await buildCoreSite();
    dirs.push(build.dir);
    assertBuilt(build);
    const result = await siteKit(build.dir, ["check-fields", "--min", "90"]);
    assert.equal(result.code, 0, result.output);
  });
});
