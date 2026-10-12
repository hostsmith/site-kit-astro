// site-kit-deploy-workflow: the deploy script, on a mocked SDK client.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DeployError, deploy, explain, redact, resolveConfig, waitUntilLive } from "../scripts/hostsmith-deploy.mjs";
import { ROOT, run } from "./helpers.mjs";

const TOKEN = "hsat_secretvalue1234567890";
const manifest = { kit: { version: "0.2.0" }, site: { id: "prod-site" }, build: { output: "dist" } };
const env = { HOSTSMITH_TARGET: "production", HOSTSMITH_TOKEN: TOKEN };

const apiError = (status, message) => Object.assign(new Error(message), { name: status === 401 ? "AuthError" : "ApiError", status });

// A client whose site goes through the given statuses after the upload.
function mockClient({ statuses = ["ACTIVE"], deployError, versionId = "v2" } = {}) {
  const calls = { deploy: [], get: 0 };
  return {
    calls,
    sites: {
      deploy: async (siteId, dir) => {
        calls.deploy.push([siteId, dir]);
        if (deployError) throw deployError;
        return { versionId, status: "processing" };
      },
      get: async (siteId) => {
        const status = statuses[Math.min(calls.get++, statuses.length - 1)];
        return { id: siteId, subdomain: "acme", domain: "us.hostsmith.link", siteStatus: status, deployId: status === "ACTIVE" ? `${siteId}.${versionId}` : `${siteId}.v1` };
      },
    },
  };
}

// Collects everything the script writes.
function capture() {
  const lines = [];
  return { lines, log: (line) => lines.push(line), summary: (text) => lines.push(text) };
}

const fakeTime = () => {
  let t = 0;
  return { now: () => t, sleep: async (ms) => void (t += ms) };
};

