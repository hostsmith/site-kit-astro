// What the CMSs write, read the way the content dialect writes it
// (site-kit-locales design D61). Decap and Sveltia don't always write the
// dialect: Sveltia saves an empty optional field as '' or null, Decap leaves
// out an empty list, and Decap writes a date unquoted, which YAML reads as a
// Date. The schemas only know the dialect, so each value is normalized first:
//
// - '', null, and an object or list with nothing in it count as absent;
// - a Date becomes its ISO 8601 text: "2026-10-08" for a midnight UTC date,
//   the full timestamp otherwise.
//
// List items stay in place, so an item's index in an error stays the index in
// the file.

export function fromCms(value: unknown): unknown {
  if (value instanceof Date) return isoText(value);
  if (Array.isArray(value)) return value.map(fromCms);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const entries = Object.entries(value).flatMap(([key, item]) => {
      const normalized = fromCms(item);
      return isEmpty(normalized) ? [] : [[key, normalized] as const];
    });
    return Object.fromEntries(entries);
  }
  return value;
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) return Object.keys(value).length === 0;
  return false;
}

export function isoText(date: Date): string {
  const text = date.toISOString();
  return text.endsWith("T00:00:00.000Z") ? text.slice(0, 10) : text;
}
