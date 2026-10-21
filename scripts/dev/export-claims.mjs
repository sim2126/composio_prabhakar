// Dev-only: export the key claims of generated guides (with cited URLs) for independent verification.
// Usage: node scripts/dev/export-claims.mjs slug1 slug2 ... > out.md
import { readFileSync } from "node:fs";

for (const slug of process.argv.slice(2)) {
  const g = JSON.parse(readFileSync(`.data/guide_${slug}.json`, "utf8"));
  const src = (ids) => ids.map((id) => g.sources.find((s) => s.id === id)?.url).filter(Boolean).join(" ") || "(no source)";
  const out = [`## ${g.name} (${slug}) — outcome ${g.outcome}`, `Summary: ${g.summary}`];
  let n = 0;
  const claim = (text, ids) => out.push(`${slug}-${++n}. ${text}  ⟵ ${src(ids)}`);
  for (const p of g.paths) {
    claim(`[path ${p.id}: ${p.audiences.join("/")}] review=${p.review}; ${p.drivenBy}`, p.waitEvidence);
    claim(`[path ${p.id}] official wait: ${p.waitOfficial ?? "none published"}; reported: ${p.waitReported ?? "-"}`, p.waitEvidence);
    claim(`[path ${p.id}] cost: ${p.cost} (${p.costNote})`, p.costEvidence);
    for (const l of p.untilApproved) claim(`[path ${p.id}] until approved: ${l.text}`, l.evidence);
  }
  for (const s of g.steps) claim(`[step, ${s.owner}] ${s.title}: ${s.detail}`, s.evidence);
  for (const x of g.gotchas) claim(`[gotcha] ${x.text}`, x.evidence);
  claim(`[AI policy: ${g.aiPolicy.status}] ${g.aiPolicy.summary}`, g.aiPolicy.evidence);
  console.log(out.join("\n") + "\n");
}
