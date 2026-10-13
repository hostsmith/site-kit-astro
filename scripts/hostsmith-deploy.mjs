// Deploys the build output to a Hostsmith site (used by .github/workflows/hostsmith.yml).
//
//   node scripts/hostsmith-deploy.mjs check    # before the build: checks the configuration
//   node scripts/hostsmith-deploy.mjs deploy   # after the build: uploads and waits until live
//
// Environment:
//   HOSTSMITH_TARGET           "production" or "preview"
//   HOSTSMITH_TOKEN            Hostsmith API token, restricted to the production and preview sites
//   HOSTSMITH_PREVIEW_SITE_ID  site id of the preview site (optional; previews are skipped without it)
//   HOSTSMITH_PARTITION        "us" or "eu", when the sites aren't in the account's home partition
//
// The production site is `site.id` in hostsmith.json. Hostsmith replaces the
// whole site on every deploy, so every file of the build output is uploaded.
// The API token never appears in output.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";

export const POLL_INTERVAL_MS = 5_000;
export const TIMEOUT_MS = 10 * 60_000;
const TARGETS = ["production", "preview"];

export class DeployError extends Error {}

// Resolves and checks the configuration. Returns { skip: true } for a
// preview without a preview site.
export function resolveConfig(env, manifest) {
  const target = env.HOSTSMITH_TARGET;
  if (!TARGETS.includes(target)) {
    throw new DeployError(`HOSTSMITH_TARGET must be "production" or "preview", not ${JSON.stringify(target ?? "")}.`);
  }

  let siteId;
  if (target === "production") {
    siteId = manifest.site?.id ?? "";
    if (!siteId) throw new DeployError("site.id in hostsmith.json must be set to the Hostsmith site that production deploys go to.");
  } else {
    siteId = env.HOSTSMITH_PREVIEW_SITE_ID ?? "";
    if (!siteId) return { target, skip: true };
  }

  if (!env.HOSTSMITH_TOKEN) {
    throw new DeployError("The repository secret HOSTSMITH_TOKEN isn't set. Create a Hostsmith API token restricted to this site and store it there.");
  }
  const partition = env.HOSTSMITH_PARTITION || undefined;
  if (partition !== undefined && partition !== "us" && partition !== "eu") {
    throw new DeployError(`HOSTSMITH_PARTITION must be "us" or "eu", not ${JSON.stringify(partition)}.`);
  }
  const output = manifest.build?.output || "dist";
  return { target, skip: false, siteId, partition, output, token: env.HOSTSMITH_TOKEN };
}

// Removes the API token from text, in case an unexpected error echoes it.
export function redact(text, token) {
  return token ? text.split(token).join("***") : text;
}

// Turns an SDK error into a message that says what to fix.
export function explain(step, error, siteId) {
  const status = typeof error?.status === "number" ? error.status : undefined;
  const detail = error?.message ? `: ${error.message}` : "";
  if (error?.name === "AuthError" || status === 401) {
    return `${step} failed (401${detail}). The API token in HOSTSMITH_TOKEN is invalid, expired or revoked. Create a new Hostsmith API token and store it in HOSTSMITH_TOKEN.`;
  }
  if (status === 403) {
    return `${step} failed (403${detail}). The API token in HOSTSMITH_TOKEN can't access site ${siteId}. Create a token that includes this site.`;
  }
  if (status === 404) {
    return `${step} failed (404${detail}). Site ${siteId} doesn't exist in the token's organization. Check the site id and HOSTSMITH_PARTITION.`;
  }
  if (status === 413) {
    return `${step} failed (413${detail}). The build output is larger than the plan's upload limit.`;
  }
  return status === undefined ? `${step} failed${detail}.` : `${step} failed (${status}${detail}).`;
}

