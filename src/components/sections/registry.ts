// The section registry (design D2).
//
// A type's name is its component's file name: library types live in
// src/components/sections/<type>.astro, site-local types in
// src/components/sections/site/<type>.astro. Each type also needs a schema,
// in src/content.config.ts for library types and src/site.schema.ts for
// site-local ones, and a Decap type in public/admin/config.kit.yml or
// config.site.yml. Any mismatch fails the build here.
import { isSiteSectionType, sectionSchemas, type Section } from "../../content.config.ts";

type SectionComponent = (props: { section: Section; entry: string; primary: boolean }) => unknown;

const library = import.meta.glob<SectionComponent>("./*.astro", { eager: true, import: "default" });
const site = import.meta.glob<SectionComponent>("./site/*.astro", { eager: true, import: "default" });

const typeName = (file: string) => file.slice(file.lastIndexOf("/") + 1, -".astro".length);
const sourceFile = (file: string) => `src/components/sections/${file.slice(2)}`;

const components = new Map<string, { file: string; component: SectionComponent }>();
const problems: string[] = [];

for (const [file, component] of Object.entries(library)) components.set(typeName(file), { file: sourceFile(file), component });

for (const [file, component] of Object.entries(site)) {
  const type = typeName(file);
  if (components.has(type)) {
    problems.push(`Site-local section type "${type}" (${sourceFile(file)}) has the same name as a library type. Rename it.`);
    continue;
  }
  components.set(type, { file: sourceFile(file), component });
}

for (const [type, { file }] of components) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(type)) {
    problems.push(`Section type "${type}" (${file}) must be a kebab-case name, such as "menu-board".`);
  }
  if (!Object.hasOwn(sectionSchemas, type)) {
    const schemaFile = file.includes("/site/") ? "siteSectionSchemas in src/site.schema.ts" : "src/content.config.ts";
    problems.push(`Section type "${type}" has a component (${file}) but no schema in ${schemaFile}.`);
  }
}

for (const [type, schema] of Object.entries(sectionSchemas)) {
  const schemaFile = isSiteSectionType(type) ? "src/site.schema.ts" : "src/content.config.ts";
  if (schema.shape.type.value !== type) {
    problems.push(`Section schema "${type}" in ${schemaFile} has type "${schema.shape.type.value}". The key and the type must be the same.`);
  }
  if (!components.has(type)) {
    const component = isSiteSectionType(type) ? `src/components/sections/site/${type}.astro` : `src/components/sections/${type}.astro`;
    problems.push(`Section type "${type}" has a schema in ${schemaFile} but no component. Add ${component}.`);
  }
}

if (problems.length > 0) throw new Error(`Section registry:\n- ${problems.join("\n- ")}`);

export function sectionComponent(type: string): SectionComponent {
  return components.get(type)!.component;
}
