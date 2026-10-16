// The section registry (design D2).
//
// A type's name is its component's file name: library types live in this
// folder of the kit, site-local types in the site's
// src/components/sections/site/<type>.astro. Each type also needs a schema,
// in the kit's src/kit-content.ts for library types and the site's
// src/site.schema.ts for site-local ones, and a Decap type in the kit's
// decap/config.kit.yml or the site's public/admin/config.site.yml. Any
// mismatch fails the build here.
import { isSiteSectionType, sectionSchemas, type Section } from "../../content.ts";

type SectionComponent = (props: { section: Section; entry: string; primary: boolean }) => unknown;

const library = import.meta.glob<SectionComponent>("./*.astro", { eager: true, import: "default" });
// A root-relative glob is resolved from the site's root (site-kit-updates design D20).
const site = import.meta.glob<SectionComponent>("/src/components/sections/site/*.astro", { eager: true, import: "default" });

const typeName = (file: string) => file.slice(file.lastIndexOf("/") + 1, -".astro".length);
const libraryFile = (type: string) => `the kit's src/components/sections/${type}.astro`;
const siteFile = (type: string) => `src/components/sections/site/${type}.astro`;

const components = new Map<string, { file: string; component: SectionComponent }>();
const problems: string[] = [];

for (const [file, component] of Object.entries(library)) components.set(typeName(file), { file: libraryFile(typeName(file)), component });

for (const [file, component] of Object.entries(site)) {
  const type = typeName(file);
  if (components.has(type)) {
    problems.push(`Site-local section type "${type}" (${siteFile(type)}) has the same name as a library type. Rename it.`);
    continue;
  }
  components.set(type, { file: siteFile(type), component });
}

for (const [type, { file }] of components) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(type)) {
    problems.push(`Section type "${type}" (${file}) must be a kebab-case name, such as "menu-board".`);
  }
  if (!Object.hasOwn(sectionSchemas, type)) {
    const schemaFile = file.startsWith("src/") ? "siteSectionSchemas in src/site.schema.ts" : "the kit's src/kit-content.ts";
    problems.push(`Section type "${type}" has a component (${file}) but no schema in ${schemaFile}.`);
  }
}

for (const [type, schema] of Object.entries(sectionSchemas)) {
  const schemaFile = isSiteSectionType(type) ? "src/site.schema.ts" : "the kit's src/kit-content.ts";
  const typeValue = (schema.shape.type as { value?: unknown } | undefined)?.value;
  if (typeValue !== type) {
    problems.push(`Section schema "${type}" in ${schemaFile} has type "${typeValue}". The key and the type must be the same.`);
  }
  if (!components.has(type)) {
    const component = isSiteSectionType(type) ? siteFile(type) : libraryFile(type);
    problems.push(`Section type "${type}" has a schema in ${schemaFile} but no component. Add ${component}.`);
  }
}

if (problems.length > 0) throw new Error(`Section registry:\n- ${problems.join("\n- ")}`);

export function sectionComponent(type: string): SectionComponent {
  return components.get(type)!.component;
}
