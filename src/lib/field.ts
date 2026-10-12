// Field attributes (design D4).
//
// Every element that renders a content value carries
// data-field="<collection>/<entry id>#<path>". The root of a rendered section
// carries data-section="<type>". Sections are addressed by id, list items by
// zero-based index:
//
//   field("news/fresh-rye", "title")
//     -> { "data-field": "news/fresh-rye#title" }
//   sectionFields("pages/home", section).field("items", 0, "answer")
//     -> { "data-field": "pages/home#sections[q1m9].items[0].answer" }

export type PathPart = string | number;

export interface FieldAttrs {
  "data-field": string;
}

export interface SectionAttrs {
  "data-section": string;
}

// Joins prop names with "." and writes list indexes as "[n]".
export function formatPath(parts: readonly PathPart[]): string {
  let out = "";
  for (const part of parts) {
    if (typeof part === "number") out += `[${part}]`;
    else out += out === "" ? part : `.${part}`;
  }
  return out;
}

export function field(entry: string, ...path: PathPart[]): FieldAttrs {
  return { "data-field": `${entry}#${formatPath(path)}` };
}

export function sectionFields(entry: string, section: { id: string; type: string }) {
  const prefix = `sections[${section.id}]`;
  return {
    root: { "data-section": section.type } as SectionAttrs,
    field: (...path: PathPart[]): FieldAttrs => {
      const rest = formatPath(path);
      return { "data-field": `${entry}#${prefix}${rest.startsWith("[") ? rest : `.${rest}`}` };
    },
  };
}
