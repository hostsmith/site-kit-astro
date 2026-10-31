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
    assert.match(result.stdout, /^404: export \/missing\.html\n404: build \/missing\nThe export's pages asked other hosts[^\n]*\nTo review[^\n]*\nPages shot at [^\n]*\nMeasured, [^\n]*\nPictures to open [^\n]*\n$/);
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

  it("writes the review's checklist: every overview, worst first, then the home page's header and footer", async () => {
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    const items = [...review.matchAll(/^- \[ \] (\S+)/gm)].map((match) => match[1]);
    const overviews = ["home", "about", "missing"].flatMap((name) => WIDTHS.map((width) => `shots/${name}/${width}-overview.png`));
    assert.deepEqual([...items.slice(0, 12)].sort(), [...overviews].sort());
    assert.deepEqual(items.slice(12), WIDTHS.flatMap((width) => [`shots/home/${width}-slice-01.png`, `shots/home/${width}-end.png`]));
    const shares = [...review.matchAll(/-overview\.png \(([\d.]+)% different\)$/gm)].map((match) => Number(match[1]));
    assert.equal(shares.length, 12);
    assert.deepEqual(shares, [...shares].sort((a, b) => b - a));
  });

  // site-kit-webflow-migration design D141: reruns.
  describe("run again after a fix", () => {
    const file = () => join(dir, "shots", "review.md");
    const again = (...extra) => run(dir, [...ARGS, ...extra]);
    const modified = async (name, width, side) => (await stat(shot(name, width, side))).mtimeMs;
    const ticked = (review, path) => new RegExp(`^- \\[x\\] ${path.replaceAll(".", "\\.")}( \\([\\d.]+% different\\))?$`, "m").test(review);

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

// site-kit-webflow-migration design D166: each page and width measured, the
// checklist's overviews worst first, and the average against the last run's.
describe("fidelity script, measured", () => {
  const block = (color, height = 800) => `<div style="height: ${height}px; background: ${color}"></div>`;
  const FILES = {
    "export/same.html": page(block("#204060")),
    "export/color.html": page(block("#204060")),
    "export/short.html": page(block("#204060", 1600)),
    "build/same/index.html": page(block("#204060")),
    "build/color/index.html": page(block("#c08020")),
    "build/short/index.html": page(block("#204060", 800)),
    "pages.txt": "same.html /same\ncolor.html /color\nshort.html /short\n",
  };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots", "--only", "same,color,short"];
  let dir;
  let first;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-measured-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    first = await run(dir, ARGS.slice(0, -2));
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("measures the share of each page that differs", async () => {
    assert.ok(first.ok, first.stderr);
    const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
    const at = (name, width) => report.pages.find((p) => p.name === name).shots[width].difference;
    for (const width of WIDTHS) {
      assert.equal(at("same", width), 0, `same at ${width}`);
      // The body's margin is white on both sides.
      assert.ok(at("color", width) > 70, `color at ${width}: ${at("color", width)}`);
      assert.ok(at("short", width) > 30 && at("short", width) < 60, `short at ${width}: ${at("short", width)}`);
    }
  });

  it("lists the overviews worst first, each with its share, and prints the largest and the average", async () => {
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    const overviews = [...review.matchAll(/^- \[ \] (\S+-overview\.png) \(([\d.]+)% different\)$/gm)].map((m) => [m[1].split("/").at(-2), Number(m[2])]);
    assert.equal(overviews.length, 12);
    assert.deepEqual(overviews.map(([name]) => name).slice(0, 4), ["color", "color", "color", "color"]);
    assert.deepEqual(overviews.map(([name]) => name).slice(-4), ["same", "same", "same", "same"]);
    assert.deepEqual([...overviews.map(([, share]) => share)], [...overviews.map(([, share]) => share)].sort((a, b) => b - a));
    assert.match(first.stdout, /Measured, the share of each page that differs: the largest color at \d+ px, [\d.]+%;[^\n]* Average [\d.]+%\.\n/);
  });

  // site-kit-fidelity-cms-stubs design D185: each page's change against the
  // last run, and the rounds' rule on it.
  it("prints the average and each page's change against the last run's after a fix", async () => {
    await writeFile(join(dir, "build", "color", "index.html"), page(block("#204060")));
    const second = await run(dir, ARGS);
    assert.ok(second.ok, second.stderr);
    const [, now, before] = second.stdout.match(/ Average ([\d.]+)%, against ([\d.]+)% in the last run\.\n/) ?? assert.fail(second.stdout);
    assert.ok(Number(now) < Number(before), `${now}% isn't less than ${before}%`);
    // The largest change first.
    const changes = second.stdout.match(/\nEach page's average over its widths, against the last run: (.*)\.\nRound 2: Review the pictures it unticked\.\n/)?.[1] ?? assert.fail(second.stdout);
    assert.match(changes, /^color 0%, down [\d.]+; /);
    assert.match(changes, /; same 0%, the same(;|$)/);
    assert.match(changes, /; short [\d.]+%, the same(;|$)/);
  });

  it("reviews round 3 when no page moved", async () => {
    const third = await run(dir, ARGS);
    assert.ok(third.ok, third.stderr);
    assert.match(third.stdout, /\nRound 3: no page moved by 1 point or more, but the first two reruns are always reviewed\. Review the pictures it unticked\.\n/);
  });

  it("reviews round 4 while one page still improves by 1 point or more", async () => {
    await writeFile(join(dir, "build", "short", "index.html"), page(block("#204060", 1000)));
    const fourth = await run(dir, ARGS);
    assert.ok(fourth.ok, fourth.stderr);
    const [, change] = fourth.stdout.match(/[:;] short [\d.]+%, down ([\d.]+)[;.]/) ?? assert.fail(fourth.stdout);
    assert.ok(Number(change) >= 1, `short moved by ${change}`);
    assert.match(fourth.stdout, /\nRound 4: Review the pictures it unticked\.\n/);
  });

  it("stops the rounds when no page moved by 1 point, though one still differs by a constant gap", async () => {
    const fifth = await run(dir, ARGS);
    assert.ok(fifth.ok, fifth.stderr);
    const [, gap] = fifth.stdout.match(/[:;] short ([\d.]+)%, the same[;.]/) ?? assert.fail(fifth.stdout);
    assert.ok(Number(gap) > 10, `short differs by ${gap}%`);
    assert.match(fifth.stdout, /\nRound 5: no page moved by 1 point or more, so the review's rounds stop here\. Open none of the pictures it unticked: list them under the report's "Not compared"\.\n/);
  });

  it("names a page the last fixes made differ more, for a review of what they broke", async () => {
    await writeFile(join(dir, "build", "color", "index.html"), page(block("#ff0000")));
    const sixth = await run(dir, ARGS);
    assert.ok(sixth.ok, sixth.stderr);
    assert.match(sixth.stdout, /\nRound 6: color differs more, by 1 point or more: the last fixes broke something\. Review the pictures it unticked, that page's for what the fixes broke\.\n/);
  });
});

// site-kit-webflow-migration design D166: step 5 compares a sample of pages
// before it builds the rest, so --only shoots the sample alone.
describe("fidelity script, on step 5's sample", () => {
  const block = (color) => `<div style="height: 800px; background: ${color}"></div>`;
  const FILES = {
    "export/index.html": page(block("#204060")),
    "export/about.html": page(block("#204060")),
    "export/pricing.html": page(block("#204060")),
    "build/index.html": page(block("#c08020")),
    "pages.txt": "index.html /\nabout.html /about\npricing.html /pricing\n",
  };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"];
  let dir;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-sample-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("shoots only the sample, and leaves out the pages it hasn't shot yet", async () => {
    const result = await run(dir, [...ARGS, "--only", "home"]);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /Pages shot at [^\n]*: 1, [^\n]*Pages kept as they were: 0\. Pages left out by --only, not shot yet: 2\./);
    assert.match(result.stdout, /the largest home at /);
    const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
    assert.deepEqual(report.pages.map((p) => p.name), ["home"]);
    assert.deepEqual(report.missing, []);
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    assert.doesNotMatch(review, /shots\/(about|pricing)\//);
    assert.equal(report.round, 0);
  });

  // site-kit-migration-cost design D177: the sample's runs are no round of
  // step 9's review.
  it("compares the sample's rerun with its last run, as no round", async () => {
    const result = await run(dir, [...ARGS, "--only", "home"]);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /, against [\d.]+% in the last run\.\nEach page's average over its widths, against the last run: home [\d.]+%, the same\.\n/);
    assert.doesNotMatch(result.stdout, /Round \d/);
  });

  it("shoots every page on the next run without --only, and compares no average with the sample's", async () => {
    for (const name of ["about", "pricing"]) {
      await mkdir(join(dir, "build", name), { recursive: true });
      await writeFile(join(dir, "build", name, "index.html"), page(block("#204060")));
    }
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /Pages shot at [^\n]*: 3, with the export's screenshots kept from the last run for 1\./);
    assert.doesNotMatch(result.stdout, /in the last run/);
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

// site-kit-fidelity-cms-stubs design D181, D182: the export's CMS template and
// list, empty as Webflow exports them, served filled from the snapshot's CSVs
// as step 6's fill file maps them. The body's block and the list's photos
// give the export's screenshots their heights, and its empty state is tall.
describe("fidelity script, with the CMS filled", () => {
  const body = `<p onclick="alert(1)">First.</p><div style="height: 3000px; background: #204060"></div><iframe src="https://video.example.com/embed/1" title="Video"></iframe>`;
  const posts = (first) => `Name,Slug,Body,Photo\nFirst Post,first,"${first.replaceAll('"', '""')}",https://cdn.example.com/64f1_photo.svg\nSecond Post,second,<p>Second.</p>,https://cdn.example.com/64f1_photo.svg\n`;
  const FILES = {
    "snapshot/code/detail_post.html": page(`<h1 class="post_title w-dyn-bind-empty"></h1><div class="post_body w-dyn-bind-empty w-richtext"></div>`),
    "snapshot/code/index.html": page(`<div class="w-dyn-list"><div role="list" class="w-dyn-items"><div role="listitem" class="w-dyn-item"><p class="card_name w-dyn-bind-empty"></p><img src="" alt="" class="card_photo w-dyn-bind-empty"></div></div><div class="w-dyn-empty"><div style="height: 2000px">No items found.</div></div></div>`),
    "snapshot/code/css/site.css": "body, p, h1 { margin: 0; } img { display: block; }",
    "snapshot/cms/posts.csv": posts(body),
    "snapshot/work/cms-images.txt": "https://cdn.example.com/64f1_photo.svg photo.svg\n",
    "snapshot/fidelity/pages.txt": "index.html /\ndetail_post.html /blog/first\n",
    "build/index.html": page("<p>Build</p>"),
    "build/blog/first/index.html": page("<p>Build</p>"),
    "build/css/site.css": "body, p { margin: 0; }",
    "build/assets/images/photo.svg": `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#c08020"/></svg>`,
  };
  const FILL = {
    templates: { "detail_post.html": { csv: "posts.csv", fields: ["Name", "Body"] } },
    lists: { "index.html": [{ csv: "posts.csv", entries: ["second", "first"], fields: ["Name", "Photo"] }] },
  };
  const ARGS = ["--tools", REPO, "--export", "snapshot/code", "--build", "build", "--pages", "snapshot/fidelity/pages.txt", "--out", "snapshot/fidelity/shots", "--fill", "snapshot/fidelity/fill.json"];
  let dir;
  let first;
  const heights = async (name) => Promise.all(WIDTHS.map(async (width) => (await size(join(dir, "snapshot", "fidelity", "shots", name, `${width}-export.png`))).height));
  const report = async () => JSON.parse(await readFile(join(dir, "snapshot", "fidelity", "shots", "fidelity.json"), "utf8"));

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-fill-"));
    for (const [path, text] of Object.entries({ ...FILES, "snapshot/fidelity/fill.json": JSON.stringify(FILL) })) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    first = await run(dir, ARGS);
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("shoots the template and the list with the entries' values, and the list without its empty state", async () => {
    assert.ok(first.ok, first.stderr);
    const { fill, pages } = await report();
    assert.equal(fill, true);
    assert.deepEqual(pages.map(({ name, filled, fill }) => ({ name, filled, fill })), [
      { name: "home", filled: true, fill: [{ part: "list 1", filled: true }] },
      { name: "blog-first", filled: true, fill: [{ part: "template", filled: true }] },
    ]);
    for (const height of await heights("blog-first")) assert.ok(height >= 3000, `the post's body isn't in the export: ${height} px`);
    for (const height of await heights("home")) assert.ok(height >= 1000 && height < 2000, `the list isn't two photos without its empty state: ${height} px`);
    assert.match(first.stdout, /^Filled from the CSVs, each element by its field: index\.html, list 1: p\.card_name = Name; img\.card_photo = Photo\.\nFilled from the CSVs, each element by its field: detail_post\.html, template: h1\.post_title = Name; \.post_body\.w-richtext = Body\.\n/);
  });

  it("drops the body's frame, so its host is never asked", async () => {
    assert.deepEqual((await report()).requested.export, []);
  });

  it("shoots the export again when a value it fills changes, and keeps the others", async () => {
    await writeFile(join(dir, "snapshot", "cms", "posts.csv"), posts(body.replace("First.", "First, changed.")));
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /Pages shot at [^\n]*: 2, with the export's screenshots kept from the last run for 1\./);
  });

  it("shoots a template the fill file doesn't account for as it is, and names its element", async () => {
    await writeFile(join(dir, "snapshot", "fidelity", "fill.json"), JSON.stringify({ ...FILL, templates: { "detail_post.html": { csv: "posts.csv", fields: ["Name"] } } }));
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /\nNot filled, shot as exported: detail_post\.html, template: the fill file names 1 field for its 2 empty elements: the 2nd, \.post_body\.w-richtext, has none\.\n/);
    const post = (await report()).pages.find((p) => p.name === "blog-first");
    assert.equal(post.filled, false);
    assert.match(post.fill[0].problem, /the 2nd, \.post_body\.w-richtext, has none/);
    for (const height of await heights("blog-first")) assert.ok(height < 3000, `the template was filled: ${height} px`);
  });

  it("shoots every page as exported without a fill file, and says so", async () => {
    await rm(join(dir, "snapshot", "fidelity", "fill.json"));
    const result = await run(dir, ARGS);
    assert.ok(result.ok, result.stderr);
    assert.match(result.stdout, /^The export's CMS templates and collection lists are shot empty: there's no fill file at snapshot\/fidelity\/fill\.json yet\. Step 6 writes it, and --fill names it\.\n/);
    const unfilled = await report();
    assert.equal(unfilled.fill, false);
    assert.deepEqual(unfilled.pages.map((p) => p.filled), [false, false]);
    for (const height of await heights("home")) assert.ok(height >= 2000, `the list's empty state is gone: ${height} px`);
  });
});

// site-kit-fidelity-cms-stubs design D183: three entries of a template, each
// differing most at other widths. The checklist puts up the worst entry at
// each width, lists the others as measured, and the average counts the
// template once per width.
describe("fidelity script, with several entries of a template", () => {
  const red = (media) => page(`<style>@media ${media} { .block { background: #c00020 !important; } }</style><div class="block" style="height: 800px; background: #204060"></div>`);
  const FILES = {
    "export/detail_post.html": page(`<div class="block" style="height: 800px; background: #204060"></div>`),
    "export/about.html": page(`<div style="height: 800px; background: #204060"></div>`),
    "build/blog/a/index.html": red("(max-width: 600px)"),
    "build/blog/b/index.html": red("(min-width: 700px) and (max-width: 1200px)"),
    "build/blog/c/index.html": red("(min-width: 1201px)"),
    "build/about/index.html": page(`<div style="height: 800px; background: #204060"></div>`),
    "pages.txt": "about.html /about\ndetail_post.html /blog/a\ndetail_post.html /blog/b\ndetail_post.html /blog/c\n",
  };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"];
  let dir;
  let result;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-entries-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    result = await run(dir, ARGS);
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("puts up, at each width, the entry that differs most, and lists the others as measured", async () => {
    assert.ok(result.ok, result.stderr);
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    const boxes = [...review.matchAll(/^- \[ \] shots\/(blog-\w)\/(\d+)-overview\.png/gm)].map((m) => `${m[1]} ${m[2]}`).sort();
    assert.deepEqual(boxes, ["blog-a 479", "blog-b 767", "blog-b 991", "blog-c 1440"]);
    const others = review.split("\n## Other entries of the templates, measured\n")[1]?.split("\n## ")[0] ?? assert.fail(review);
    const listed = [...others.matchAll(/^- shots\/(blog-\w)\/(\d+)-overview\.png \(([\d.]+)% different\)$/gm)];
    assert.equal(listed.length, 8);
    assert.ok(listed.every((m) => Number(m[3]) < 5), others);
  });

  it("counts the template once per width, by that entry", async () => {
    const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
    const at = (name, width) => report.pages.find((p) => p.name === name).shots[width].difference;
    const worst = { 479: "blog-a", 767: "blog-b", 991: "blog-b", 1440: "blog-c" };
    const cells = WIDTHS.flatMap((width) => [at("about", width), at(worst[width], width)]);
    const expected = Math.round((cells.reduce((sum, d) => sum + d, 0) / cells.length) * 10) / 10;
    assert.ok(expected > 20, `the entries differ by ${cells.join(", ")}`);
    assert.match(result.stdout, new RegExp(`\\. Average ${expected}%\\.\\n`));
  });

  // site-kit-webflow-migration design D197.
  it("writes the results per page for the report: the template by its worst entry, each entry under it, and the average", async () => {
    const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
    const at = (name, width) => report.pages.find((p) => p.name === name).shots[width].difference;
    const worst = { 479: "blog-a", 767: "blog-b", 991: "blog-b", 1440: "blog-c" };
    const mean = (values) => Math.round((values.reduce((sum, d) => sum + d, 0) / values.length) * 10) / 10;
    const row = (label, values) => `| ${label} | ${values.map((d) => `${d}%`).join(" | ")} | ${mean(values)}% |`;
    const results = await readFile(join(dir, "shots", "results.md"), "utf8");
    const all = WIDTHS.flatMap((width) => [at("about", width), at(worst[width], width)]);
    assert.equal(
      results,
      [
        "| Page | 479 px | 767 px | 991 px | 1440 px | Average |",
        "| --- | --- | --- | --- | --- | --- |",
        row("/about", WIDTHS.map((width) => at("about", width))),
        row("detail_post.html, a template: its entry that differs most", WIDTHS.map((width) => at(worst[width], width))),
        ...["a", "b", "c"].map((entry) => row(`an entry: /blog/${entry}`, WIDTHS.map((width) => at(`blog-${entry}`, width)))),
        "",
        `The share of each page's screenshot that differs from the export's, after round 1 of the review. Average over the pages counted: ${mean(all)}%.`,
        "",
      ].join("\n"),
    );
  });
});

// site-kit-fidelity-cms-stubs design D184: a page step 5 wrote anew is shot
// and put up for the site's look, but left out of the average and the rule.
describe("fidelity script, with a page written anew", () => {
  const FILES = {
    "export/about.html": page(`<div style="height: 800px; background: #204060"></div>`),
    "build/about/index.html": page(`<div style="height: 800px; background: #204060"></div>`),
    "build/404.html": page(`<div style="height: 1600px; background: #c08020"></div>`),
    "pages.txt": "about.html /about\n404.html /404 anew\n",
  };
  const ARGS = ["--tools", REPO, "--export", "export", "--build", "build", "--pages", "pages.txt", "--out", "shots"];
  let dir;
  let result;

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "fidelity-anew-"));
    for (const [path, text] of Object.entries(FILES)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), text);
    }
    result = await run(dir, ARGS);
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("shoots a page marked anew and puts it up for the site's look, though the export has no such page", async () => {
    assert.ok(result.ok, result.stderr);
    const report = JSON.parse(await readFile(join(dir, "shots", "fidelity.json"), "utf8"));
    const written = report.pages.find((p) => p.name === "404");
    assert.equal(written.anew, true);
    assert.deepEqual(report.missing, []);
    assert.doesNotMatch(result.stdout, /^404: /m);
    const review = await readFile(join(dir, "shots", "review.md"), "utf8");
    const anew = review.split("\n## Pages written anew\n")[1]?.split("\n## ")[0] ?? assert.fail(review);
    assert.deepEqual([...anew.matchAll(/^- \[ \] (\S+)$/gm)].map((m) => m[1]), WIDTHS.map((width) => `shots/404/${width}-overview.png`));
  });

  it("leaves it out of the average, which is the other pages'", () => {
    assert.match(result.stdout, /: the largest about at \d+ px, 0%; [^\n]*\. Average 0%, without the pages written anew, 404\.\n/);
  });

  it("lists it in the results per page as not counted", async () => {
    const results = await readFile(join(dir, "shots", "results.md"), "utf8");
    assert.match(results, /^\| \/404, written anew, not counted \| [\d.]+% \| [\d.]+% \| [\d.]+% \| [\d.]+% \| [\d.]+% \|$/m);
    assert.match(results, /Average over the pages counted: 0%\.\n$/);
  });

  it("names the marks pages.txt takes", async () => {
    await writeFile(join(dir, "pages.txt"), "about.html /about\n404.html /404 new\n");
    const wrong = await run(dir, ARGS);
    assert.equal(wrong.ok, false);
    assert.match(wrong.stderr, /pages\.txt: "404\.html \/404 new" isn't "<export file> <build path>", such as "about\.html \/about", with "anew" after them for a page written anew\./);
  });
});
