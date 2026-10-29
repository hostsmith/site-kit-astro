// site-kit-webflow-migration design D117: the migration skill's fidelity
// script, on a small export and build. It screenshots each page of both at
// Webflow's four widths, renders the export without scripts and the build with
// them, both under reduced motion, adds the site's fonts to the export's pages
// only, answers other hosts with nothing, and lists the pages that 404.
// Playwright comes from the kit repository's own install, as --tools.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { promisify } from "node:util";
import { PACKAGE, REPO } from "../helpers.mjs";
import { launch } from "./helpers.mjs";

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

const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots", "--fonts", "fonts.css", "--font-files", "fonts"];

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
    result = await run(dir, ARGS);
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

  it("ends its output with what it shot and what to open, after what went wrong", () => {
    assert.match(result.stdout, /^404: export \/missing\.html\n404: build \/missing\nThe export's pages asked other hosts[^\n]*\nTo review[^\n]*\nPages shot at [^\n]*\nPictures to open [^\n]*\n$/);
    assert.doesNotMatch(result.stdout, /Webflow's (entrance animations|interactions)/);
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

  // site-kit-webflow-migration design D141: reruns.
  describe("run again after a fix", () => {
    const file = () => join(dir, "shots", "review.md");
    const again = (...extra) => run(dir, [...ARGS, ...extra]);
    const modified = async (name, width, side) => (await stat(shot(name, width, side))).mtimeMs;
    const ticked = (review, path) => new RegExp(`^- \\[x\\] ${path.replaceAll(".", "\\.")}$`, "m").test(review);

    it("keeps the export's screenshots, and unticks only the pictures whose build changed", async () => {
      const review = await readFile(file(), "utf8");
      const ticks = ["shots/home/479-overview.png", "shots/about/479-overview.png", "shots/about/1440-overview.png"];
      let edited = ticks.reduce((text, path) => text.replace(`- [ ] ${path}`, `- [x] ${path}`), review);
      edited = edited.replace("Add each slice you open here, ticked.\n", "Add each slice you open here, ticked.\n\n- [x] shots/about/1440-slice-01.png\n");
      await writeFile(file(), `${edited}| about | 479 | The heading is larger | the theme's h2 |\n`);
      const exported = await modified("home", 1440, "export");
      await writeFile(join(dir, "build/index.html"), FILES["build/index.html"].replace("<p>Build</p>", "<p>Build, fixed</p>"));

      const result = await again();
      assert.ok(result.ok, result.stderr);
      assert.match(result.stdout, /Pages shot at 479, 767, 991, 1440 px: 3, with the export's screenshots kept from the last run for 3\. Pages kept as they were: 0\./);
      assert.equal(await modified("home", 1440, "export"), exported, "the export's home was shot again");
      const rewritten = await readFile(file(), "utf8");
      assert.ok(!ticked(rewritten, "shots/home/479-overview.png"), "the home page's build changed, but its overview kept its tick");
      assert.ok(ticked(rewritten, "shots/about/479-overview.png") && ticked(rewritten, "shots/about/1440-overview.png"), "the about page's overviews lost their ticks");
      assert.ok(ticked(rewritten, "shots/about/1440-slice-01.png"), "the slice added lost its tick or its line");
      assert.match(rewritten, /## Differences found\n[\s\S]*\| Page \| Width \| Difference \| Cause, or how it was fixed \|\n\| --- \| --- \| --- \| --- \|\n\| about \| 479 \| The heading is larger \| the theme's h2 \|\n/);
    });

    it("shoots only the pages --only names, and keeps the others as they were", async () => {
      const about = await modified("about", 479, "build");
      await writeFile(join(dir, "build/about/index.html"), FILES["build/about/index.html"].replace("<p>About</p>", "<p>About, changed</p>"));
      const result = await again("--only", "home");
      assert.ok(result.ok, result.stderr);
      assert.match(result.stdout, /: 1, with the export's screenshots kept from the last run for 1\. Pages kept as they were: 2\./);
      assert.equal(await modified("about", 479, "build"), about, "about was shot again");
      const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
      assert.deepEqual(report.pages.map((p) => p.name), ["home", "about", "missing"]);
      assert.deepEqual(report.missing, ["export /missing.html", "build /missing"]);
      assert.ok(ticked(await readFile(file(), "utf8"), "shots/about/479-overview.png"));
    });

    it("shoots the export again with --fresh, and keeps the ticks of pictures that look the same", async () => {
      await writeFile(file(), (await readFile(file(), "utf8")).replace("- [ ] shots/home/767-overview.png", "- [x] shots/home/767-overview.png"));
      const exported = await modified("home", 767, "export");
      const result = await again("--only", "home", "--fresh");
      assert.ok(result.ok, result.stderr);
      assert.match(result.stdout, /: 1, with the export's screenshots kept from the last run for 0\./);
      assert.notEqual(await modified("home", 767, "export"), exported, "the export's home wasn't shot again");
      assert.ok(ticked(await readFile(file(), "utf8"), "shots/home/767-overview.png"), "a picture that looks the same lost its tick");
    });

    it("unticks the pictures of a page whose build changed while --only left it out", async () => {
      const result = await again("--only", "about");
      assert.ok(result.ok, result.stderr);
      assert.ok(!ticked(await readFile(file(), "utf8"), "shots/about/479-overview.png"));
    });

    it("names a page --only doesn't know", async () => {
      const result = await again("--only", "home,pricing");
      assert.equal(result.ok, false);
      assert.match(result.stderr, /--only: no page named "pricing"\. The pages are home, about, missing\./);
    });
  });

  it("stops when Playwright isn't in --tools", async () => {
    const empty = await run(dir, ["--tools", "fonts", "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"]);
    assert.equal(empty.ok, false);
    assert.match(empty.stderr, /Playwright isn't installed in fonts/);
  });
});

// Webflow writes an entrance's start state into the page, which only its
// script would play: the export's pages are served without it, but keep the
// start state of a hover. The interactions are minified JavaScript, as
// Webflow's are, read as data.
describe("fidelity script, with Webflow's entrance animations", () => {
  const INTERACTIONS = `!function(){Webflow.require("ix2").init({events:{"e-1":{id:"e-1",eventTypeId:"SCROLL_INTO_VIEW",action:{config:{actionListId:"a-1"}},target:{id:"page1|entrance",appliesTo:"ELEMENT"}},"e-2":{id:"e-2",eventTypeId:"PAGE_FINISH",action:{config:{actionListId:"a-2"}},target:{id:"page1",appliesTo:"PAGE"},targets:[{id:"page1",appliesTo:"PAGE"}]},"e-3":{id:"e-3",eventTypeId:"MOUSE_OVER",action:{config:{actionListId:"a-3"}},target:{id:"page1|hover",appliesTo:"ELEMENT"}}},actionLists:{"a-1":{id:"a-1",title:'Slide "in"',actionItemGroups:[{actionItems:[{config:{target:{useEventTarget:!0,id:"page1|entrance"},value:0}}]}],useFirstGroupAsInitialState:!0,createdOn:0x164676ec7a3},"a-2":{actionItemGroups:[{actionItems:[{config:{target:{selector:".page-title",selectorGuids:["g-1"]}}}]}]},"a-3":{actionItemGroups:[{actionItems:[{config:{target:{id:"page1|hover"}}}]}]}}})}();`;
  // Each start state moves its element down, which makes the page taller.
  const moved = (distance) => `opacity:0;-webkit-transform:translate3d(0, ${distance}PX, 0);transform:translate3d(0, ${distance}PX, 0)`;
  const FILES = {
    "export/index.html": `<!doctype html><html data-wf-page="page1"><head><title>Page</title><style>body, h1, div { margin: 0; }</style></head><body><div data-w-id="entrance" style="${moved(5000)}">Entrance</div><h1 style="${moved(4000)}" class="page-title">Title</h1><div data-w-id="hover" style="${moved(2000)}">Hover</div><script src="js/webflow.js"></script></body></html>`,
    "export/js/webflow.js": INTERACTIONS,
    "build/index.html": page("<p>Build</p>"),
    "build/css/site.css": "body, p { margin: 0; }",
    "pages.txt": "index.html /\n",
  };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"];
  let dir;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-ix2-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("shoots an element an entrance starts where the entrance ends, and a hover's start as it is", async () => {
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /Webflow's entrance animations start some elements hidden or moved/);
    for (const width of WIDTHS) {
      const { height } = await size(join(dir, "shots", "home", `${width}-export.png`));
      assert.ok(height >= 2000, `the hover's start state went at ${width}: ${height} px`);
      assert.ok(height < 4000, `an entrance's start state stayed at ${width}: ${height} px`);
    }
  });

  it("says when it can't read the interactions, and keeps every start state", async () => {
    await writeFile(join(dir, "export/js/webflow.js"), INTERACTIONS.replace("createdOn:", "createdOn:Date.now()+"));
    const result = await run(dir, [...ARGS, "--fresh"]);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /Webflow's interactions couldn't be read from the export's scripts/);
    assert.ok((await size(join(dir, "shots", "home", "1440-export.png"))).height >= 5000);
  });
});

// site-kit-motion design D164: the build of a site that ignores reduced motion
// plays its motion, and is shot with each element where its motion ends.
describe("fidelity script, on a site that ignores reduced motion", () => {
  // A box below the first screen, hidden and moved until it scrolls into
  // view, as a theme's reveal is; and a block that reduced motion makes tall.
  const BUILD = `<!doctype html><html><head><title>Page</title><style>
    body { margin: 0; } .spacer { height: 1500px; } .box { height: 300px; background: #c00; transition: opacity 0.6s, transform 0.6s; }
    [data-ready] .box:not([data-revealed]) { opacity: 0; transform: translateY(300px); }
    @media (prefers-reduced-motion: reduce) { .reduced { height: 2000px; } }
  </style></head><body><div class="spacer"></div><div class="box"></div><div class="reduced"></div><script>
    document.documentElement.setAttribute("data-ready", "");
    new IntersectionObserver((entries) => entries.forEach((entry) => entry.isIntersecting && entry.target.setAttribute("data-revealed", ""))).observe(document.querySelector(".box"));
  </script></body></html>`;
  const FILES = { "export/index.html": page("<p>Export</p>"), "build/index.html": BUILD, "pages.txt": "index.html /\n" };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots", "--reduced-motion", "ignore"];
  let dir;

  // A pixel of a PNG as "r,g,b", read in the browser.
  async function pixel(file, x, y) {
    const browser = await launch();
    try {
      const sheet = await browser.newPage();
      const data = (await readFile(file)).toString("base64");
      return await sheet.evaluate(
        async ({ data, x, y }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${data}`;
          await image.decode();
          const canvas = Object.assign(document.createElement("canvas"), { width: image.width, height: image.height });
          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0);
          return [...context.getImageData(x, y, 1, 1).data.slice(0, 3)].join(",");
        },
        { data, x, y },
      );
    } finally {
      await browser.close();
    }
  }

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-motion-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("shoots a section below the first screen at rest in its place, without reduced motion", async () => {
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /The build plays its motion for every visitor/);
    for (const width of [479, 1440]) {
      const file = join(dir, "shots", "home", `${width}-build.png`);
      assert.ok((await size(file)).height < 2000, `the build was shot under reduced motion at ${width}`);
      assert.equal(await pixel(file, 10, 1510), "204,0,0", `the box isn't at rest in its place at ${width}`);
    }
  });

  it("names the values --reduced-motion takes", async () => {
    const result = await run(dir, [...ARGS.slice(0, -1), "sometimes"]);
    assert.equal(result.ok, false);
    assert.match(result.stderr, /--reduced-motion is "sometimes"\. It is the site's reducedMotion from src\/site\.config\.ts: respect, the default, or ignore\./);
  });
});
