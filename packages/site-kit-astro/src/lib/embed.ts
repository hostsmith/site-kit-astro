// Embeds that load on a click (site-kit-webflow-example design D105). Loading
// a third-party frame sends the visitor's IP address to its provider, and may
// set the provider's cookies, before the visitor has chosen anything. So an
// embed shows a placeholder: the host it loads from, a button that loads the
// frame, and a link to the content on the provider's site. Nothing on the
// page requests anything from the provider before the click: no thumbnail,
// no preconnect.
//
// The `embed` section and a video link alone in a Markdown paragraph share the
// markup below. YouTube loads from youtube-nocookie.com, and Vimeo with dnt=1.

export type EmbedKind = "map" | "video" | "other";
export const EMBED_ASPECTS = ["16:9", "4:3", "1:1", "21:9"] as const;
export type EmbedAspect = (typeof EMBED_ASPECTS)[number];

// What a placeholder needs: the frame's URL and host, and the link to the
// content and its host.
export type EmbedSource = { frame: string; host: string; link: string; linkHost: string };

const hostOf = (url: URL) => url.hostname.replace(/^www\./, "");
const YOUTUBE_ID = /^[\w-]{11}$/;

// A YouTube or Vimeo video's player, or undefined for any other URL.
export function videoSource(link: string): EmbedSource | undefined {
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const host = hostOf(url);
  const segments = url.pathname.split("/").filter(Boolean);
  let youtube: string | undefined;
  if (host === "youtube.com" || host === "m.youtube.com") {
    youtube = segments[0] === "watch" ? (url.searchParams.get("v") ?? undefined) : ["embed", "shorts", "live"].includes(segments[0]) ? segments[1] : undefined;
  } else if (host === "youtu.be") {
    youtube = segments[0];
  } else if (host === "youtube-nocookie.com" && segments[0] === "embed") {
    youtube = segments[1];
  }
  if (youtube !== undefined) {
    if (!YOUTUBE_ID.test(youtube)) return undefined;
    return { frame: `https://www.youtube-nocookie.com/embed/${youtube}`, host: "youtube-nocookie.com", link, linkHost: host === "youtu.be" ? "youtube.com" : host.replace(/^m\./, "") };
  }
  // vimeo.com/<id>, vimeo.com/<id>/<hash> for an unlisted video, or the player's own URL.
  const [id, hash] = host === "vimeo.com" ? segments : host === "player.vimeo.com" && segments[0] === "video" ? segments.slice(1) : [];
  if (id && /^\d+$/.test(id)) {
    const params = new URLSearchParams();
    const unlisted = hash ?? url.searchParams.get("h");
    if (unlisted && /^\w+$/.test(unlisted)) params.set("h", unlisted);
    params.set("dnt", "1");
    return { frame: `https://player.vimeo.com/video/${id}?${params}`, host: "player.vimeo.com", link, linkHost: "vimeo.com" };
  }
  return undefined;
}

// An embed section's source. A `video` URL must be a YouTube or Vimeo video;
// a map or other content loads from its URL as written.
export function embedSource(link: string, kind: EmbedKind): EmbedSource | undefined {
  if (kind === "video") return videoSource(link);
  const url = new URL(link);
  return { frame: link, host: hostOf(url), link, linkHost: hostOf(url) };
}

const escapeHtml = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

// The placeholder's strings, from the settings' `ui` (lib/part-ui.ts).
export type EmbedStrings = { button: string; notice: string; open: string };

export const EMBED_UI_KEYS = { map: "embedShowMap", video: "embedPlayVideo", other: "embedShowContent" } as const;

type EmbedOptions = {
  source: EmbedSource;
  kind: EmbedKind;
  // The frame's name for assistive technology.
  title: string;
  aspect?: EmbedAspect;
  caption?: string;
  // Attributes for the caption, such as its field attribute, as HTML.
  captionAttributes?: string;
  load?: "click" | "direct";
  strings?: EmbedStrings;
};

// The site's `embedLoad` from src/site.config.ts (site-kit-webflow-migration
// design D196), which the integration sets and a video link in a Markdown body
// follows. Astro's content layer loads this module through the integration,
// and components through Vite, each its own copy, so the value lives on the
// process, not in the module.
const EMBED_LOAD = Symbol.for("@hostsmith/site-kit-astro/embedLoad");
export function setEmbedLoad(load: "click" | "direct"): void {
  (globalThis as Record<symbol, unknown>)[EMBED_LOAD] = load;
}
export function siteEmbedLoad(): "click" | "direct" {
  return (globalThis as Record<symbol, unknown>)[EMBED_LOAD] === "direct" ? "direct" : "click";
}

// The frame's attributes: a video player may go full screen.
export function frameAttributes(kind: EmbedKind): string {
  return kind === "video" ? ' allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen' : "";
}

// The embed as HTML: a figure with the placeholder, or with the frame itself
// for `load: direct`, which a site uses only when its privacy notice names
// the provider, such as one migrated from a site whose frames loaded with the
// page.
export function embedHtml({ source, kind, title, aspect = "16:9", caption, captionAttributes = "", load = "click", strings }: EmbedOptions): string {
  const frameClass = `sk-embed__frame sk-embed__frame--${aspect.replace(":", "-")}`;
  const inner =
    load === "direct"
      ? `<iframe class="sk-embed__iframe" src="${escapeHtml(source.frame)}" title="${escapeHtml(title)}" loading="lazy"${frameAttributes(kind)}></iframe>`
      : [
          '<div class="sk-embed__placeholder">',
          `<p class="sk-embed__notice">${escapeHtml(strings!.notice)}</p>`,
          `<button type="button" class="sk-embed__button" data-src="${escapeHtml(source.frame)}" data-title="${escapeHtml(title)}" data-kind="${kind}" hidden>${escapeHtml(strings!.button)}</button>`,
          `<a href="${escapeHtml(source.link)}" class="sk-embed__link">${escapeHtml(strings!.open)}</a>`,
          "</div>",
        ].join("");
  const figcaption = caption ? `<figcaption class="sk-embed__caption"${captionAttributes}>${escapeHtml(caption)}</figcaption>` : "";
  return `<figure class="sk-embed__media"><div class="${frameClass}">${inner}</div>${figcaption}</figure>`;
}
