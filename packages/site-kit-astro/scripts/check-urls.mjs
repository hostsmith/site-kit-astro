// Checks that every path the site keeps from its old site has a page
// (design D12):
//
//   npm run check:urls                      # against the build output
//   npm run check:urls -- --live <site url> # against a deployed site
//
// The paths come from .hostsmith/old-urls.txt, one per line. Against the
// build output, each path is mapped to the file Hostsmith would serve for it:
// "/about" is served from `about`, `about/index.html` or `about/index.htm`,
// "/about/" from `about/index.html` or `about/index.htm`, and "/" from
// `index.html`. With --live, each path must return 200 without a redirect.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export function readPaths(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

// The output file Hostsmith serves for a URL path, or undefined.
export function servedFile(dist, path) {
  const object = decodeURIComponent(path.split(/[?#]/)[0]).replace(/^\/+/, "");
  const trimmed = object.replace(/\/+$/, "");
  const prefix = trimmed === "" ? "" : `${trimmed}/`;
  const candidates =
    object === "" || object.endsWith("/")
      ? [`${prefix}index.html`, `${prefix}index.htm`]
      : [trimmed, `${prefix}index.html`, `${prefix}index.htm`];
  return candidates.find((candidate) => {
    const file = join(dist, candidate);
    return existsSync(file) && statSync(file).isFile();
  });
}

export function checkBuild(paths, dist) {
  return paths.filter((path) => servedFile(dist, path) === undefined).map((path) => ({ path, problem: "no page in the build output" }));
}

export async function checkLive(paths, base) {
  const failures = [];
  for (const path of paths) {
    const url = new URL(path, base);
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status !== 200) {
        const location = response.headers.get("location");
        failures.push({ path, problem: `status ${response.status}${location ? `, redirects to ${location}` : ""}` });
      }
    } catch (error) {
      failures.push({ path, problem: `request failed: ${error.message}` });
    }
  }
  return failures;
}

function buildOutput() {
  try {
    return JSON.parse(readFileSync("hostsmith.json", "utf8")).build?.output ?? "dist";
  } catch {
    return "dist";
  }
}

async function main(args) {
  const liveIndex = args.indexOf("--live");
  const live = liveIndex === -1 ? undefined : args[liveIndex + 1];
  if (liveIndex !== -1 && !live) throw new Error("Usage: npm run check:urls -- --live <site url>");

  const listFile = ".hostsmith/old-urls.txt";
  if (!existsSync(listFile)) throw new Error(`Missing ${listFile}: list the old site's paths, one per line.`);
  const paths = readPaths(readFileSync(listFile, "utf8"));

  let failures;
  if (live) {
    failures = await checkLive(paths, live);
  } else {
    const dist = buildOutput();
    if (!existsSync(dist)) throw new Error(`Missing build output ${dist}/. Run npm run build first.`);
    failures = checkBuild(paths, dist);
  }

  const target = live ?? "the build output";
  if (failures.length > 0) {
    console.error(`${failures.length} of ${paths.length} old URLs fail on ${target}:`);
    for (const { path, problem } of failures) console.error(`  ${path}: ${problem}`);
    process.exit(1);
  }
  console.log(`All ${paths.length} old URLs have a page on ${target}.`);
}

// `site-kit check-urls [--live <site url>]` (bin/site-kit.mjs).
export function cli(args) {
  return main(args).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
