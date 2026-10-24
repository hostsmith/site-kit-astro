// Markdown rendering for markdown props such as rich-text `body` (design D5).
//
// Entry bodies are rendered by Astro's markdown processor. Markdown props use
// the same processor (Sätteri, Astro's default) with the same options, so the
// same markdown renders the same HTML in both places. The kit's integration
// passes `markdownOptions` and `markdownProcessor` to Astro; don't set
// markdown options anywhere else.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { satteri } from "@astrojs/markdown-satteri";
import type { MarkdownRenderer } from "astro/markdown";
import { factsPlugin } from "./facts.ts";
import { videoLinksPlugin } from "./video-links.ts";

// Syntax highlighting is off: Shiki writes raw colors into inline styles,
// which bypasses the design tokens.
export const markdownOptions = { syntaxHighlight: false as const };

// Fills `{name}` facts in a body's text (design D35). Markdown props arrive
// filled already, with the rest of the frontmatter. A video link alone in its
// paragraph becomes an embed placeholder (lib/video-links.ts).
export const markdownProcessor = satteri({ mdastPlugins: [factsPlugin as never], hastPlugins: [videoLinksPlugin as never] });

let renderer: Promise<MarkdownRenderer> | undefined;

// `entry` is the field-attribute entry name of the content that holds the
// markdown, such as "pages/home.en": its locale picks the strings of a video
// link's placeholder.
export async function renderMarkdown(source: string, where: string, entry?: string): Promise<string> {
  renderer ??= markdownProcessor.createRenderer(markdownOptions);
  const fileURL = entry === undefined ? undefined : pathToFileURL(join(process.cwd(), "src", "content", `${entry}.md`));
  const { code, metadata } = await (await renderer)
    .render(source, { fileURL })
    .catch((error: Error) => Promise.reject(new Error(`${where}: ${error.message}`)));
  assertNoH1(metadata.headings, where);
  return code;
}

// Astro's content loader logs an entry body that fails to render, such as
// one with an unknown fact, and builds the page without it. The kit fails
// instead: it renders the body again, so the error names the file.
export async function assertBodyRendered(entry: { body?: string; rendered?: unknown; filePath?: string }, where: string): Promise<void> {
  if (entry.rendered !== undefined || !entry.body?.trim()) return;
  const file = entry.filePath ?? where;
  await renderMarkdown(entry.body, file);
  throw new Error(`${file}: the Markdown body didn't render. See the error above.`);
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
