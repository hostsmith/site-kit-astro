// site-kit-deploy-workflow: the deploy script, on a mocked SDK client.
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { DeployError, deploy, explain, redact, resolveConfig, waitUntilLive } from "../packages/site-kit-astro/scripts/hostsmith-deploy.mjs";
import { PACKAGE, run } from "./helpers.mjs";

const TOKEN = "hsat_secretvalue1234567890";
const manifest = { kit: { version: "0.2.0" }, site: { id: "prod-site" }, build: { output: "dist" } };
const env = { HOSTSMITH_TARGET: "production", HOSTSMITH_TOKEN: TOKEN };

const apiError = (status, message) => Object.assign(new Error(message), { name: status === 401 ? "AuthError" : "ApiError", status });

// A client whose site goes through the given statuses after the upload. Like
// Hostsmith today, it reports no deployId.
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
        return { id: siteId, subdomain: "acme", domain: "us.hostsmith.link", siteStatus: status };
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

  it("fails without the token, naming the secret and the environment", () => {
    assert.throws(() => resolveConfig({ HOSTSMITH_TARGET: "production" }, manifest), /secret HOSTSMITH_TOKEN isn't set in the production environment or the repository/);
  });

  it("fails on an unknown partition or target", () => {
    assert.throws(() => resolveConfig({ ...env, HOSTSMITH_PARTITION: "asia" }, manifest), /HOSTSMITH_PARTITION must be "us" or "eu"/);
    assert.throws(() => resolveConfig({ ...env, HOSTSMITH_TARGET: "staging" }, manifest), /HOSTSMITH_TARGET must be/);
  });
});

describe("deploy", () => {
  const config = resolveConfig(env, manifest);

  it("uploads, waits until the new version is live, and writes the summary", async () => {
    const client = mockClient({ statuses: ["UPDATING", "UPDATING", "ACTIVE"] });
    const out = capture();
    const outputs = [];
    const result = await deploy(config, { client, sha: "abc1234", ...out, setOutput: (line) => outputs.push(line), ...fakeTime() });
    assert.deepEqual(client.calls.deploy, [["prod-site", "dist"]]);
    assert.equal(client.calls.get, 3);
    assert.equal(result.address, "https://acme.us.hostsmith.link");
    const summary = out.lines.at(-1);
    assert.match(summary, /Site: https:\/\/acme\.us\.hostsmith\.link/);
    assert.match(summary, /Commit: `abc1234`/);
    // The GitHub environment's URL.
    assert.deepEqual(outputs, ["url=https://acme.us.hostsmith.link"]);
  });

  it("sets no URL when the deploy fails", async () => {
    const outputs = [];
    await assert.rejects(deploy(config, { client: mockClient({ statuses: ["FAILED"] }), ...capture(), setOutput: (line) => outputs.push(line), ...fakeTime() }));
    assert.deepEqual(outputs, []);
  });

  it("checks only after the first interval, so a stale read can't pass", async () => {
    const time = fakeTime();
    const client = mockClient({ statuses: ["ACTIVE"] });
    const firstCheckAt = [];
    const get = client.sites.get;
    client.sites.get = async (siteId) => {
      firstCheckAt.push(time.now());
      return get(siteId);
    };
    await waitUntilLive(client, "prod-site", "v2", time);
    assert.deepEqual(firstCheckAt, [5_000]);
  });

  it("keeps waiting while the site is UPDATING", async () => {
    const client = mockClient({ statuses: ["UPDATING"] });
    await assert.rejects(waitUntilLive(client, "prod-site", "v2", { ...fakeTime(), timeout: 20_000 }), /Timed out .* Last status: UPDATING\./);
    assert.ok(client.calls.get >= 4);
  });

  it("counts a matching deployId as live", async () => {
    const client = mockClient();
    client.sites.get = async (siteId) => ({ siteStatus: "UPDATING", deployId: `${siteId}.v2`, subdomain: "acme", domain: "x" });
    const site = await waitUntilLive(client, "prod-site", "v2", fakeTime());
    assert.equal(site.deployId, "prod-site.v2");
  });

  it("fails when processing fails", async () => {
    const client = mockClient({ statuses: ["UPDATING", "FAILED"] });
    await assert.rejects(deploy(config, { client, ...capture(), ...fakeTime() }), /Processing failed: site prod-site has status FAILED/);
  });

  it("fails after 10 minutes with the last status", async () => {
    const client = mockClient({ statuses: ["UPDATING"] });
    const time = fakeTime();
    await assert.rejects(deploy(config, { client, ...capture(), ...time }), /Timed out after 10 minutes .* Last status: UPDATING/);
    assert.ok(time.now() >= 10 * 60_000);
  });

  it("explains a rejected token", async () => {
    const client = mockClient({ deployError: apiError(401, "Invalid or expired token") });
    await assert.rejects(deploy(config, { client, ...capture() }), (error) => {
      assert.ok(error instanceof DeployError);
      assert.match(error.message, /Upload failed \(401: Invalid or expired token\)\. .*Create a new Hostsmith API token and store it in the HOSTSMITH_TOKEN secret of the production environment \(or of the repository\)/);
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
      const script = join(PACKAGE, "bin", "site-kit.mjs");
      const ok = await run(process.execPath, [script, "deploy", "check"], { cwd: dir, env: { ...env, GITHUB_OUTPUT: output } });
      assert.equal(ok.code, 0, ok.output);
      assert.equal(await readFile(output, "utf8"), "deploy=true\n");
      assert.ok(!ok.output.includes(TOKEN));

      await writeFile(join(dir, "hostsmith.json"), JSON.stringify({ ...manifest, site: { id: "" } }));
      const missing = await run(process.execPath, [script, "deploy", "check"], { cwd: dir, env });
      assert.equal(missing.code, 1);
      assert.match(missing.output, /::error title=Hostsmith deploy::site\.id in hostsmith\.json must be set/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
