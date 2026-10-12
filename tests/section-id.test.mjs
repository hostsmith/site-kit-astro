// npm run section-id (design D3).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { newId, SECTION_ID, usedIds } from "../scripts/section-id.mjs";

describe("section-id", () => {
  it("generates ids that match the pattern", () => {
    for (let i = 0; i < 5000; i++) assert.match(newId(new Set()), SECTION_ID);
  });

  it("rejects the documented invalid ids", () => {
    for (const id of ["hero1", "abcd", "1abc"]) assert.doesNotMatch(id, SECTION_ID);
    assert.match("s7k2", SECTION_ID);
  });

  it("skips ids that are in use", () => {
    // A random source that first produces "s7k2", then "q1m9".
    const letters = "abcdefghijklmnopqrstuvwxyz";
    const chars = `${letters}0123456789`;
    const draws = ["s7k2", "q1m9"].flatMap((id) => [letters.indexOf(id[0]), ...[...id.slice(1)].map((c) => chars.indexOf(c))]);
    const random = () => draws.shift();
    assert.equal(newId(new Set(["s7k2"]), random), "q1m9");
  });

  describe("with git history", () => {
    let repo;
    const git = (...args) => execFileSync("git", args, { cwd: repo, stdio: "ignore" });

    before(async () => {
      repo = await mkdtemp(join(tmpdir(), "site-kit-section-id-"));
      git("init", "-q");
      git("config", "user.email", "test@example.com");
      git("config", "user.name", "Test");
      await mkdir(join(repo, "pages"));
      const page = join(repo, "pages", "home.md");
      await writeFile(page, "---\ntitle: Home\nsections:\n  - id: s7k2\n    type: hero\n  - { id: q1m9, type: faq }\n---\n");
      git("add", ".");
      git("commit", "-q", "-m", "add sections");
      await writeFile(page, "---\ntitle: Home\nsections:\n  - id: a2b3\n    type: hero\n---\n");
      git("commit", "-q", "-am", "replace sections");
    });
    after(() => rm(repo, { recursive: true, force: true }));

    it("collects current and deleted ids", () => {
      const used = usedIds("pages/home.md", repo);
      for (const id of ["s7k2", "q1m9", "a2b3"]) assert.ok(used.has(id), `${id} not found`);
    });

    it("never returns an id from the file's history", () => {
      const used = usedIds("pages/home.md", repo);
      for (let i = 0; i < 2000; i++) assert.ok(!used.has(newId(used)));
    });

    it("works for a new file with no history", () => {
      assert.equal(usedIds("pages/new.md", repo).size, 0);
    });
  });
});
