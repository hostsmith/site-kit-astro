// Assembles the Decap CMS config, public/admin/config.yml, from the kit's part
// (config.kit.yml) and the site's part (config.site.yml):
//
//   npm run decap-config             # writes config.yml
//   npm run decap-config -- --check  # fails when config.yml is stale
//
// The assembly is text, so the kit's YAML anchors, flow mappings and comments
// survive (site-kit-updates design D19). Each `# site: <part>` line in the
// kit's part is replaced, at its indent, by the site's part:
//
// - `repo`: `repo: <repo>` from the site's `repo` key;
// - `collection options`: the names of the site's folder collections, as the
//   options of the collection list section;
// - `section types`: the site's `section_types`, each with the kit's id field
//   added as its first field;
// - `collections`: the site's `collections`.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const KIT_PART = "public/admin/config.kit.yml";
export const SITE_PART = "public/admin/config.site.yml";
export const ASSEMBLED = "public/admin/config.yml";

const MARKERS = ["repo", "collection options", "section types", "collections"];
const SITE_KEYS = ["repo", "section_types", "collections"];

const HEADER = `# Decap CMS config, assembled by \`npm run decap-config\` from
# ${KIT_PART} (the kit's part) and
# ${SITE_PART} (this site's part). Don't edit this
# file: edit one of those two and run the command again.
#
# Decap CMS and Sveltia CMS both read it. The build removes /admin, so it is
# never deployed.
`;

// The site's part, split into its three top-level keys.
export function parseSitePart(text) {
  const fail = (line, message) => {
    throw new Error(`${SITE_PART} line ${line}: ${message}`);
  };
  const keys = {};
  let current;
  text.split("\n").forEach((line, index) => {
    const number = index + 1;
    if (line.trim() === "") {
      current?.lines.push({ text: "", number });
      return;
    }
    if (line.startsWith("#")) {
      current = undefined;
      return;
    }
    const key = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (key) {
      if (!SITE_KEYS.includes(key[1])) fail(number, `unknown key "${key[1]}". The site's part has ${SITE_KEYS.join(", ")}.`);
      if (keys[key[1]]) fail(number, `"${key[1]}" is set twice.`);
      current = keys[key[1]] = { value: key[2].trim(), lines: [], number };
      return;
    }
    if (!current) fail(number, "an indented line needs a key above it, without a comment line in between at the start of a line.");
    current.lines.push({ text: line, number });
  });
  for (const key of SITE_KEYS) if (!keys[key]) throw new Error(`${SITE_PART} has no "${key}".`);

  const repo = keys.repo.value;
  if (repo === "" || keys.repo.lines.some((l) => l.text !== "")) fail(keys.repo.number, 'set "repo" to the GitHub repository, as OWNER/REPOSITORY.');

  return {
    repo,
    sectionTypes: listItems("section_types", keys.section_types, fail),
    collections: listItems("collections", keys.collections, fail),
  };
}

