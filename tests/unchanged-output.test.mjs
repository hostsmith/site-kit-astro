// site-kit-locales design D58: a single-locale site renders the same on this
// package as on 0.5. The `basics` example of v0.5.2, the last 0.5 release, is
// built twice: with that release's published package, and with the package
// in this workspace, after the 0.6 update's steps and `npm run decap-config`.
// Every page, the sitemap and robots.txt must match, apart from the hashed
// names of built assets and field attributes, which name the locale.
//
// site-kit-core-split design D83 and site-kit-webflow-example design D110: a
// site on 0.6.2 or 0.7.0 that takes this release by its update steps builds
// byte for byte the same files, hashed asset names included. The `basics`
// example of each release is built with that release's published package and
// with the workspace's, after the update steps.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { BASICS, fileHashes, REPO, run } from "./helpers.mjs";

// A fixed tag, not the latest: the steps below are 0.5's, and a release's own
// tag would compare the release with itself before npm serves it.
const TAG = "v0.5.2";

// The release's basics example, from its tag, in a folder of its own.
async function exampleAt(tag, dir) {
  await mkdir(dir, { recursive: true });
  execFileSync("sh", ["-c", `git archive --format=tar ${tag} examples/basics | tar -x -C "${dir}"`], { cwd: REPO });
  return join(dir, "examples", "basics");
}

const astroBuild = (site) =>
  run(process.execPath, [join(site, "node_modules", "astro", "bin", "astro.mjs"), "build"], {
    cwd: site,
    env: { ...process.env, ASTRO_TELEMETRY_DISABLED: "1", NO_COLOR: "1", SITE_NOINDEX: "" },
  });

// The release's example, built with the release's published package,
// installed as a site gets it.
async function buildReleased(tag, dir) {
  const site = await exampleAt(tag, dir);
  const install = await run("npm", ["install", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: site });
  assert.equal(install.code, 0, install.output);
  const build = await astroBuild(site);
  assert.equal(build.code, 0, build.output);
  return site;
}

// The release's example with this workspace's package, linked as in the
// fixture builds.
async function withWorkspace(tag, dir) {
  const site = await exampleAt(tag, dir);
  await mkdir(join(site, "node_modules"));
  for (const name of await readdir(join(REPO, "node_modules"))) {
    if (!name.startsWith(".")) await symlink(join(REPO, "node_modules", name), join(site, "node_modules", name));
  }
  return site;
}

// `npm run decap-config`, with this workspace's command.
async function decapConfig(site) {
  const assemble = await run(process.execPath, [join(REPO, "packages", "site-kit-astro", "bin", "site-kit.mjs"), "decap-config"], { cwd: site });
  assert.equal(assemble.code, 0, assemble.output);
}

const edit = async (file, rewrite) => writeFile(file, rewrite(await readFile(file, "utf8")));

