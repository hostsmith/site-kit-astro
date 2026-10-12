// site-kit-deploy-workflow, "Workflow supply chain".
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { ROOT } from "./helpers.mjs";

const dir = join(ROOT, ".github", "workflows");
const workflows = readdirSync(dir).filter((f) => f.endsWith(".yml"));
const deploy = readFileSync(join(dir, "hostsmith.yml"), "utf8");

describe("workflows", () => {
  it("pin every action to a full commit SHA", () => {
    for (const file of workflows) {
      for (const [, ref] of readFileSync(join(dir, file), "utf8").matchAll(/uses:\s*(\S+)/g)) {
        if (ref.startsWith("./")) continue;
        assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref} is not pinned to a commit SHA`);
      }
    }
  });

  it("never use pull_request_target", () => {
    for (const file of workflows) assert.ok(!readFileSync(join(dir, file), "utf8").includes("pull_request_target"), file);
  });

  it("deploy with read-only contents, outside the template repository", () => {
    assert.match(deploy, /^permissions:\n {2}contents: read\n\n/m);
    assert.match(deploy, /if: github\.repository != 'hostsmith\/site-kit'/);
    assert.doesNotMatch(deploy, /pull_request/);
  });

  it("checks the configuration before the build and deploys after it", () => {
    const order = ["hostsmith-deploy.mjs check", "npm ci", "$BUILD_COMMAND", "hostsmith-deploy.mjs deploy"].map((step) => deploy.indexOf(step));
    assert.ok(order.every((i) => i > -1), "a step is missing");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("always builds previews with SITE_NOINDEX=true", () => {
    assert.match(deploy, /SITE_NOINDEX: \$\{\{ env\.HOSTSMITH_TARGET == 'preview' && 'true' \|\| vars\.SITE_NOINDEX \}\}/);
  });
});