// The items of a list key: its lines, with the leading comments of each item.
function listItems(name, { value, lines, number }, fail) {
  while (lines.at(-1)?.text === "") lines.pop();
  if (value === "[]") {
    if (lines.length > 0) fail(lines[0].number, `"${name}" is set to [] but has items below it.`);
    return [];
  }
  if (value !== "") fail(number, `"${name}" must be a block list, with each item on its own lines, or [].`);
  if (lines.length === 0) fail(number, `"${name}" has no items. Write "${name}: []" for none.`);

  const items = [];
  let pending = [];
  for (const line of lines) {
    if (line.text === "" || /^ {2}#/.test(line.text)) {
      (items.at(-1) && pending.length === 0 && line.text === "" ? items.at(-1).lines : pending).push(line);
      continue;
    }
    const start = line.text.match(/^ {2}- (.*)$/);
    if (start) {
      const itemName = start[1].match(/^name: ([^\s#]+)\s*$/);
      if (!itemName) fail(line.number, `each item of "${name}" starts with "- name: <name>" on its own line.`);
      items.push({ name: itemName[1], lines: [...pending, line] });
      pending = [];
      continue;
    }
    if (!/^ {4}/.test(line.text) || items.length === 0) fail(line.number, `"${name}" items start with "  - name:", and their lines are indented under it.`);
    items.at(-1).lines.push(...pending, line);
    pending = [];
  }
  if (pending.some((l) => l.text !== "")) fail(pending[0].number, `comment after the last item of "${name}".`);
  return items;
}

// A section type's lines, with the kit's id field added first.
function withIdField(item) {
  const fields = item.lines.findIndex((l) => /^ {4}fields:\s*$/.test(l.text));
  if (fields === -1) {
    throw new Error(`${SITE_PART} line ${item.lines[0].number}: section type "${item.name}" needs a block "fields:" list.`);
  }
  const id = item.lines.find((l) => /^ {6}- (\{ *)?name: id\b/.test(l.text));
  if (id) throw new Error(`${SITE_PART} line ${id.number}: section type "${item.name}" has an id field. Remove it: every section type gets the kit's id field.`);
  const lines = item.lines.map((l) => l.text);
  lines.splice(fields + 1, 0, "      - *section_id");
  return lines;
}

const indent = (lines, by) => lines.map((line) => (line === "" ? "" : `${by}${line.slice(2)}`));

export function assemble(kitText, siteText) {
  const site = parseSitePart(siteText);
  const lines = kitText.replace(/\n$/, "").split("\n");

  // The kit part's header comment gives way to the assembled file's header.
  let header = 0;
  while (lines[0]?.startsWith("#")) {
    lines.shift();
    header += 1;
  }

  const found = new Map();
  lines.forEach((line, index) => {
    const marker = line.match(/^( *)# site: (.+?)\s*$/);
    if (!marker) return;
    if (!MARKERS.includes(marker[2])) throw new Error(`${KIT_PART} line ${header + index + 1}: unknown marker "# site: ${marker[2]}".`);
    if (found.has(marker[2])) throw new Error(`${KIT_PART}: marker "# site: ${marker[2]}" appears twice.`);
    found.set(marker[2], { index, pad: marker[1] });
  });
  for (const marker of MARKERS) if (!found.has(marker)) throw new Error(`${KIT_PART} has no "# site: ${marker}" line.`);

  const folders = site.collections.filter((item) => item.lines.some((l) => /^ {4}folder:/.test(l.text))).map((item) => item.name);
  const parts = {
    repo: (pad) => [`${pad}repo: ${site.repo}`],
    "collection options": (pad) => [`${pad}options: [${folders.join(", ")}]`],
    "section types": (pad) => site.sectionTypes.flatMap((item) => indent(withIdField(item), pad)),
    collections: (pad) => site.collections.flatMap((item) => indent(item.lines.map((l) => l.text), pad)),
  };

  // Replaced from the last marker up, so earlier indexes stay valid.
  for (const [marker, { index, pad }] of [...found].sort((a, b) => b[1].index - a[1].index)) {
    lines.splice(index, 1, ...parts[marker](pad));
  }
  while (lines.at(-1) === "") lines.pop();
  return `${HEADER}${lines.join("\n")}\n`;
}

export function assembleFiles(root = ".") {
  return assemble(readFileSync(join(root, KIT_PART), "utf8"), readFileSync(join(root, SITE_PART), "utf8"));
}

// Why config.yml is stale, or undefined when it matches a fresh assembly.
export function staleness(root = ".") {
  if (readFileSync(join(root, ASSEMBLED), "utf8") === assembleFiles(root)) return undefined;
  return `${ASSEMBLED} doesn't match ${KIT_PART} and ${SITE_PART}. Edit those two files, not ${ASSEMBLED}, then run npm run decap-config.`;
}

function main(args) {
  if (args.includes("--check")) {
    const problem = staleness();
    if (problem) throw new Error(problem);
    console.log(`${ASSEMBLED} is up to date.`);
    return;
  }
  writeFileSync(ASSEMBLED, assembleFiles());
  console.log(`Wrote ${ASSEMBLED} from ${KIT_PART} and ${SITE_PART}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
