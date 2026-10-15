// site-kit-updates: "Updates replace only unchanged kit files", "Merged files
// keep the site's part", "Updates are checked before review" and "Forcing one
// reported file". The tests build a small kit repository with three release
// tags, create sites from its v1.0.0 the way "Use this template" does (no
// shared history), and run npm run kit:update in them.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { chmod, mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, it } from "node:test";
import { formatLock, kitLock, ownerOf, sha256 } from "../scripts/kit-files.mjs";
import { mergeManifest, mergePackage, mergePackageLock, planUpdate } from "../scripts/kit-update.mjs";
import { ROOT, run } from "./helpers.mjs";

const UPDATE = join(ROOT, "scripts", "kit-update.mjs");
const lock = (files) => ({ version: "1.0.0", kitFiles: Object.fromEntries(Object.entries(files).map(([path, text]) => [path, { sha256: sha256(text) }])), mergedFiles: [] });

describe("planUpdate()", () => {
  const siteLock = lock({ "a.ts": "a1", "b.ts": "b1", "c.ts": "c1", "old.ts": "o1", "gone.ts": "g1" });
  const releaseLock = lock({ "a.ts": "a2", "b.ts": "b2", "c.ts": "c2", "new.ts": "n2", "mine.ts": "m2" });
  const local = { "a.ts": "a1", "b.ts": "b-local", "old.ts": "o1", "gone.ts": "g-local", "mine.ts": "m-local" };
  const plan = (force) => planUpdate({ siteLock, releaseLock, inRelease: () => false, localHash: (p) => (p in local ? sha256(local[p]) : undefined), force });

  it("replaces unchanged files, adds new ones and deletes dropped ones", () => {
    const { writes, deletes } = plan();
    assert.deepEqual(writes, ["a.ts", "new.ts"]);
    assert.deepEqual(deletes, ["old.ts"]);
  });

  it("keeps and reports changed, deleted, clashing and changed dropped files", () => {
    assert.deepEqual(plan().reports, [
      { path: "b.ts", reason: "changed" },
      { path: "c.ts", reason: "deleted" },
      { path: "mine.ts", reason: "exists" },
      { path: "gone.ts", reason: "dropped" },
    ]);
  });

  it("takes a forced file from the release", () => {
    const { writes, reports } = plan(["b.ts"]);
    assert.ok(writes.includes("b.ts"));
    assert.ok(!reports.some((r) => r.path === "b.ts"));
  });

  it("leaves a dropped file that the release still has to its new owner", () => {
    const result = planUpdate({ siteLock, releaseLock, inRelease: (p) => p === "old.ts", localHash: (p) => (p in local ? sha256(local[p]) : undefined) });
    assert.ok(!result.deletes.includes("old.ts"));
  });
});

describe("merged files", () => {
  it("keep the site's id in hostsmith.json and the release's layout", () => {
    const release = '{\n  "kit": { "framework": "astro", "version": "1.1.0" },\n  "site": { "id": "" },\n  "build": { "output": "dist" }\n}\n';
    const site = '{\n  "kit": { "framework": "astro", "version": "1.0.0" },\n  "site": { "id": "abc" },\n  "build": { "output": "dist" }\n}\n';
    assert.equal(mergeManifest(site, release), release.replace('"id": ""', '"id": "abc"'));
  });

  it("keep the site's package name and take the release's dependencies, scripts and engines", () => {
    const site = { name: "client-site", version: "0.0.0", private: true, scripts: { build: "old" }, dependencies: { astro: "1.0.0" }, devDependencies: { x: "1.0.0" } };
    const release = { name: "site-kit-astro", version: "0.0.0", private: true, scripts: { build: "new" }, dependencies: { astro: "2.0.0" }, engines: { node: ">=24" } };
    assert.deepEqual(JSON.parse(mergePackage(JSON.stringify(site), JSON.stringify(release))), {
      name: "client-site",
      version: "0.0.0",
      private: true,
      scripts: { build: "new" },
      dependencies: { astro: "2.0.0" },
      engines: { node: ">=24" },
    });
  });

  it("give the release's package-lock.json the site's root name", () => {
    const releaseLock = { name: "site-kit-astro", version: "0.0.0", lockfileVersion: 3, packages: { "": { name: "site-kit-astro", version: "0.0.0" }, "node_modules/astro": { version: "2.0.0" } } };
    const merged = JSON.parse(mergePackageLock(JSON.stringify({ name: "client-site", version: "0.0.0" }), JSON.stringify(releaseLock)));
    assert.equal(merged.name, "client-site");
    assert.equal(merged.packages[""].name, "client-site");
    assert.deepEqual(merged.packages["node_modules/astro"], { version: "2.0.0" });
  });
});

