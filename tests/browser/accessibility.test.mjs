// site-kit-webflow-migration task 2.10: the migration skill's accessibility
// script, on a small build. It lists the text and background pairs below WCAG
// 1.4.3's minimum, with a passing shade, and the other serious or critical
// violations, by page, for the report's notes. Playwright and axe-core come
// from the kit repository's own install, as --tools.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { contrastRatio } from "../../packages/site-kit-astro/scripts/check-styles.mjs";
import { PACKAGE, REPO } from "../helpers.mjs";

const SCRIPT = join(PACKAGE, "skills", "migrate-webflow", "scripts", "accessibility.mjs");
const page = (body) => `<!doctype html><html lang="en"><head><title>Page</title></head><body><main><h1>Title</h1>${body}</main></body></html>`;
const FILES = {
  "dist/index.html": page('<p style="color: #999999">Grey text</p><img src="/photo.png">'),
  "dist/about/index.html": page('<p style="color: #999999">More grey text</p>'),
  "dist/contact/index.html": page("<p>Black text</p>"),
  "pages.txt": "# export file, build path\nindex.html /\nabout.html /about\ncontact.html /contact\n",
};
const ARGS = ["--tools", REPO, "--build", "dist", "--pages", "pages.txt", "--out", "shots/accessibility.json"];

function run(dir, args) {
  return promisify(execFile)(process.execPath, [SCRIPT, ...args], { cwd: dir }).then(
    (result) => ({ ok: true, ...result }),
    (error) => ({ ok: false, stdout: error.stdout, stderr: error.stderr }),
  );
}

describe("accessibility script", () => {
  let dir;
  let result;
  let report;
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "accessibility-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    result = await run(dir, ARGS);
    if (result.ok) report = JSON.parse(await readFile(join(dir, "shots", "accessibility.json"), "utf8"));
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("lists a pair below the minimum once, with its pages and a shade of its hue that passes", () => {
    assert.ok(result.ok, result.stderr);
    assert.equal(report.contrast.length, 1);
    const [pair] = report.contrast;
    assert.deepEqual({ ...pair, shade: undefined, example: undefined }, { text: "#999999", background: "#ffffff", ratio: 2.84, minimum: 4.5, pages: ["/", "/about"], elements: 2, shade: undefined, example: undefined });
    assert.ok(contrastRatio(pair.shade, "#ffffff") >= 4.5, `${pair.shade} doesn't pass`);
    assert.match(pair.shade, /^#([0-9a-f]{2})\1\1$/, `${pair.shade} isn't a grey, as #999999 is`);
    assert.match(result.stdout, /Contrast below WCAG 1\.4\.3 \(AA\): #999999 on #ffffff, 2\.84:1 where 4\.5:1 is the minimum, on 2 pages \(\/, \/about\), 2 elements\. The nearest shade of the text's color that meets it: #[0-9a-f]{6}\./);
  });

  it("lists every other serious or critical rule, with its pages", () => {
    assert.deepEqual(report.violations, [{ rule: "image-alt", impact: "critical", help: "Images must have alternative text", pages: ["/"], elements: 1 }]);
    assert.match(result.stdout, /axe-core's image-alt \(critical\): Images must have alternative text, on 1 page \(\/\), 1 element\./);
  });

  it("ends with what it checked and where the notes go", () => {
    assert.match(result.stdout.trim().split("\n").at(-1), /^Checked 3 pages at 1440 px, under reduced motion: 1 contrast pairs, 1 other rules\. Each finding the old design brings is a note in the report's "Accessibility"/);
  });

  it("checks the pages with their motion played on a site that ignores reduced motion", async () => {
    const played = await run(dir, [...ARGS, "--reduced-motion", "ignore"]);
    assert.ok(played.ok, played.stderr);
    assert.match(played.stdout, /with their motion played, as the site ignores reduced motion/);
  });

  it("stops when its tools aren't in --tools", async () => {
    await writeFile(join(dir, "package.json"), "{}");
    const empty = await run(dir, ["--tools", dir, ...ARGS.slice(2)]);
    assert.equal(empty.ok, false);
    assert.match(empty.stderr, /Playwright isn't installed in/);
  });
});
