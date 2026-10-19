// The kit's license policy (site-kit-licenses design D64, D65). Everything the
// package, with its peer astro, and each example reach in package-lock.json
// is under an allowed license, or is an exception: a copyleft build tool that
// npm installs unmodified, reached only through its parents. CONTRIBUTING.md
// gives the same lists, with a row per exception that starts with its label,
// and tests/licenses.test.mjs checks the lockfile and the doc.

export const ALLOWED = ["MIT", "MIT-0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "BlueOak-1.0.0", "CC0-1.0"];

export const EXCEPTIONS = [
  {
    // sharp's prebuilt libvips, alone or bundled into a binding. Astro installs
    // sharp as an optional dependency, and the kit never loads it (D66).
    label: "`@img/sharp-libvips-*`, `@img/sharp-win32-*`, `@img/sharp-wasm32`",
    packages: /^@img\/sharp-(libvips-.+|win32-.+|wasm32)$/,
    licenses: ["LGPL-3.0-or-later", "Apache-2.0 AND LGPL-3.0-or-later", "Apache-2.0 AND LGPL-3.0-or-later AND MIT"],
    parents: /^(sharp|@img\/sharp-(?!libvips-)[a-z0-9-]+)$/,
    through: "sharp and its bindings",
  },
  {
    // Apache-2.0 itself, but its libvips may only come through Astro.
    label: "`sharp`",
    packages: /^sharp$/,
    licenses: ["Apache-2.0"],
    parents: /^astro$/,
    through: "astro",
  },
  {
    // Vite's and Tailwind's CSS transformer.
    label: "`lightningcss`",
    packages: /^lightningcss$/,
    licenses: ["MPL-2.0"],
    parents: /^(vite|@tailwindcss\/node)$/,
    through: "vite or @tailwindcss/node",
  },
  {
    // Its prebuilt binaries, one per platform.
    label: "`lightningcss-*`",
    packages: /^lightningcss-.+$/,
    licenses: ["MPL-2.0"],
    parents: /^lightningcss$/,
    through: "lightningcss",
  },
];

// An SPDX expression without nesting: one alternative of an OR whose AND parts
// are all allowed.
function allowed(license) {
  return license
    .replace(/[()]/g, "")
    .split(" OR ")
    .some((alternative) => alternative.split(" AND ").every((part) => ALLOWED.includes(part.trim())));
}

/**
 * Returns a message for each package that breaks the policy, with the path
 * from the first root that reaches it, or [] when the lockfile complies.
 */
export function licenseProblems(lock) {
  const pkgs = lock.packages;
  const nameOf = (path) => pkgs[path].name ?? path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
  // npm's resolution: <from>/node_modules/<name>, then each parent's, then the root's.
  const resolve = (from, name) => {
    for (let base = from; ; base = base.includes("/node_modules/") ? base.slice(0, base.lastIndexOf("/node_modules/")) : "") {
      const path = base ? `${base}/node_modules/${name}` : `node_modules/${name}`;
      if (pkgs[path]) return pkgs[path].link ? pkgs[path].resolved : path;
      if (!base) return null;
    }
  };

  const roots = ["packages/site-kit-astro", ...Object.keys(pkgs).filter((path) => path.startsWith("examples/")).sort()];
  const problems = new Map();
  for (const root of roots) {
    const parent = new Map([[root, null]]);
    const chain = (path) => (path === root ? [root] : [...chain(parent.get(path)), nameOf(path)]);
    const queue = [root];
    while (queue.length) {
      const from = queue.shift();
      const entry = pkgs[from];
      for (const name of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies })) {
        const path = resolve(from, name);
        if (!path) continue;
        const exception = EXCEPTIONS.find((rule) => rule.packages.test(name));
        if (exception && !exception.parents.test(nameOf(from)) && !problems.has(`${from}>${path}`)) {
          problems.set(`${from}>${path}`, `${name}@${pkgs[path].version} is allowed only through ${exception.through}, but ${nameOf(from)} depends on it: ${[...chain(from), name].join(" > ")}`);
        }
        if (parent.has(path)) continue;
        parent.set(path, from);
        queue.push(path);

        const { license, version } = pkgs[path];
        const where = chain(path).join(" > ");
        if (problems.has(path)) continue;
        if (!license) problems.set(path, `${name}@${version} declares no license: ${where}`);
        else if (exception && !exception.licenses.includes(license)) problems.set(path, `${name}@${version} is an exception under ${exception.licenses.join(", ")}, but declares ${license}: ${where}`);
        else if (!exception && !allowed(license)) problems.set(path, `${name}@${version} is under ${license}, which the kit doesn't allow: ${where}`);
      }
    }
  }
  return [...problems.values()];
}
