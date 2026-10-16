// Markdown rendering for markdown props such as rich-text `body` (design D5).
//
// Entry bodies are rendered by Astro's markdown processor. Markdown props use
// the same processor (Sätteri, Astro's default) with the same options, so the
// same markdown renders the same HTML in both places. astro.config.mjs passes
// `markdownOptions` to Astro; don't set markdown options anywhere else.
import { satteri } from "@astrojs/markdown-satteri";
import type { MarkdownRenderer } from "astro/markdown";

// Syntax highlighting is off: Shiki writes raw colors into inline styles,
// which bypasses the design tokens.
export const markdownOptions = { syntaxHighlight: false as const };

let renderer: Promise<MarkdownRenderer> | undefined;

export async function renderMarkdown(source: string, where: string): Promise<string> {
  renderer ??= satteri().createRenderer(markdownOptions);
  const { code, metadata } = await (await renderer).render(source);
  assertNoH1(metadata.headings, where);
  return code;
}

// A page has exactly one h1: the first hero's title, the page title or the
// entry title. Markdown headings therefore start at "##".
export function assertNoH1(headings: { depth: number; text: string }[], where: string): void {
  const h1 = headings.find((heading) => heading.depth === 1);
  if (h1) {
    throw new Error(
      `${where}: the markdown heading "# ${h1.text}" is a page title. Markdown headings start at "##", because the page already has its h1.`,
    );
  }
}
