// Loads the page entry of a `template: custom` page and checks its props.
//
// A hand-written page declares the props its page entry may have beyond the
// common page fields. Unknown or invalid props fail the build:
//
//   const page = await customPage("about", { heading: z.string() });
//   <h1 {...field(page.ref, "heading")}>{page.data.heading}</h1>
import { getEntry } from "astro:content";
import { z } from "astro/zod";
import { describeIssue, pageFields, type Section } from "../kit-content.ts";

export async function customPage<S extends z.core.$ZodLooseShape>(id: string, props: S) {
  const entry = await getEntry("pages", id);
  const file = entry?.filePath ?? `src/content/pages/${id}.md`;
  if (!entry) throw new Error(`Missing page entry ${file} for a hand-written page.`);

  // The page collection has already checked the common fields and the sections.
  const schema = z.strictObject({ ...pageFields, template: z.literal("custom"), sections: z.array(z.unknown()).optional(), ...props });
  const result = schema.safeParse(entry.data);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => describeIssue(issue, entry.data).replace(/\bprop\b/g, "frontmatter key"));
    throw new Error(`${file}: ${messages.join("; ")}`);
  }
  return { entry, ref: `pages/${id}`, data: { ...result.data, sections: entry.data.sections as Section[] | undefined } };
}
