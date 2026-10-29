// site-kit-interactive-parts, "The site's reduced motion setting"
// (site-kit-motion design D164). The browser tests are in
// browser/reduced-motion.test.mjs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFixture } from "./helpers.mjs";

const setting = (value) => ({ "src/site.config.ts": (text) => text.replace("  collections: {", `  reducedMotion: ${JSON.stringify(value)},\n  collections: {`) });

describe("reducedMotion", () => {
  it("fails the build on an unknown value, naming the allowed ones", async () => {
    const bad = await buildFixture("base", { edit: setting("sometimes") });
    await bad.cleanup();
    assert.equal(bad.ok, false);
    assert.match(bad.output, /reducedMotion in src\/site\.config\.ts is "sometimes"\. It is "respect", the default, or "ignore"\./);
  });

  it("builds with respect as without the setting", async () => {
    const [plain, respect] = await Promise.all([buildFixture("base"), buildFixture("base", { edit: setting("respect") })]);
    try {
      assert.ok(respect.ok, respect.output);
      assert.equal(await respect.read("index.html"), await plain.read("index.html"));
    } finally {
      await Promise.all([plain.cleanup(), respect.cleanup()]);
    }
  });
});