// Polls until the uploaded version is live, the site has failed, or the timeout
// passes. Finalize sets the site to UPDATING; processing ends in ACTIVE (live)
// or FAILED. Deploys to one target run one at a time, so the status belongs to
// this deploy. The first poll waits one interval, so an eventually-consistent
// read can't return the status from before finalize. Hostsmith doesn't keep the
// site's deployId up to date yet; when it does, a matching one counts as live too.
export async function waitUntilLive(client, siteId, versionId, { sleep = delay, now = Date.now, interval = POLL_INTERVAL_MS, timeout = TIMEOUT_MS } = {}) {
  const expected = `${siteId}.${versionId}`;
  const deadline = now() + timeout;
  let last;
  for (;;) {
    await sleep(interval);
    try {
      last = await client.sites.get(siteId);
    } catch (error) {
      throw new DeployError(explain("Checking the deploy", error, siteId));
    }
    if (last.siteStatus === "FAILED") {
      throw new DeployError(`Processing failed: site ${siteId} has status FAILED after the upload. Check the storage quota and the files in the build output.`);
    }
    if (last.siteStatus === "ACTIVE" || last.deployId === expected) return last;
    if (now() >= deadline) {
      throw new DeployError(`Timed out after ${timeout / 60_000} minutes waiting for version ${versionId}. Last status: ${last.siteStatus ?? "unknown"}.`);
    }
  }
}

export async function deploy(config, { client, sha, log = console.log, summary, sleep, now }) {
  log(`Deploying ${config.output}/ to the ${config.target} site ${config.siteId}...`);
  let result;
  try {
    result = await client.sites.deploy(config.siteId, config.output);
  } catch (error) {
    throw new DeployError(explain("Upload", error, config.siteId));
  }
  log(`Uploaded version ${result.versionId}. Waiting until it is live...`);
  const site = await waitUntilLive(client, config.siteId, result.versionId, { sleep, now });
  const address = `https://${site.subdomain}.${site.domain}`;
  log(`Live: ${address}`);
  summary?.(`### Deployed to ${config.target}\n\n- Site: ${address}\n- Commit: \`${sha ?? "unknown"}\`\n- Version: \`${result.versionId}\`\n`);
  return { address, versionId: result.versionId };
}

async function createClient(config, kitVersion) {
  const { Hostsmith } = await import("@hostsmith/sdk");
  return new Hostsmith({ apiToken: config.token, partition: config.partition, userAgent: `hostsmith-site-kit/${kitVersion}` });
}

async function main(command, env) {
  if (!existsSync("hostsmith.json")) throw new DeployError("hostsmith.json is missing.");
  const manifest = JSON.parse(readFileSync("hostsmith.json", "utf8"));
  const config = resolveConfig(env, manifest);
  const setOutput = (line) => env.GITHUB_OUTPUT && appendFileSync(env.GITHUB_OUTPUT, `${line}\n`);

  if (command === "check") {
    if (config.skip) {
      console.log("No preview site configured (HOSTSMITH_PREVIEW_SITE_ID). Skipping the deploy.");
      setOutput("deploy=false");
    } else {
      console.log(`Configuration OK: ${config.target} site ${config.siteId}.`);
      setOutput("deploy=true");
    }
    return;
  }
  if (command !== "deploy") throw new DeployError("Usage: node scripts/hostsmith-deploy.mjs check|deploy");
  if (config.skip) return;
  if (!existsSync(config.output)) throw new DeployError(`Build output ${config.output}/ is missing. The build step must run first.`);

  const client = await createClient(config, manifest.kit?.version ?? "0.0.0");
  await deploy(config, {
    client,
    sha: env.GITHUB_SHA,
    summary: env.GITHUB_STEP_SUMMARY ? (text) => appendFileSync(env.GITHUB_STEP_SUMMARY, text) : undefined,
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2], process.env).catch((error) => {
    const message = error instanceof DeployError ? error.message : `Deploy failed: ${error?.message ?? error}`;
    console.error(`::error title=Hostsmith deploy::${redact(message, process.env.HOSTSMITH_TOKEN)}`);
    process.exit(1);
  });
}
