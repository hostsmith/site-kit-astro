// site-kit-webflow-migration design D166: the migration skill's content
// check, each export page against its build page, as HTML.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { compare, contentOf, linkKey } from "../packages/site-kit-astro/skills/migrate-webflow/scripts/content.mjs";
import { PACKAGE } from "./helpers.mjs";

const SCRIPT = join(PACKAGE, "skills", "migrate-webflow", "scripts", "content.mjs");
const page = (body) => `<!doctype html><html><head><title>About</title><script>var x = "not text";</script></head><body>${body}</body></html>`;

const EXPORT = page(`
  <nav><a href="index.html">Home</a><a href="about.html">About</a></nav>
  <h1>A 1920s woolen mill, <span class="text-color">back at work</span>.</h1>
  <p>The mill went up in the 1920s on the bank of the river.</p>
  <p>We brought it back one floor at a time.</p>
  <p>Its members come from all over the valley.</p>
  <img src="images/desk.jpg" alt="A long wooden table by the windows">
  <a href="pricing.html">See the plans</a>
  <a href="https://www.instagram.com/cobbleford/">Instagram</a>
  <a href="mailto:Hello@Cobbleford.example">Email us</a>
  <div class="w-dyn-list"><div class="w-dyn-empty"><div>No items found.</div></div></div>
  <div class="w-form"><form><label>Your name and your email address</label></form><div class="w-form-done">Thank you for your message to us</div></div>
  <div class="w-condition-invisible">Shown only when the item has a photo</div>
  <div class="w-embed"><style>.x { color: red; }</style></div>
  <a href="#" class="w-webflow-badge">Made in Webflow</a>`);

const BUILD = page(`
  <header><a href="/">Home</a><a href="/about">About</a></header>
  <main>
    <h1>A 1920s woolen mill, <span class="sk-highlight">back at work</span>.</h1>
    <p>Its members come from all over the valley.</p>
    <p>The mill went up in the 1920s on the bank of the river.</p>
    <img src="/assets/images/desk.jpg" alt="A wooden table">
    <a href="https://www.instagram.com/cobbleford">Instagram</a>
    <a href="mailto:hello@cobbleford.example">Email us</a>
  </main>`);

describe("content check", () => {
  it("reads a page's texts, links and alt texts, as written, without what the export can't show", () => {
    const content = contentOf(EXPORT, { exported: true });
    assert.ok(content.texts.includes("We brought it back one floor at a time."));
    for (const left of ["not text", "No items found.", "Your name and your email address", "Thank you for your message to us", "Shown only when the item has a photo", "Made in Webflow"]) {
      assert.ok(!content.texts.includes(left), `"${left}" was read`);
    }
    assert.deepEqual(content.alts, ["A long wooden table by the windows"]);
  });

  it("keys a link by its clean path, its host and path, or its address", () => {
    assert.equal(linkKey("about.html", "index.html"), "/about");
    assert.equal(linkKey("../index.html", "services/painting.html"), "/");
    assert.equal(linkKey("painting.html#quote", "services/index.html"), "/services/painting");
    assert.equal(linkKey("/about/", "/"), "/about");
    assert.equal(linkKey("https://www.Instagram.com/cobbleford/", "/"), "www.instagram.com/cobbleford");
    assert.equal(linkKey("mailto:Hello@Cobbleford.example?subject=Hi", "/"), "mailto:hello@cobbleford.example");
    assert.equal(linkKey("tel:(218) 555-0142", "/"), "tel:2185550142");
    assert.equal(linkKey("#", "/"), null);
  });

  it("lists the texts, links and alt texts the build lacks, and a text in another order", () => {
    const gaps = compare(contentOf(EXPORT, { exported: true }), contentOf(BUILD), { exportFile: "about.html", buildPath: "/about" });
    assert.deepEqual(gaps, {
      missing: ["We brought it back one floor at a time.", "See the plans"],
      outOfOrder: ["Its members come from all over the valley."],
      links: ["/pricing"],
      alts: ["A long wooden table by the windows"],
    });
  });

  describe("as a command", () => {
    let dir;
    let result;
    before(async () => {
      dir = await mkdtemp(join(tmpdir(), "content-check-"));
      const files = { "export/about.html": EXPORT, "export/index.html": page("<p>Welcome to the mill by the river.</p>"), "dist/about/index.html": BUILD, "dist/index.html": page("<p>Welcome to the mill by the river.</p>"), "pages.txt": "# export file, build path\nindex.html /\nabout.html /about\ncontact.html /contact\n" };
      for (const [path, text] of Object.entries(files)) {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await writeFile(join(dir, path), text);
      }
      result = await promisify(execFile)(process.execPath, [SCRIPT, "--export", "export", "--build", "dist", "--pages", "pages.txt", "--out", "shots/content.json"], { cwd: dir });
    });
    after(() => rm(dir, { recursive: true, force: true }));

    it("writes each page's gaps, and says which pages have them", async () => {
      const report = JSON.parse(await readFile(join(dir, "shots", "content.json"), "utf8"));
      assert.deepEqual(report.pages.map((p) => [p.build, p.error ?? p.missing.length]), [["/", 0], ["/about", 2], ["/contact", "the export has no contact.html"]]);
      assert.match(result.stdout, /^\/about \(about\.html\): 2 texts missing, such as "We brought it back one floor at a time\.", "See the plans"; 1 in another order, such as "Its members come from all over the valley\."; 1 links missing: \/pricing; 1 alt texts missing, such as "A long wooden table by the windows"\.$/m);
      assert.match(result.stdout, /^\/contact: the export has no contact\.html\.$/m);
      assert.match(result.stdout.trim().split("\n").at(-1), /^Checked the content of 3 pages: 2 with gaps\. Fix each gap before the fidelity review/);
    });
  });
});