describe("configuration", () => {
  it("targets site.id for production", () => {
    assert.deepEqual(resolveConfig(env, manifest), { target: "production", skip: false, siteId: "prod-site", partition: undefined, output: "dist", token: TOKEN });
  });

  it("targets the preview site, or skips without one", () => {
    assert.equal(resolveConfig({ ...env, HOSTSMITH_TARGET: "preview", HOSTSMITH_PREVIEW_SITE_ID: "prev-site" }, manifest).siteId, "prev-site");
    assert.deepEqual(resolveConfig({ ...env, HOSTSMITH_TARGET: "preview" }, manifest), { target: "preview", skip: true });
  });

  it("fails on an empty site.id", () => {
    assert.throws(() => resolveConfig(env, { ...manifest, site: { id: "" } }), /site\.id in hostsmith\.json must be set/);
  });

  it("fails without the token, naming the secret", () => {
    assert.throws(() => resolveConfig({ HOSTSMITH_TARGET: "production" }, manifest), /secret HOSTSMITH_TOKEN isn't set/);
  });

  it("fails on an unknown partition or target", () => {
    assert.throws(() => resolveConfig({ ...env, HOSTSMITH_PARTITION: "asia" }, manifest), /HOSTSMITH_PARTITION must be "us" or "eu"/);
    assert.throws(() => resolveConfig({ ...env, HOSTSMITH_TARGET: "staging" }, manifest), /HOSTSMITH_TARGET must be/);
  });
});

describe("deploy", () => {
  const config = resolveConfig(env, manifest);

  it("uploads, waits until the new version is live, and writes the summary", async () => {
    const client = mockClient({ statuses: ["PROCESSING", "PROCESSING", "ACTIVE"] });
    const out = capture();
    const result = await deploy(config, { client, sha: "abc1234", ...out, ...fakeTime() });
    assert.deepEqual(client.calls.deploy, [["prod-site", "dist"]]);
    assert.equal(client.calls.get, 3);
    assert.equal(result.address, "https://acme.us.hostsmith.link");
    const summary = out.lines.at(-1);
    assert.match(summary, /Site: https:\/\/acme\.us\.hostsmith\.link/);
    assert.match(summary, /Commit: `abc1234`/);
  });

  it("waits for the uploaded version, not an older active one", async () => {
    const client = mockClient();
    client.sites.get = async (siteId) => ({ siteStatus: "ACTIVE", deployId: `${siteId}.v1`, subdomain: "acme", domain: "x" });
    const time = fakeTime();
    await assert.rejects(waitUntilLive(client, "prod-site", "v2", { ...time, timeout: 20_000 }), /Timed out .* Last status: ACTIVE, deploy prod-site\.v1/);
  });

  it("fails when processing fails", async () => {
    const client = mockClient({ statuses: ["PROCESSING", "FAILED"] });
    await assert.rejects(deploy(config, { client, ...capture(), ...fakeTime() }), /Processing failed: site prod-site has status FAILED/);
  });

  it("fails after 10 minutes with the last status", async () => {
    const client = mockClient({ statuses: ["PROCESSING"] });
    const time = fakeTime();
    await assert.rejects(deploy(config, { client, ...capture(), ...time }), /Timed out after 10 minutes .* Last status: PROCESSING/);
    assert.ok(time.now() >= 10 * 60_000);
  });

  it("explains a rejected token", async () => {
    const client = mockClient({ deployError: apiError(401, "Invalid or expired token") });
    await assert.rejects(deploy(config, { client, ...capture() }), (error) => {
      assert.ok(error instanceof DeployError);
      assert.match(error.message, /Upload failed \(401: Invalid or expired token\)\. .*Create a new Hostsmith API token and store it in HOSTSMITH_TOKEN/);
      return true;
    });
  });

  it("explains an upload over the plan limit", async () => {
    const client = mockClient({ deployError: apiError(413, "Upload exceeds plan limit") });
    await assert.rejects(deploy(config, { client, ...capture() }), /Upload failed \(413: Upload exceeds plan limit\)\. The build output is larger than the plan's upload limit/);
  });

  it("explains a token that can't access the site", () => {
    assert.match(explain("Upload", apiError(403, "This API token can't access site prod-site"), "prod-site"), /\(403: .*\)\. .*Create a token that includes this site/);
  });

  it("never prints the token", async () => {
    const out = capture();
    await deploy(config, { client: mockClient(), sha: "abc", ...out, ...fakeTime() });
    for (const status of [401, 403, 404, 413, 500]) {
      try {
        await deploy(config, { client: mockClient({ deployError: apiError(status, "nope") }), ...out });
      } catch (error) {
        out.lines.push(error.message);
      }
    }
    assert.ok(out.lines.length > 5);
    for (const line of out.lines) assert.ok(!line.includes(TOKEN), `token printed: ${line}`);
    assert.equal(redact(`echo ${TOKEN}`, TOKEN), "echo ***");
  });
});

describe("command line", () => {
  it("checks the configuration before the build without printing the token", async () => {
    const dir = await mkdtemp(join(tmpdir(), "site-kit-deploy-"));
    try {
      await writeFile(join(dir, "hostsmith.json"), JSON.stringify(manifest));
      const output = join(dir, "github-output");
      const script = join(ROOT, "scripts", "hostsmith-deploy.mjs");
      const ok = await run(process.execPath, [script, "check"], { cwd: dir, env: { ...env, GITHUB_OUTPUT: output } });
      assert.equal(ok.code, 0, ok.output);
      assert.equal(await readFile(output, "utf8"), "deploy=true\n");
      assert.ok(!ok.output.includes(TOKEN));

      await writeFile(join(dir, "hostsmith.json"), JSON.stringify({ ...manifest, site: { id: "" } }));
      const missing = await run(process.execPath, [script, "check"], { cwd: dir, env });
      assert.equal(missing.code, 1);
      assert.match(missing.output, /::error title=Hostsmith deploy::site\.id in hostsmith\.json must be set/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