// The steps a single-locale site takes to 0.6 (design D58), as the README's
// "Kit updates" gives them: the default locale's code in every content file's
// name, the locale in the site config with the settings' old language as its
// tag, the collections declared by their schemas, and the custom about page's
// props in a hero section, which a page template shows in the old page's
// markup. The converted about page is the workspace's `basics` page, whose
// only change since the release is this one.
async function takeRelease(site) {
  const content = join(site, "src", "content");
  for (const folder of ["pages", "news", "settings"]) {
    for (const file of await readdir(join(content, folder), { recursive: true })) {
      const match = /^(.*)\.(md|yml)$/.exec(file);
      if (match) await rename(join(content, folder, file), join(content, folder, `${match[1]}.en.${match[2]}`));
    }
  }
  const settings = join(content, "settings", "site.en.yml");
  const [, tag] = (await readFile(settings, "utf8")).match(/^language: (.+)$/m);
  await edit(settings, (text) => text.replace(/^language: .+\n/m, ""));
  await edit(join(site, "src", "site.config.ts"), (text) => text.replace("  collections: {", `  locales: [{ code: "en", tag: "${tag}" }],\n  collections: {`));
  await edit(join(site, "src", "site.schema.ts"), (text) =>
    text
      .replace('import { defineCollection } from "astro/content/config";\nimport { glob } from "astro/loaders";\n', "")
      .replace(/  news: defineCollection\(\{\n    loader: .*\n/, "  news: {\n")
      .replace(/\n  \}\),\n\};\n$/, "\n  },\n};\n"),
  );
  await rm(join(site, "src", "pages", "about.astro"));
  await cp(join(BASICS, "src", "components", "pages"), join(site, "src", "components", "pages"), { recursive: true });
  await cp(join(BASICS, "src", "content", "pages", "about.en.md"), join(content, "pages", "about.en.md"));
  await edit(join(site, "public", "admin", "config.site.yml"), (text) => text.replace(/  # Pages with `template: custom`[\s\S]*?\n\n(  - name: news)/, "$1"));
}

// Field attributes as 0.5 wrote them: without the locale, and with the about
// page's header from its own props rather than its hero section.
const withoutLocale = (text) =>
  text
    .replace(/data-field="((?:pages|news|settings)\/[^"#]+)\.en#/g, 'data-field="$1#')
    .replace('data-field="pages/about#sections[b0xc].title"', 'data-field="pages/about#heading"')
    .replace(/data-field="pages\/about#sections\[b0xc\]\./g, 'data-field="pages/about#');

// Every page, sitemap and robots.txt of a build, with asset hashes masked.
async function output(site, normalize = (text) => text) {
  const dist = join(site, "dist");
  const files = (await readdir(dist, { recursive: true })).filter((file) => /\.(html|xml|txt)$/.test(file)).sort();
  const texts = {};
  for (const file of files) texts[file] = normalize((await readFile(join(dist, file), "utf8")).replace(/\/_astro\/[\w.-]+/g, "/_astro/<asset>"));
  return texts;
}

describe(`a single-locale site from ${TAG}`, () => {
  let dir;
  let released;
  let current;
  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "site-kit-unchanged-"));
    released = await output(await buildReleased(TAG, join(dir, "released")));

    const site = await withWorkspace(TAG, join(dir, "current"));
    await takeRelease(site);
    await decapConfig(site);
    const build = await astroBuild(site);
    assert.equal(build.code, 0, build.output);
    current = await output(site, withoutLocale);
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("builds the same pages", () => {
    for (const file of ["index.html", "404.html", "sitemap.xml", "robots.txt"]) assert.ok(file in released, `${TAG} built no ${file}`);
    assert.deepEqual(Object.keys(current), Object.keys(released));
  });

  it("renders every page, the sitemap and robots.txt the same", () => {
    for (const [file, text] of Object.entries(released)) assert.equal(current[file], text, `${file} differs from ${TAG}`);
  });
});

// The releases that sites update from to this one (site-kit-core-split design
// D83). Fixed tags, like TAG above: a release adds its own once npm serves it.
const UPDATE_FROM = ["v0.6.2", "v0.7.0"];
// The site files an update writes: the generated Decap config and schema export.
const GENERATED = [".hostsmith/schema.json", "public/admin/config.yml"];

// The update steps from 0.6.2 (the README's "Kit updates"), after npm has
// installed the release. Here the workspace's package is linked instead.
async function takeUpdate(site) {
  await decapConfig(site);
  const schema = await run(process.execPath, [join(REPO, "packages", "site-kit-astro", "bin", "site-kit.mjs"), "schema"], { cwd: site });
  assert.equal(schema.code, 0, schema.output);
}

// A site's own files, without what installs, syncs and builds write.
const siteFiles = async (site) => Object.fromEntries(Object.entries(await fileHashes(site)).filter(([path]) => !/^(node_modules|dist|\.astro)\//.test(path)));

for (const tag of UPDATE_FROM) {
  describe(`a site from ${tag}`, () => {
    let dir;
    let released;
    let current;
    let changed;
    before(async () => {
      dir = await mkdtemp(join(tmpdir(), "site-kit-unchanged-"));
      released = await fileHashes(join(await buildReleased(tag, join(dir, "released")), "dist"));

      const site = await withWorkspace(tag, join(dir, "current"));
      const before = await siteFiles(site);
      await takeUpdate(site);
      const after = await siteFiles(site);
      changed = Object.keys(after).filter((path) => after[path] !== before[path]);
      const build = await astroBuild(site);
      assert.equal(build.code, 0, build.output);
      current = await fileHashes(join(site, "dist"));
    });
    after(() => rm(dir, { recursive: true, force: true }));

    // package.json and package-lock.json change too, when npm installs the release.
    it("changes no site file but the generated ones", () => {
      assert.deepEqual(changed.filter((path) => !GENERATED.includes(path)), []);
    });

    it("builds the same files", () => {
      assert.ok("index.html" in released, `${tag} built no index.html`);
      assert.deepEqual(Object.keys(current), Object.keys(released));
    });

    it("builds every file byte for byte the same", () => {
      for (const [file, hash] of Object.entries(released)) assert.equal(current[file], hash, `${file} differs from ${tag}`);
    });
  });
}
