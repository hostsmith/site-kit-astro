// site-kit-deploy-workflow, "Workflow supply chain".
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { BASICS, EXAMPLE_NAMES, EXAMPLES, REPO } from "./helpers.mjs";

// The kit repository's own workflows, and the examples' deploy workflow.
const kitDir = join(REPO, ".github", "workflows");
const deployFile = join(BASICS, ".github", "workflows", "hostsmith.yml");
const exampleDeployFiles = EXAMPLE_NAMES.map((example) => join(EXAMPLES, example, ".github", "workflows", "hostsmith.yml"));
const workflows = [...readdirSync(kitDir).filter((f) => f.endsWith(".yml")).map((f) => join(kitDir, f)), ...exampleDeployFiles];
const deploy = readFileSync(deployFile, "utf8");

describe("workflows", () => {
  it("are the same deploy workflow in every example", () => {
    for (const file of exampleDeployFiles) assert.equal(readFileSync(file, "utf8"), deploy, file);
  });

  it("pin every action to a full commit SHA", () => {
    for (const file of workflows) {
      for (const [, ref] of readFileSync(file, "utf8").matchAll(/uses:\s*(\S+)/g)) {
        if (ref.startsWith("./")) continue;
        assert.match(ref, /@[0-9a-f]{40}$/, `${file}: ${ref} is not pinned to a commit SHA`);
      }
    }
  });

  it("never use pull_request_target", () => {
    for (const file of workflows) assert.ok(!readFileSync(file, "utf8").includes("pull_request_target"), file);
  });

  it("deploy with read-only contents", () => {
    assert.match(deploy, /^permissions:\n {2}contents: read\n\n/m);
    assert.doesNotMatch(deploy, /pull_request/);
  });

  it("keep the deploy workflow out of the kit repository's own workflows", () => {
    assert.ok(!readdirSync(kitDir).includes("hostsmith.yml"));
    assert.doesNotMatch(deploy, /github\.repository/);
  });

  it("run the kit's tests and releases only in the kit repository", () => {
    for (const file of ["ci.yml", "release.yml", "reference-site.yml"]) {
      assert.match(readFileSync(join(kitDir, file), "utf8"), /github\.repository == 'hostsmith\/site-kit-astro'/, file);
    }
  });

  // site-kit-package, "The reference site deploys from the kit repository".
  describe("reference sites", () => {
    const reference = readFileSync(join(kitDir, "reference-site.yml"), "utf8");
    const deployJob = reference.slice(reference.indexOf("\n  deploy:\n"));
    // A workflow's steps, by name, action or command, in order.
    const steps = (text) => [...text.matchAll(/^ {6}- (name|uses|run): (.+)$/gm)].map(([, , value]) => value.replace(/@[0-9a-f]{40}.*$/, ""));
    const KIT_ONLY = "Use the reference production site";

    it("deploy once per example, from the list of examples", () => {
      assert.match(reference, /run: node scripts\/list-examples\.mjs >> "\$GITHUB_OUTPUT"/);
      assert.match(deployJob, /needs: \[examples\]\n/);
      assert.match(deployJob, /fail-fast: false\n {6}matrix:\n {8}example: \$\{\{ fromJSON\(needs\.examples\.outputs\.list\) \}\}\n/);
    });

    it("take the examples' deploy steps in the same order", () => {
      assert.deepEqual(steps(deployJob).filter((step) => step !== KIT_ONLY), steps(deploy));
    });

    it("run in the example's folder, with the workspace's install", () => {
      assert.match(deployJob, /defaults:\n {6}run:\n {8}working-directory: examples\/\$\{\{ matrix\.example\.name \}\}\n/);
      assert.match(deployJob, /- run: npm ci\n {8}working-directory: \.\n/);
      assert.match(deployJob, /group: reference-site-\$\{\{ matrix\.example\.name \}\}-/);
    });

    it("deploy branches to preview and release tags to production", () => {
      assert.match(reference, /push:\n {4}branches-ignore: \[main\]\n {4}tags: \["v\*"\]\n/);
      assert.ok(deployJob.includes("name: ${{ github.ref_type == 'tag' && 'production' || 'preview' }}"));
      assert.ok(deployJob.indexOf(KIT_ONLY) < deployJob.indexOf("- name: Check configuration"), "the production site is set before the check");
    });

    it("take each example's site from its variable in the target's environment", () => {
      assert.ok(deployJob.includes("HOSTSMITH_SITE_ID: ${{ vars[format('HOSTSMITH_SITE_ID_{0}', matrix.example.key)] }}"));
      const passed = [...deployJob.matchAll(/HOSTSMITH_PREVIEW_SITE_ID: (.+)/g)].map(([, value]) => value);
      assert.deepEqual(passed, ["${{ env.HOSTSMITH_SITE_ID }}", "${{ env.HOSTSMITH_SITE_ID }}"], "the check and the deploy");
      assert.doesNotMatch(reference, /vars\.HOSTSMITH_(PREVIEW_)?SITE_ID\b/);
    });

    it("name each example's site variable after its folder", async () => {
      const { listExamples } = await import("../scripts/list-examples.mjs");
      assert.deepEqual(listExamples(EXAMPLES), EXAMPLE_NAMES.map((name) => ({ name, key: name.toUpperCase().replaceAll("-", "_") })));
      assert.deepEqual(listExamples(EXAMPLES).find((e) => e.name === "basics"), { name: "basics", key: "BASICS" });
    });
  });

  // site-kit-repository, "Kit releases are versioned"; site-kit-updates design D26.
  it("publish the package from the release tag by OIDC, with no npm token", () => {
    const release = readFileSync(join(kitDir, "release.yml"), "utf8");
    const publish = release.slice(release.indexOf("\n  publish:\n"));
    assert.ok(publish.length > 1, "no publish job");
    assert.match(publish, /needs: \[release\]\n {4}if: needs\.release\.outputs\.released == 'true'\n/);
    assert.match(publish, /permissions:\n {6}contents: read\n {6}id-token: write\n/);
    assert.match(publish, /ref: \$\{\{ needs\.release\.outputs\.tag \}\}/);
    assert.match(publish, /npm publish --workspace packages\/site-kit-astro --provenance --access public/);
    assert.doesNotMatch(release, /NODE_AUTH_TOKEN|NPM_TOKEN/);
  });

  it("check the published package from the registry, outside the workspace", () => {
    const release = readFileSync(join(kitDir, "release.yml"), "utf8");
    const check = release.slice(release.indexOf("- name: Check the published package"));
    assert.ok(release.indexOf("npm publish") < release.indexOf("- name: Check the published package"), "the check runs after npm publish");
    assert.match(check, /cp -R examples\/basics "\$RUNNER_TEMP\/site"\n\s+cd "\$RUNNER_TEMP\/site"\n/);
    assert.match(check, /npm install --no-audit --no-fund/);
    assert.match(check, /npm run build/);
  });

  // site-kit-updates design D26: npm processes a publish before serving it.
  it("wait for npm to serve the version, and survive a re-run of the publish", () => {
    const release = readFileSync(join(kitDir, "release.yml"), "utf8");
    const check = release.slice(release.indexOf("- name: Check the published package"));
    const wait = check.indexOf('npm view "@hostsmith/site-kit-astro@$version" version');
    assert.ok(wait > -1 && wait < check.indexOf("npm install"), "the check waits for the version before installing it");
    assert.match(check, /for attempt in \$\(seq 60\)[\s\S]*sleep 30/, "for up to 30 minutes");
    assert.match(check, /timeout-minutes: 40/);
    const publish = release.slice(release.indexOf("- name: Publish"), release.indexOf("- name: Check the published package"));
    assert.match(publish, /grep -q "cannot publish over the previously published versions"[\s\S]*exit 0/, "a re-run goes on past an accepted version");
  });

  it("checks the configuration before the build and deploys after it", () => {
    const order = ["npm ci", "npx site-kit deploy check", "$BUILD_COMMAND", "npx site-kit deploy deploy"].map((step) => deploy.indexOf(step));
    assert.ok(order.every((i) => i > -1), "a step is missing");
    assert.deepEqual([...order].sort((a, b) => a - b), order);
  });

  it("runs in the target's environment and links the deployment to the site", () => {
    const target = "github.event_name == 'workflow_dispatch' && inputs.target || (github.ref_name == 'main' && 'production' || 'preview')";
    const expression = `\${{ ${target} }}`;
    assert.ok(deploy.includes(`environment:\n      name: ${expression}\n      url: \${{ steps.deploy.outputs.url }}\n`), "environment name and url");
    // The environment, the concurrency group and the script agree on the target.
    assert.ok(deploy.includes(`HOSTSMITH_TARGET: ${expression}`));
    assert.ok(deploy.includes(`group: hostsmith-${expression}`));
    assert.match(deploy, /- name: Deploy\n {8}id: deploy\n/);
  });

  it("always builds previews with SITE_NOINDEX=true", () => {
    assert.match(deploy, /SITE_NOINDEX: \$\{\{ env\.HOSTSMITH_TARGET == 'preview' && 'true' \|\| vars\.SITE_NOINDEX \}\}/);
  });
});