// ---------------------------------------------------------------------------
// End to end, with git and npm
// ---------------------------------------------------------------------------

const noop = 'node -e ""';
const packageJson = (scripts) => `${JSON.stringify({ name: "site-kit-astro", version: "0.0.0", private: true, scripts, engines: { node: ">=24" } }, null, 2)}\n`;
const packageLock = (name) =>
  `${JSON.stringify({ name, version: "0.0.0", lockfileVersion: 3, requires: true, packages: { "": { name, version: "0.0.0", engines: { node: ">=24" } } } }, null, 2)}\n`;
const manifest = (version) => `{\n  "kit": { "framework": "astro", "version": "${version}" },\n  "site": { "id": "" },\n  "build": { "command": "npm run build", "output": "dist" }\n}\n`;
const checks = { build: noop, "check:urls": noop, "decap-config": noop, test: noop };

// Each release: files by path (null deletes one), and the executable ones.
const RELEASES = {
  "1.0.0": {
    ".gitignore": "node_modules/\ndist/\n",
    "package.json": packageJson(checks),
    "package-lock.json": packageLock("site-kit-astro"),
    "src/components/sections/hero.astro": "hero v1\n",
    "src/components/sections/faq.astro": "faq v1\n",
    "src/components/sections/cta.astro": "cta v1\n",
    "src/lib/old.ts": "old v1\n",
    "src/lib/gone.ts": "gone v1\n",
    ".githooks/commit-msg": "#!/bin/sh\nexit 0\n",
    "src/content/pages/home.md": "example home v1\n",
    "src/site.config.ts": "site config v1\n",
  },
  "1.1.0": {
    "package.json": packageJson({ ...checks, "section-id": noop }),
    "src/components/sections/hero.astro": "hero v2\n",
    "src/components/sections/faq.astro": "faq v2\n",
    "src/components/sections/cta.astro": "cta v2\n",
    "src/lib/old.ts": null,
    "src/lib/gone.ts": null,
    "src/lib/added.ts": "added v2\n",
    "src/lib/new.ts": "new v2\n",
    ".githooks/commit-msg": "#!/bin/sh\nexit 0 # v2\n",
    "src/content/pages/home.md": "example home v2\n",
  },
  "1.2.0": {
    "package.json": packageJson({ ...checks, build: 'node -e "process.exit(3)"' }),
    "src/components/sections/hero.astro": "hero v3\n",
  },
};
const EXECUTABLE = new Set([".githooks/commit-msg"]);

