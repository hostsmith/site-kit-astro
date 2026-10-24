// The site's own icons, from src/icons/ (site-kit-webflow-example design
// D107), read and checked once when the build loads them. A site without the
// folder has none.
import { readSiteIcons } from "../../scripts/site-icons.mjs";
import { ICONS } from "./icons.ts";

export type SiteIcon = { name: string; attributes: Record<string, string>; body: string };

export const siteIcons: SiteIcon[] = readSiteIcons(process.cwd(), Object.keys(ICONS));
