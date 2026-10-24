// Video links in Markdown bodies (site-kit-webflow-example design D105): a
// paragraph that holds only a link to a YouTube or Vimeo video renders as the
// embed placeholder, with the link's text as the frame's title and caption.
// It's plain CommonMark, so any other renderer shows a link. A link in
// running text, and any other link, stays a link.
//
// A plugin of the kit's Markdown processor, so entry bodies and markdown props
// get it alike. The placeholder's strings come from the settings' `ui` of the
// body's locale, read from its file as facts are (lib/facts.ts), and the base
// layout adds the script that loads the frame.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { embedHtml, videoSource } from "./embed.ts";
import { localeOfFile, settingsFile } from "./facts.ts";

type HastNode = { type: string; tagName?: string; value?: string; properties?: Record<string, unknown>; children?: HastNode[] };

const KEYS = ["embedPlayVideo", "embedNotice", "embedOpen"];

// The locale of a body: from its file's name, or, for a markdown prop
// rendered without an entry, the site's only settings file.
function bodyLocale(file: string | undefined, root: string): string | undefined {
  if (file) return localeOfFile(file);
  const dir = join(root, "src", "content", "settings");
  const codes = existsSync(dir) ? readdirSync(dir).flatMap((name) => name.match(/^site\.([a-z0-9-]+)\.yml$/)?.[1] ?? []) : [];
  return codes.length === 1 ? codes[0] : undefined;
}

function readStrings(locale: string | undefined, root: string): Record<string, string> {
  const file = settingsFile(locale);
  const ui = existsSync(join(root, file)) ? (parse(readFileSync(join(root, file), "utf8"))?.ui ?? {}) : {};
  const missing = KEYS.filter((key) => typeof ui[key] !== "string");
  if (missing.length > 0) {
    throw new Error(`${file} has no ${missing.map((key) => `"${key}"`).join(", ")} under "ui". A video link alone in a Markdown paragraph renders as an embed, which needs ${missing.length > 1 ? "them" : "it"}.`);
  }
  return ui;
}

export const videoLinksPlugin = {
  name: "site-kit-video-links",
  element: {
    filter: ["p"],
    visit(node: HastNode, ctx: { fileURL: URL | undefined; textContent: (node: HastNode) => string }) {
      const children = (node.children ?? []).filter((child) => !(child.type === "text" && !child.value?.trim()));
      const [link] = children;
      if (children.length !== 1 || link.type !== "element" || link.tagName !== "a") return;
      const href = link.properties?.href;
      const source = typeof href === "string" ? videoSource(href) : undefined;
      if (!source) return;
      const root = process.cwd();
      const ui = readStrings(bodyLocale(ctx.fileURL ? fileURLToPath(ctx.fileURL) : undefined, root), root);
      const title = ctx.textContent(link).trim() || source.linkHost;
      const strings = { button: ui.embedPlayVideo, notice: ui.embedNotice.replaceAll("{host}", source.host), open: ui.embedOpen.replaceAll("{host}", source.linkHost) };
      return { type: "raw", value: embedHtml({ source, kind: "video", title, caption: title, strings }) };
    },
  },
};
