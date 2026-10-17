// Reads HOOKS.md, the kit's hook reference (site-kit-design-system design
// D30, D42). Every table row whose first cell is a hook in backticks names a
// hook: an `sk-` class, or an attribute (`data-*`, `aria-*`). Attributes in
// the `## Other attributes` table name something rather than a state. Rows in
// the `## Deprecated` table are hooks too, so the markup still has to render
// them, and they also come back with their replacement.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The reference that ships with the package.
export const HOOKS_FILE = fileURLToPath(new URL("../HOOKS.md", import.meta.url));

const ROW = /^\| `((?:sk|data|aria)-[a-z0-9_-]+)` \|([^\n]*)$/gm;

/**
 * The hooks a reference lists:
 * - classes: every `sk-` class, deprecated ones included;
 * - states: every state attribute, deprecated ones included;
 * - attributes: the attributes that aren't states, such as `data-icon`;
 * - deprecated: each deprecated hook, with `replacement` (a hook, or null
 *   when there is none), `since` (the version that deprecated it) and `note`.
 */
export function parseHooks(markdown) {
  const classes = new Set();
  const states = new Set();
  const attributes = new Set();
  const deprecated = new Map();
  const headings = [...markdown.matchAll(/^## (.+?)\s*$/gm)].map((m) => ({ index: m.index, title: m[1] }));
  const sectionAt = (index) => headings.findLast((heading) => heading.index < index)?.title;

  for (const match of markdown.matchAll(ROW)) {
    const [, hook, rest] = match;
    const section = sectionAt(match.index);
    if (hook.startsWith("sk-")) classes.add(hook);
    else (section === "Other attributes" ? attributes : states).add(hook);
    if (section === "Deprecated") {
      const [instead = "", since = "", note = ""] = rest.split("|").map((cell) => cell.trim());
      deprecated.set(hook, { replacement: instead.match(/^`([^`]+)`$/)?.[1] ?? null, since, note });
    }
  }
  return { classes, states, attributes, deprecated };
}

// The hooks of a reference file, the package's own by default.
export function readHooks(file = HOOKS_FILE) {
  return parseHooks(readFileSync(file, "utf8"));
}
