// Integrity check for guide data: path references, citations and URLs.
// Usage: node scripts/check-guides.mjs
import { readFileSync, readdirSync } from "node:fs";

let problems = 0;
const warn = (slug, msg) => {
  problems += 1;
  console.log(`${slug}: ${msg}`);
};

for (const dir of ["data/guides", "data/generated"]) {
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const g = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
    const slug = `${dir.split("/")[1]}/${g.slug}`;
    const pathIds = new Set(g.paths.map((p) => p.id));
    const sourceIds = new Set(g.sources.map((s) => s.id));
    for (const s of g.sources) if (!/^https?:\/\//.test(s.url)) warn(slug, `source ${s.id} has a non-http URL`);
    const cite = (where, ids) => ids.forEach((id) => sourceIds.has(id) || warn(slug, `${where} cites missing ${id}`));
    const refs = (where, ids) => (ids ?? []).forEach((id) => pathIds.has(id) || warn(slug, `${where} references missing path ${id}`));
    for (const p of g.paths) {
      const steps = g.steps.filter((s) => !s.paths || s.paths.includes(p.id));
      if (steps.length < 3) warn(slug, `path ${p.id} has only ${steps.length} steps`);
      if (p.lanes.you.length !== 4 || p.lanes.provider.length !== 4) warn(slug, `path ${p.id} lanes are not 4 wide`);
      cite(`path ${p.id}`, [...p.waitEvidence, ...p.costEvidence, ...p.untilApproved.flatMap((l) => l.evidence)]);
    }
    for (const aud of ["team", "customers", "public"]) if (!g.paths.some((p) => p.audiences.includes(aud))) warn(slug, `no path covers ${aud}`);
    for (const s of g.steps) {
      refs(`step ${s.id}`, s.paths);
      cite(`step ${s.id}`, s.evidence);
    }
    for (const x of [...g.gotchas, ...g.blockers, ...g.prereqs]) refs("item", x.paths);
    for (const x of g.gotchas) cite("gotcha", x.evidence);
    cite("aiPolicy", g.aiPolicy.evidence);
    for (const c of g.defaultCapabilities) if (!g.capabilities.some((x) => x.id === c)) warn(slug, `default capability ${c} missing`);
  }
}
console.log(problems ? `${problems} problem(s)` : "all guides consistent");
