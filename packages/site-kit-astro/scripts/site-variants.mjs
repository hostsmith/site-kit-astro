// Site variants (site-kit-site-variants design D159): a site's own looks for
// library section types, declared in src/site.config.ts by type and name,
// each with the label the editors show and, optionally, the type's kit
// variants it goes with:
//
//   siteVariants: {
//     faq: { boxed: { label: "Boxed, with a border" } },
//     team: { "on-blue": { label: "On a blue band", variants: ["cards"] } },
//   },
//
// A section entry picks one with `siteVariant`, and its root carries
// data-site-variant, which the site's theme styles. The build and the Decap
// generator both read the declaration through this check, so both fail on
// the same problems, with the same messages.

export const SITE_VARIANT_NAME = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const WHERE = "siteVariants in src/site.config.ts";
const EXAMPLE = '{ faq: { boxed: { label: "Boxed, with a border" } } }';

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (names) => names.map((name) => `"${name}"`).join(", ");

/**
 * The site's declaration, checked: an object of library types, each an object
 * of its site variants by name, as { label, variants }, with `variants`
 * undefined when the site variant goes with every kit variant. Types the
 * site declares no site variants for are left out. `kitVariants` has each
 * library type's kit variants, an empty list for a type without. Throws,
 * listing every problem, on a declaration that breaks a rule.
 */
export function readSiteVariants(declared, kitVariants) {
  if (declared === undefined) return {};
  if (!isObject(declared)) throw new Error(`${WHERE} must be an object of library section types, such as ${EXAMPLE}.`);
  const out = {};
  const problems = [];
  for (const [type, variants] of Object.entries(declared)) {
    const kit = kitVariants[type];
    if (kit === undefined) {
      problems.push(`"${type}" isn't a library section type. The library types are ${Object.keys(kitVariants).join(", ")}. A site-local type sets its own variants in its schema.`);
      continue;
    }
    if (!isObject(variants)) {
      problems.push(`${type} must be an object of site variants by name, such as ${EXAMPLE}.`);
      continue;
    }
    for (const [name, variant] of Object.entries(variants)) {
      const at = `${type} "${name}"`;
      const own = [];
      if (!SITE_VARIANT_NAME.test(name)) own.push("isn't kebab-case: lowercase letters and digits, joined by hyphens, starting with a letter. Rename it");
      else if (kit.includes(name)) own.push(`has the name of one of ${type}'s kit variants, ${list(kit)}. Rename it`);
      if (!isObject(variant)) {
        problems.push(`${at} must be an object with a "label", such as { label: "Boxed, with a border" }.`);
        continue;
      }
      const extra = Object.keys(variant).filter((key) => key !== "label" && key !== "variants");
      if (extra.length > 0) own.push(`has ${list(extra)}. A site variant has a "label" and, optionally, "variants"`);
      if (typeof variant.label !== "string" || variant.label.trim() === "") own.push('needs a "label", the text the editors show, such as "Boxed, with a border"');
      if (variant.variants !== undefined) {
        if (kit.length === 0) own.push(`sets "variants", but ${type} has no kit variants. Leave "variants" out`);
        else if (!Array.isArray(variant.variants) || variant.variants.length === 0) own.push(`sets "variants" to something other than a list of ${type}'s kit variants, ${list(kit)}`);
        else {
          const unknown = variant.variants.filter((kitVariant) => !kit.includes(kitVariant));
          if (unknown.length > 0) own.push(`lists ${list(unknown)} in "variants", which ${unknown.length > 1 ? "aren't kit variants" : "isn't a kit variant"} of ${type}. Its kit variants are ${list(kit)}`);
        }
      }
      if (own.length > 0) {
        problems.push(...own.map((problem) => `${at} ${problem}.`));
        continue;
      }
      out[type] ??= {};
      out[type][name] = { label: variant.label, variants: variant.variants === undefined ? undefined : [...variant.variants] };
    }
  }
  if (problems.length > 0) throw new Error(`${WHERE}:\n- ${problems.join("\n- ")}`);
  return out;
}
