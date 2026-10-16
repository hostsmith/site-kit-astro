import { getEntry } from "astro:content";

// Field-attribute entry name of the settings file.
export const SETTINGS = "settings/site";

export async function getSettings() {
  const entry = await getEntry("settings", "site");
  if (!entry) throw new Error("Missing src/content/settings/site.yml. Every kit site has a settings file.");
  return entry.data;
}
