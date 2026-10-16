// Prints a new section id for a page file (design D3):
//
//   npm run section-id -- src/content/pages/home.md
//
// An id is 4 characters: a lowercase letter, then 3 lowercase letters or
// digits, with at least one digit. The new id differs from every id in the
// file and every id that ever appeared in the file's git history, so a
// deleted section's id is never reused on its page.
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

export const SECTION_ID = /^[a-z](?=[a-z0-9]*[0-9])[a-z0-9]{3}$/;

const LETTERS = "abcdefghijklmnopqrstuvwxyz";
const CHARS = `${LETTERS}0123456789`;

// Matches `id: s7k2`, in block and flow YAML, quoted or not.
export function idsIn(text) {
  return new Set([...text.matchAll(/\bid:\s*["']?([a-z][a-z0-9]{3})\b/g)].map((match) => match[1]));
}

export function usedIds(file, cwd = process.cwd()) {
  const used = existsSync(file) ? idsIn(readFileSync(file, "utf8")) : new Set();
  try {
    const log = execFileSync("git", ["log", "-p", "--follow", "--format=", "--", file], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
    for (const id of idsIn(log)) used.add(id);
  } catch {
    // Not a git repository, or the file has no history yet.
  }
  return used;
}

export function newId(used, random = randomInt) {
  for (;;) {
    let id = LETTERS[random(LETTERS.length)];
    for (let i = 0; i < 3; i++) id += CHARS[random(CHARS.length)];
    if (SECTION_ID.test(id) && !used.has(id)) return id;
  }
}

// `site-kit section-id <page file>` (bin/site-kit.mjs).
export function cli(args) {
  const file = args[0];
  if (!file) {
    console.error("Usage: npm run section-id -- <page file>");
    process.exit(1);
  }
  console.log(newId(usedIds(file)));
}
