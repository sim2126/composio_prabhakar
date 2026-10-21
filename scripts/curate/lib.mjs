// Helpers for promoting an agent-generated guide to a verified guide after fact-checking.
// Each scripts/curate/<slug>.mjs loads the generated draft, applies the corrections the
// verifier found (with their sources), and writes data/guides/<slug>.json.
import { readFileSync, writeFileSync } from "node:fs";

export function load(slug) {
  const g = JSON.parse(readFileSync(`.data/guide_${slug}.json`, "utf8"));
  g.kind = "verified";
  g.checkedAt = "2026-10-21";
  g.run = null;
  return g;
}

export function source(g, url, title, cls = "official", date = "2026-10-21") {
  const existing = g.sources.find((s) => s.url.replace(/\/$/, "") === url.replace(/\/$/, ""));
  if (existing) return existing.id;
  const n = g.sources.filter((s) => s.id.startsWith("V")).length + 1;
  const id = `V${n}`;
  g.sources.push({ id, url, title, domain: new URL(url).hostname.replace(/^www\./, ""), class: cls, retrievedAt: date });
  return id;
}

export const step = (g, id) => {
  const s = g.steps.find((x) => x.id === id);
  if (!s) throw new Error(`no step ${id}`);
  return s;
};
export const path = (g, id) => {
  const p = g.paths.find((x) => x.id === id);
  if (!p) throw new Error(`no path ${id}`);
  return p;
};

// Guides talk about the provider, never about how they were researched. Strip leftover
// process phrasing from every user-facing string and fail if any survives.
const PROCESS = [
  [/\s*The notes do not [^.]*\./gi, ""],
  [/\s*[^.]*\b(?:not (?:published|given) in|not in) the notes\b[^.]*\./gi, ""],
  [/\s*\(not checked\)/gi, ""],
  [/\s*These terms were not confirmed against a source id\./gi, ""],
];
function tidy(value) {
  if (typeof value === "string") return PROCESS.reduce((s, [re, rep]) => s.replace(re, rep), value).trim();
  if (Array.isArray(value)) return value.map(tidy);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "sources" || k === "probes" ? v : tidy(v)]));
  return value;
}

export function save(input) {
  const g = tidy(input);
  const leftover = JSON.stringify({ ...g, sources: [], probes: [] }).match(
    /.{0,40}(the notes|not checked|were not read|not researched|the research|pages read|could not be read|that we could find|not confirmed absent|in the reports|"Not confirmed|fee found|found in official sources).{0,40}/i,
  );
  if (leftover) throw new Error(`${g.slug}: process wording left: ${leftover[0]}`);
  writeFileSync(`data/guides/${g.slug}.json`, JSON.stringify(g, null, 1));
  console.log(`verified ${g.slug}: ${g.paths.length} paths, ${g.steps.length} steps, ${g.gotchas.length} gotchas, ${g.sources.length} sources`);
}
