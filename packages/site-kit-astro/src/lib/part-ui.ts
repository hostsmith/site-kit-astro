// The interface strings of an interactive part (site-kit-webflow-example
// design D104). They are optional in the settings' `ui`, so a site that uses
// no part needs none of them. A part asks for its own strings when a page
// renders it, and the build fails, naming each key the locale's settings
// lack, so a minor release never breaks existing settings.
import { PART_UI_PARAMS } from "../kit-content.ts";
import { getSettings, settingsRef } from "./settings.ts";

export type PartUi = (key: string, values?: Record<string, string | number>) => string;

// `part` names the part in the message, such as "slider". `locale` is the
// page's locale code: without it, the default locale's settings.
export async function partUi(locale: string | undefined, part: string, keys: readonly string[]): Promise<PartUi> {
  const ui = (await getSettings(locale)).ui as Record<string, unknown>;
  const missing = keys.filter((key) => typeof ui[key] !== "string");
  if (missing.length > 0) {
    const names = missing.map((key) => `"${key}"`).join(", ");
    throw new Error(`src/content/${settingsRef(locale)}.yml has no ${names} under "ui". A ${part} on this page needs ${missing.length > 1 ? "them" : "it"}.`);
  }
  return (key, values = {}) => {
    let text = ui[key] as string;
    for (const name of PART_UI_PARAMS[key] ?? []) text = text.replaceAll(`{${name}}`, String(values[name] ?? `{${name}}`));
    return text;
  };
}
