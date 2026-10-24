// Reads HOOKS.md, the kit's hook reference (site-kit-design-system design
// D30, D42). Every table row whose first cell is a hook in backticks names a
// hook: an `sk-` class, or an attribute (`data-*`, `aria-*`). Attributes in
// the `## Other attributes` table name something rather than a state. Rows in
// the `## Deprecated` table are hooks too, so the markup still has to render
// them, and they also come back with their replacement.
//
// Each `###` heading under `## Sections` names a section type, and each one
// under `## Parts` a part, such as `lightbox` (site-kit-webflow-example design
// D109). Their rows are that group's hooks, which a theme styles only when its
// README lists the group. Every other row is the base layout's, which every
// theme styles.
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
 *   when there is none), `since` (the version that deprecated it) and `note`;
 * - base and groups: the hooks by where a theme owes them a rule. `base` and
 *   each group of `groups`, keyed by its name, have `classes`, a set, and
 *   `states`, a list of { name, elements }: the state and the `sk-` classes
 *   of the elements it marks, which may be none, such as for `html`. A group
 *   also has its `kind`, "type" or "part". Deprecated hooks are in neither.
 */
export function parseHooks(markdown) {
  const classes = new Set();
  const states = new Set();
  const attributes = new Set();
  const deprecated = new Map();
  const base = { classes: new Set(), states: [] };
  const groups = new Map();
  const headings = [...markdown.matchAll(/^## (.+?)\s*$/gm)].map((m) => ({ index: m.index, title: m[1] }));
  const subheadings = [...markdown.matchAll(/^### (.+?)\s*$/gm)].map((m) => ({ index: m.index, title: m[1] }));
  const sectionAt = (index) => headings.findLast((heading) => heading.index < index);
  const groupAt = (index) => {
    const section = sectionAt(index);
    const kind = { Sections: "type", Parts: "part" }[section?.title];
    const sub = subheadings.findLast((heading) => heading.index < index);
    if (!kind || !sub || sub.index < section.index) return base;
    if (!groups.has(sub.title)) groups.set(sub.title, { kind, classes: new Set(), states: [] });
    return groups.get(sub.title);
  };

  for (const match of markdown.matchAll(ROW)) {
    const [, hook, rest] = match;
    const section = sectionAt(match.index)?.title;
    if (hook.startsWith("sk-")) classes.add(hook);
    else (section === "Other attributes" ? attributes : states).add(hook);
    if (section === "Deprecated") {
      const [instead = "", since = "", note = ""] = rest.split("|").map((cell) => cell.trim());
      deprecated.set(hook, { replacement: instead.match(/^`([^`]+)`$/)?.[1] ?? null, since, note });
      continue;
    }
    if (section === "Other attributes") continue;
    const group = groupAt(match.index);
    if (hook.startsWith("sk-")) group.classes.add(hook);
    else group.states.push({ name: hook, elements: [...rest.split("|")[0].matchAll(/`(sk-[a-z0-9_-]+)`/g)].map((m) => m[1]) });
  }
  return { classes, states, attributes, deprecated, base, groups };
}

// The hooks of a reference file, the package's own by default.
export function readHooks(file = HOOKS_FILE) {
  return parseHooks(readFileSync(file, "utf8"));
}
