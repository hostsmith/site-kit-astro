// Site icons (site-kit-webflow-example design D107): a site keeps its own
// icons in src/icons/<name>.svg. The folder is the register, so no list in
// src/site.schema.ts has to keep in step: every `icon` prop and the Decap
// select take the kit's names and these.
//
// A site icon renders inline, like a kit icon, so the build checks each file
// first. It fails, naming the file and the reason, on an icon that has a kit
// icon's name or another name than lowercase letters, digits and hyphens, that
// has no viewBox, that sets a color other than currentColor or none, or that
// holds a script, a foreignObject, a style element or attribute, an event
// handler or a link to anything but an element in the same file.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMENT_NODE, ELEMENT_NODE, parse, renderSync } from "ultrahtml";

export const SITE_ICONS_DIR = "src/icons";

const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COLOR_ATTRIBUTES = ["fill", "stroke", "color", "stop-color", "flood-color", "lighting-color"];
const COLORLESS = ["currentcolor", "none"];
const FORBIDDEN_ELEMENTS = ["script", "foreignobject", "style"];
const LINK_ATTRIBUTES = ["href", "xlink:href", "src"];
// The root's attributes that the rendered icon keeps. The kit sets the rest.
const KEPT = ["viewbox", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "fill-rule", "clip-rule"];

// The names of a site's icons, from the files in its folder, unchecked.
export function siteIconNames(root = process.cwd()) {
  const dir = join(root, SITE_ICONS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".svg"))
    .map((file) => file.slice(0, -".svg".length))
    .sort();
}

// The problems of one icon's markup, each a reason for the message.
function problemsOf(svg) {
  const problems = [];
  if (!svg) return ["has no svg element"];
  if (!Object.keys(svg.attributes).some((name) => name.toLowerCase() === "viewbox")) problems.push("has no viewBox");
  const visit = (node) => {
    if (node.type !== ELEMENT_NODE) return;
    const element = node.name.toLowerCase();
    if (FORBIDDEN_ELEMENTS.includes(element)) problems.push(`contains a ${node.name} element`);
    for (const [name, value] of Object.entries(node.attributes)) {
      const attribute = name.toLowerCase();
      const text = String(value).trim();
      if (attribute.startsWith("on")) problems.push(`has the event handler attribute ${name}`);
      else if (attribute === "style") problems.push("has a style attribute");
      else if (COLOR_ATTRIBUTES.includes(attribute) && !COLORLESS.includes(text.toLowerCase())) problems.push(`sets the color "${text}" in ${name}. Draw it in currentColor, so it follows the theme`);
      else if (LINK_ATTRIBUTES.includes(attribute) && !text.startsWith("#")) problems.push(`links to "${text}" in ${name}, which isn't an element in the same file`);
      else if (/url\(\s*(?!['"]?#)/i.test(text)) problems.push(`links to "${text}" in ${name}, which isn't an element in the same file`);
    }
    node.children.forEach(visit);
  };
  visit(svg);
  return problems;
}

/**
 * A site's icons, checked: each with its `name`, the `attributes` of its root
 * svg that the rendered icon keeps, and its `body`, the markup inside the
 * root. Throws, listing every file's problems, when an icon breaks a rule.
 * `kitNames` are the kit's own icon names, which a site icon can't take.
 */
export function readSiteIcons(root = process.cwd(), kitNames = []) {
  const icons = [];
  const problems = [];
  for (const name of siteIconNames(root)) {
    const file = `${SITE_ICONS_DIR}/${name}.svg`;
    const tree = parse(readFileSync(join(root, file), "utf8"));
    const svg = tree.children.find((node) => node.type === ELEMENT_NODE && node.name.toLowerCase() === "svg");
    const own = [
      ...(kitNames.includes(name) ? [`has the name of one of the kit's icons. Rename the file`] : []),
      ...(NAME.test(name) ? [] : ["has a name that isn't lowercase letters, digits and hyphens. Rename the file"]),
      ...problemsOf(svg),
    ];
    if (own.length > 0) {
      problems.push(...own.map((problem) => `${file} ${problem}.`));
      continue;
    }
    const attributes = Object.fromEntries(Object.entries(svg.attributes).filter(([attribute]) => KEPT.includes(attribute.toLowerCase())));
    const body = svg.children
      .filter((node) => node.type !== COMMENT_NODE)
      .map((node) => renderSync(node))
      .join("")
      .trim();
    icons.push({ name, attributes, body });
  }
  if (problems.length > 0) throw new Error(`Site icons in ${SITE_ICONS_DIR}/:\n- ${problems.join("\n- ")}`);
  return icons;
}
