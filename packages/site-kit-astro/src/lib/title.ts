// Highlighted words in titles (site-kit-webflow-example design D106). Any
// prop named `title` may mark runs of words with `==` on both sides, such as
// "Work ==together== by the river". The kit renders each run as
// <span class="sk-highlight">, which adds no meaning, and removes the marks
// wherever the title leaves the page's visible markup: the document's
// <title>, og:title, breadcrumbs, accessible names and alt text.
//
// Marks pair from the left and don't nest. A `==` without its pair, or a pair
// with nothing but spaces between, stays as written. Site code imports these
// from "@hostsmith/site-kit-astro/title", or renders a title with the
// "@hostsmith/site-kit-astro/components/Title.astro" component.

export type TitlePart = { text: string; highlight: boolean };

const MARK = "==";

// The title as plain and highlighted runs, in order, the marks removed.
export function titleParts(title: string): TitlePart[] {
  const parts: TitlePart[] = [];
  const add = (text: string, highlight: boolean) => {
    if (text === "") return;
    const last = parts.at(-1);
    if (last && last.highlight === highlight) last.text += text;
    else parts.push({ text, highlight });
  };
  let rest = title;
  for (;;) {
    const open = rest.indexOf(MARK);
    const close = open === -1 ? -1 : rest.indexOf(MARK, open + MARK.length);
    if (close === -1) break;
    const marked = rest.slice(open + MARK.length, close);
    if (marked.trim() === "") {
      // Nothing to highlight: the first mark stays, and the second may open a pair.
      add(rest.slice(0, open + MARK.length), false);
      rest = rest.slice(open + MARK.length);
      continue;
    }
    add(rest.slice(0, open), false);
    add(marked, true);
    rest = rest.slice(close + MARK.length);
  }
  add(rest, false);
  return parts;
}

// The title without its marks, for the document's <title>, og:title,
// breadcrumbs, accessible names and alt text.
export function plainTitle(title: string): string {
  return titleParts(title)
    .map((part) => part.text)
    .join("");
}

// Escapes text as Astro escapes an expression in a template.
const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// The title as HTML, each highlighted run in a span, for `set:html`.
export function titleHtml(title: string): string {
  return titleParts(title)
    .map((part) => (part.highlight ? `<span class="sk-highlight">${escapeHtml(part.text)}</span>` : escapeHtml(part.text)))
    .join("");
}
