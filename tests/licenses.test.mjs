// site-kit-licenses: everything the package, with its peer astro, and the
// examples reach in package-lock.json is under an allowed license, and the
// copyleft exceptions come only through their parents (design D64, D65).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import { ALLOWED, EXCEPTIONS, licenseProblems } from "../scripts/licenses.mjs";
import { assertBuilt, BASICS, buildFixture, REPO } from "./helpers.mjs";

const lock = JSON.parse(readFileSync(join(REPO, "package-lock.json"), "utf8"));

// A copy of the lockfile in which `parent` depends on `name`, with `entry` as
// the package's lockfile entry unless the lockfile already has it.
function withDependency(parent, name, entry) {
  const edited = structuredClone(lock);
  edited.packages[parent].dependencies = { ...edited.packages[parent].dependencies, [name]: "*" };
  if (entry) edited.packages[`node_modules/${name}`] = entry;
  return edited;
}

describe("dependency licenses", () => {
  it("allow everything the package and the examples reach", () => {
    assert.deepEqual(licenseProblems(lock), []);
  });

  it("fail on a GPL package, with its path", () => {
    const problems = licenseProblems(withDependency("node_modules/astro", "copyleft-thing", { version: "1.0.0", license: "GPL-3.0" }));
    assert.deepEqual(problems, ["copyleft-thing@1.0.0 is under GPL-3.0, which the kit doesn't allow: packages/site-kit-astro > astro > copyleft-thing"]);
  });

  it("fail on a package with no license", () => {
    const problems = licenseProblems(withDependency("node_modules/@tailwindcss/vite", "unlicensed-thing", { version: "2.0.0" }));
    assert.deepEqual(problems, ["unlicensed-thing@2.0.0 declares no license: examples/basics > @tailwindcss/vite > unlicensed-thing"]);
  });

  it("fail on an exception through a new path", () => {
    const { version } = lock.packages["node_modules/lightningcss"];
    const problems = licenseProblems(withDependency("packages/site-kit-astro", "lightningcss"));
    assert.deepEqual(problems, [`lightningcss@${version} is allowed only through vite or @tailwindcss/node, but @hostsmith/site-kit-astro depends on it: packages/site-kit-astro > lightningcss`]);
  });

  it("fail on an exception under another license", () => {
    const edited = structuredClone(lock);
    const entry = edited.packages["node_modules/lightningcss"];
    entry.license = "GPL-3.0";
    assert.deepEqual(licenseProblems(edited), [`lightningcss@${entry.version} is an exception under MPL-2.0, but declares GPL-3.0: examples/basics > @tailwindcss/vite > @tailwindcss/node > lightningcss`]);
  });

  it("allow an expression with an allowed alternative", () => {
    assert.deepEqual(licenseProblems(withDependency("node_modules/astro", "dual-thing", { version: "3.0.0", license: "(MIT OR GPL-3.0)" })), []);
  });
});

// site-kit-licenses, "Kit builds never load sharp": the passthrough image
// service serves an image as its file is, and sharp's libvips never runs (D66).
describe("images", () => {
  it("are served unchanged by a build that can't load sharp", async () => {
    const photo = await readFile(join(BASICS, "public/assets/images/paint-tray-and-bucket.jpg"));
    const page = '---\nimport { Image } from "astro:assets";\nimport photo from "../assets/photo.jpg";\n---\n<Image src={photo} alt="A paint tray" />\n';
    const build = await buildFixture("base", {
      files: { "src/pages/photo.astro": page, "src/assets/photo.jpg": photo },
      env: { NODE_OPTIONS: `--import=${pathToFileURL(join(REPO, "tests", "no-sharp.mjs")).href}` },
    });
    try {
      assertBuilt(build);
      const html = await build.read("photo/index.html");
      const file = html.match(/<img src="\/_astro\/(photo\.[\w-]+\.jpg)"/)?.[1];
      assert.ok(file, `no unprocessed photo in: ${html}`);
      assert.deepEqual(await readFile(join(build.dist, "_astro", file)), photo);
    } finally {
      await build.cleanup();
    }
  });
});

describe("license policy in CONTRIBUTING.md", () => {
  const contributing = readFileSync(join(REPO, "CONTRIBUTING.md"), "utf8");

  it("names every allowed license", () => {
    for (const license of ALLOWED) assert.ok(contributing.includes(`\`${license}\``), `CONTRIBUTING.md doesn't name ${license}`);
  });

  it("has a row per exception, with its licenses and parents", () => {
    for (const { label, licenses, through } of EXCEPTIONS) {
      const row = contributing.split("\n").find((line) => line.startsWith(`| ${label} |`));
      assert.ok(row, `CONTRIBUTING.md has no row for ${label}`);
      for (const license of licenses) assert.ok(row.includes(`\`${license}\``), `the row for ${label} doesn't name ${license}`);
      assert.ok(row.includes(`| ${through} |`), `the row for ${label} doesn't say it's only through ${through}`);
    }
  });
});

// site-core, "Content in the repo or in an external CMS" (site-kit-core-split
// design D86): the package holds no CMS's code, not even optionally. The
// lockfile holds everything the package and the examples install.
const CMS_PACKAGES = [
  /^@sanity\//, /^sanity$/, /^@directus\//, /^directus$/, /^payload$/, /^@payloadcms\//, /^@strapi\//, /^strapi$/,
  /^contentful$/, /^@contentful\//, /^@storyblok\//, /^@prismicio\//, /^@datocms\//, /^tinacms$/, /^@tinacms\//, /^@builder\.io\//,
];

function cmsPackages(lockfile) {
  return Object.keys(lockfile.packages)
    .filter((path) => path.includes("node_modules/"))
    .map((path) => path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length))
    .filter((name) => CMS_PACKAGES.some((pattern) => pattern.test(name)));
}

describe("CMS packages", () => {
  it("are none in the lockfile", () => {
    assert.deepEqual(cmsPackages(lock), []);
  });

  it("are found when the package depends on one", () => {
    const edited = withDependency("packages/site-kit-astro", "@sanity/client", { version: "7.0.0", license: "MIT" });
    assert.deepEqual(cmsPackages(edited), ["@sanity/client"]);
  });
});