describe("npm run kit:update", () => {
  let dir;
  let kit;
  let env;
  let sites = 0;

  const git = (cwd, ...args) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  const read = (site, path) => readFileSync(join(site, path), "utf8");
  const update = (site, ...args) => run(process.execPath, [UPDATE, ...args], { cwd: site, env });

  async function writeTree(root, files) {
    for (const [path, text] of Object.entries(files)) {
      if (text === null) {
        await unlink(join(root, path));
        continue;
      }
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), text);
      if (EXECUTABLE.has(path)) await chmod(join(root, path), 0o755);
    }
  }

  // A repository created from the template at v1.0.0, with a site id and name.
  async function newSite() {
    const site = join(dir, `site-${++sites}`);
    await mkdir(site);
    git(site, "init", "--quiet", "--initial-branch", "main");
    execFileSync("tar", ["-x", "-C", site], { input: execFileSync("git", ["-C", kit, "archive", "--format=tar", "v1.0.0"], { env }) });
    git(site, "add", "--all");
    git(site, "commit", "--quiet", "-m", "Initial commit");
    await writeFile(join(site, "hostsmith.json"), read(site, "hostsmith.json").replace('"id": ""', '"id": "site-123"'));
    await writeFile(join(site, "package.json"), read(site, "package.json").replace('"name": "site-kit-astro"', '"name": "client-site"'));
    git(site, "commit", "--quiet", "-am", "Set up the site");
    return site;
  }

  // Every file of a repository, outside .git and node_modules, with its content.
  function snapshot(root, prefix = "") {
    const files = {};
    for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (path === ".git" || path === "node_modules") continue;
      if (entry.isDirectory()) Object.assign(files, snapshot(root, path));
      else files[path] = readFileSync(join(root, path), "utf8");
    }
    return files;
  }

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "site-kit-update-"));
    await writeFile(join(dir, "gitconfig"), "[init]\n\tdefaultBranch = main\n[advice]\n\tdetachedHead = false\n");
    env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: join(dir, "gitconfig"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_AUTHOR_NAME: "Kit test",
      GIT_AUTHOR_EMAIL: "kit-test@example.com",
      GIT_COMMITTER_NAME: "Kit test",
      GIT_COMMITTER_EMAIL: "kit-test@example.com",
      npm_config_update_notifier: "false",
      npm_config_audit: "false",
      npm_config_fund: "false",
    };

    kit = join(dir, "kit");
    await mkdir(kit);
    git(kit, "init", "--quiet");
    for (const [version, files] of Object.entries(RELEASES)) {
      await writeTree(kit, { ...files, "hostsmith.json": manifest(version) });
      const tracked = Object.keys(snapshot(kit)).filter((path) => path !== "kit.lock.json");
      await writeFile(join(kit, "kit.lock.json"), formatLock(kitLock(version, tracked, (path) => readFileSync(join(kit, path)))));
      git(kit, "add", "--all");
      git(kit, "commit", "--quiet", "-m", `chore(version): v${version}`);
      git(kit, "tag", `v${version}`);
    }
    env.KIT_REPOSITORY = `file://${kit}`;
  });

  after(() => rm(dir, { recursive: true, force: true }));

  describe("from v1.0.0 to v1.1.0", () => {
    let site;
    let filesBefore;
    let result;

    before(async () => {
      site = await newSite();
      await writeTree(site, {
        "src/components/sections/faq.astro": "faq changed here\n",
        "src/components/sections/cta.astro": null,
        "src/lib/gone.ts": "gone changed here\n",
        "src/lib/new.ts": "the site's own new.ts\n",
        "src/content/pages/home.md": "the client's home\n",
        "src/pages/menu.astro": "menu\n",
      });
      git(site, "add", "--all");
      git(site, "commit", "--quiet", "-m", "Site changes");
      filesBefore = snapshot(site);
      result = await update(site, "1.1.0");
    });

    it("succeeds on the branch kit-update/v1.1.0", () => {
      assert.equal(result.code, 0, result.output);
      assert.equal(git(site, "rev-parse", "--abbrev-ref", "HEAD").trim(), "kit-update/v1.1.0");
      assert.equal(git(site, "status", "--porcelain"), "");
    });

    it("replaces unchanged kit files and adds new ones", () => {
      assert.equal(read(site, "src/components/sections/hero.astro"), "hero v2\n");
      assert.equal(read(site, "src/lib/added.ts"), "added v2\n");
    });

    it("keeps executable kit files executable", () => {
      assert.equal(read(site, ".githooks/commit-msg"), "#!/bin/sh\nexit 0 # v2\n");
      assert.ok(statSync(join(site, ".githooks/commit-msg")).mode & 0o100, "commit-msg is not executable");
    });

    it("keeps and reports a kit file changed in the site", () => {
      assert.equal(read(site, "src/components/sections/faq.astro"), "faq changed here\n");
      assert.match(result.output, /src\/components\/sections\/faq\.astro: changed in this site, kept/);
    });

    it("doesn't restore a kit file deleted in the site, and reports it", () => {
      assert.equal(existsSync(join(site, "src/components/sections/cta.astro")), false);
      assert.match(result.output, /src\/components\/sections\/cta\.astro: deleted in this site, not restored/);
    });

    it("deletes a dropped kit file only when the site didn't change it", () => {
      assert.equal(existsSync(join(site, "src/lib/old.ts")), false);
      assert.equal(read(site, "src/lib/gone.ts"), "gone changed here\n");
      assert.match(result.output, /src\/lib\/gone\.ts: dropped by the release, but changed in this site, kept/);
    });

    it("keeps the site's own file where the release adds a kit file", () => {
      assert.equal(read(site, "src/lib/new.ts"), "the site's own new.ts\n");
      assert.match(result.output, /src\/lib\/new\.ts: the release adds it, but the site has its own file there, kept/);
    });

    it("leaves every site-owned file byte-identical", () => {
      const filesAfter = snapshot(site);
      for (const [path, text] of Object.entries(filesBefore)) {
        if (ownerOf(path) === "site") assert.equal(filesAfter[path], text, path);
      }
      assert.equal(filesAfter["src/content/pages/home.md"], "the client's home\n");
    });

    it("merges hostsmith.json, package.json and package-lock.json", () => {
      const manifestAfter = JSON.parse(read(site, "hostsmith.json"));
      assert.equal(manifestAfter.site.id, "site-123");
      assert.equal(manifestAfter.kit.version, "1.1.0");
      const pkg = JSON.parse(read(site, "package.json"));
      assert.equal(pkg.name, "client-site");
      assert.deepEqual(pkg.scripts, JSON.parse(RELEASES["1.1.0"]["package.json"]).scripts);
      const packageLockAfter = JSON.parse(read(site, "package-lock.json"));
      assert.equal(packageLockAfter.name, "client-site");
      assert.equal(packageLockAfter.packages[""].name, "client-site");
    });

    it("installs the release's lock", () => {
      assert.equal(read(site, "kit.lock.json"), git(kit, "show", "v1.1.0:kit.lock.json"));
    });

    it("commits with the reported files in the message", () => {
      const message = git(site, "log", "-1", "--format=%B");
      assert.match(message, /^chore: update the kit to v1\.1\.0\n/);
      for (const path of ["src/components/sections/faq.astro", "src/components/sections/cta.astro", "src/lib/gone.ts", "src/lib/new.ts"]) {
        assert.ok(message.includes(`- ${path}\n`), `${path} is not in the commit message`);
      }
    });

    it("then takes one reported file with --force, and only that one", async () => {
      const forced = await update(site, "1.1.0", "--force", "src/components/sections/faq.astro");
      assert.equal(forced.code, 0, forced.output);
      assert.equal(read(site, "src/components/sections/faq.astro"), "faq v2\n");
      assert.equal(existsSync(join(site, "src/components/sections/cta.astro")), false);
      assert.equal(read(site, "src/lib/new.ts"), "the site's own new.ts\n");
      assert.match(git(site, "log", "-1", "--format=%B"), /Taken from the release with --force:\n- src\/components\/sections\/faq\.astro\n/);
    });
  });

  it("stops and changes nothing when the working tree has uncommitted changes", async () => {
    const site = await newSite();
    await writeFile(join(site, "src/content/pages/home.md"), "work in progress\n");
    const result = await update(site, "1.1.0");
    assert.equal(result.code, 1);
    assert.match(result.output, /uncommitted changes/);
    assert.equal(git(site, "rev-parse", "--abbrev-ref", "HEAD").trim(), "main");
    assert.equal(read(site, "src/components/sections/hero.astro"), "hero v1\n");
  });

  it("stops when the site has no kit.lock.json", async () => {
    const site = await newSite();
    git(site, "rm", "--quiet", "kit.lock.json");
    git(site, "commit", "--quiet", "-m", "No lock");
    const result = await update(site, "1.1.0");
    assert.equal(result.code, 1);
    assert.match(result.output, /kit\.lock\.json is missing/);
  });

  it("names the failing check and commits nothing when the release's build fails", async () => {
    const site = await newSite();
    const head = git(site, "rev-parse", "HEAD");
    const result = await update(site, "1.2.0");
    assert.equal(result.code, 1);
    assert.match(result.output, /The update stopped: "npm run build" failed\. Nothing was committed\./);
    assert.equal(git(site, "rev-parse", "HEAD"), head);
    assert.equal(git(site, "rev-parse", "--abbrev-ref", "HEAD").trim(), "kit-update/v1.2.0");
  });
});
