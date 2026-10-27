// site-kit-webflow-migration design D117: the migration skill's fidelity
// script, on a small export and build. It screenshots each page of both at
// Webflow's four widths, renders the export without scripts and the build with
// them, both under reduced motion, adds the site's fonts to the export's pages
// only, answers other hosts with nothing, and lists the pages that 404.
// Playwright comes from the kit repository's own install, as --tools.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { PACKAGE, REPO } from "../helpers.mjs";

const SCRIPT = join(PACKAGE, "skills", "migrate-webflow", "scripts", "fidelity.mjs");
const WIDTHS = [479, 767, 991, 1440];

// The script grows a page to 4000 px, and reduced motion another 2000 px.
const grow = `<div id="grow"></div><script>document.getElementById("grow").style.height = "4000px";</script>`;
const motion = `<style>@media (prefers-reduced-motion: reduce) { .motion { height: 2000px; } }</style><div class="motion"></div>`;
const page = (body) => `<!doctype html><html><head><title>Page</title><link rel="stylesheet" href="/css/site.css"></head><body>${body}</body></html>`;

const FILES = {
  // With scripts off, the browser doesn't fetch the runtime at all.
  "export/index.html": page(`<p>Export</p>${grow}${motion}<script src="https://cdn.example.com/runtime.js"></script><img src="https://images.example.com/photo.jpg" alt=""><iframe src="https://maps.example.com/embed" title="Map"></iframe>`),
  "export/about.html": page("<p>About</p>"),
  "export/css/site.css": "body, p { margin: 0; }",
  "build/index.html": page(`<p>Build</p>${grow}${motion}`),
  "build/about/index.html": page("<p>About</p>"),
  "build/css/site.css": "body, p { margin: 0; }",
  // Stands in for the site's @font-face rules: it makes the page it reaches taller.
  "fonts.css": "body { min-height: 1500px; }",
  "fonts/font.woff2": "",
  "pages.txt": "# export file, build path\nindex.html /\nabout.html /about\nmissing.html /missing\n",
};

// A PNG's width and height, from its IHDR chunk.
async function size(file) {
  const png = await readFile(file);
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function run(dir, args) {
  return promisify(execFile)(process.execPath, [SCRIPT, ...args], { cwd: dir }).then(
    (result) => ({ ok: true, ...result }),
    (error) => ({ ok: false, stdout: error.stdout, stderr: error.stderr }),
  );
}

describe("fidelity script", () => {
  let dir;
  let result;
  let report;
  const shot = (name, width, side) => join(dir, "shots", name, `${width}-${side}.png`);

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    result = await run(dir, ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots", "--fonts", "fonts.css", "--font-files", "fonts"]);
    if (result.ok) report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("screenshots every page of both at Webflow's four widths", async () => {
    assert.ok(result.ok, result.stderr);
    assert.deepEqual(report.widths, WIDTHS);
    assert.deepEqual(report.pages.map((p) => p.name), ["home", "about", "missing"]);
    for (const name of ["home", "about", "missing"]) {
      for (const width of WIDTHS) {
        for (const side of ["export", "build"]) assert.equal((await size(shot(name, width, side))).width, width, `${name} ${width} ${side}`);
      }
    }
  });

  it("renders the export without scripts, and the build with them, under reduced motion", async () => {
    for (const width of WIDTHS) {
      const exported = (await size(shot("home", width, "export"))).height;
      assert.ok(exported >= 2000, `the export's home isn't under reduced motion at ${width}`);
      assert.ok(exported < 4000, `the export's home ran its script at ${width}`);
      assert.ok((await size(shot("home", width, "build"))).height >= 6000, `the build's home didn't run its script under reduced motion at ${width}`);
    }
  });

  it("adds the site's fonts to the export's pages only", async () => {
    assert.equal((await size(shot("about", 1440, "export"))).height, 1500);
    assert.equal((await size(shot("about", 1440, "build"))).height, 900);
  });

  it("answers other hosts with nothing, and lists them", () => {
    assert.deepEqual(report.requested.export, ["images.example.com", "maps.example.com"]);
    assert.deepEqual(report.requested.build, []);
  });

  it("lists the pages either side answered with 404", () => {
    assert.deepEqual(report.missing, ["export /missing.html", "build /missing"]);
  });

  // site-kit-webflow-migration design D139: the sides side by side, each a
  // screen tall with its label, the slices 100 px apart in overlap.
  it("puts both sides in one picture: an overview, slices a screen tall, and the end", async () => {
    for (const name of ["home", "about"]) {
      for (const width of WIDTHS) {
        const { overview, slices, end } = report.pages.find((p) => p.name === name).shots[width];
        const tall = Math.max((await size(shot(name, width, "export"))).height, (await size(shot(name, width, "build"))).height);
        assert.equal(slices.length, tall <= 900 ? 1 : Math.ceil((tall - 900) / 800) + 1, `${name} at ${width}: ${slices.length} slices of ${tall} px`);
        for (const file of [...slices, end]) assert.deepEqual(await size(join(dir, file)), { width: width * 2 + 16, height: 924 }, file);
        const picture = await size(join(dir, overview));
        assert.ok(picture.height <= 1568 && picture.width <= width * 2 + 16, `${overview} is ${picture.width} by ${picture.height} px`);
      }
    }
  });

  it("writes the review's checklist: every overview, then the home page's header and footer", async () => {
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    const items = [...review.matchAll(/^- \[ \] (\S+)$/gm)].map((match) => match[1]);
    assert.deepEqual(items, [
      ...["home", "about", "missing"].flatMap((name) => WIDTHS.map((width) => `shots/${name}/${width}-overview.png`)),
      ...WIDTHS.flatMap((width) => [`shots/home/${width}-slice-01.png`, `shots/home/${width}-end.png`]),
    ]);
  });

  it("keeps the review's ticks and added slices when it runs again", async () => {
    const file = join(dir, "shots", "review.md");
    const review = await readFile(file, "utf8");
    await writeFile(file, `${review.replace("- [ ] shots/about/479-overview.png", "- [x] shots/about/479-overview.png")}- [x] shots/about/1440-slice-01.png\n`);
    await writeFile(join(dir, "about.txt"), "about.html /about\n");
    const again = await run(dir, ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "about.txt", "--out", "shots"]);
    assert.ok(again.ok, again.stderr);
    const rewritten = await readFile(file, "utf8");
    assert.match(rewritten, /^- \[x\] shots\/about\/479-overview\.png$/m);
    assert.match(rewritten, /^- \[ \] shots\/about\/767-overview\.png$/m);
    assert.match(rewritten, /## Slices where an overview shows a difference\n\nAdd each slice you open here, ticked\.\n\n- \[x\] shots\/about\/1440-slice-01\.png\n/);
  });

  it("stops when Playwright isn't in --tools", async () => {
    const empty = await run(dir, ["--tools", "fonts", "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"]);
    assert.equal(empty.ok, false);
    assert.match(empty.stderr, /Playwright isn't installed in fonts/);
  });
});
