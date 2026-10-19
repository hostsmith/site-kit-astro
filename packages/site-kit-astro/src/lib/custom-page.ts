// Loads the page entry of a `template: custom` page.
//
// A page template (src/components/pages/<page>.astro) gets its entry as a
// prop; a hand-written page in src/pages/ names it by its entry id, its
// file's path without the extension, which ends with its locale:
//
//   const page = await customPage(Astro.props.entry);
//   const page = await customPage("about.en");
//   <h1 {...field(page.ref, "title")}>{page.data.title}</h1>
//
// A custom page has no props of its own: its content is in its sections,
// which a CMS can translate, and which the template may render in its own
// markup (site-kit-locales design D53). The pages collection checks its
// frontmatter like any page's.
import { type CollectionEntry, getEntry } from "astro:content";

export async function customPage(page: string | CollectionEntry<"pages">) {
  const entry = typeof page === "string" ? await getEntry("pages", page) : page;
  if (!entry) throw new Error(`Missing page entry src/content/pages/${page as string}.md for a hand-written page.`);
  return { entry, ref: `pages/${entry.id}`, data: entry.data };
}
