import type { Guide, GuidePath, Source } from "./guide";
import { LEVEL_LABEL, applies, levelFor } from "./rubric";

const PHASE_LABEL = { today: "Today", week: "This week", wait: "Waiting", launch: "Launch" } as const;
const OWNER_LABEL = {
  agent: "Agent",
  agent_drafts: "Agent drafts, you submit",
  you: "You",
  provider: "Provider",
  lab: "Assessment lab",
  customer_admin: "Customer admin",
} as const;

function cite(ids: string[], sources: Source[]): string {
  const urls = ids.map((id) => sources.find((s) => s.id === id)?.url).filter(Boolean);
  return urls.length ? ` [${urls.join(", ")}]` : " [unverified]";
}

// A shareable, plain-Markdown version of the guide for the selected path.
export function guideMarkdown(guide: Guide, path: GuidePath | null, pageUrl: string): string {
  const out: string[] = [];
  const steps = guide.steps.filter((s) => applies(s.paths, path?.id));
  out.push(`# ${guide.name}: OAuth app readiness`, "");
  out.push(`${guide.kind === "verified" ? "Verified" : "Agent-generated, not human-reviewed"} · checked ${guide.checkedAt} · ${pageUrl}`, "");
  if (guide.outcome !== "oauth_app" && guide.outcomeNote) out.push(`> ${guide.outcomeNote}`, "");
  if (path) {
    out.push(`## Verdict — ${path.label}`, "");
    out.push(`- Difficulty: ${LEVEL_LABEL[levelFor(path.review, guide)]}. ${path.drivenBy}`);
    out.push(`- Your effort: ${path.effort}`);
    out.push(`- Approval wait (official): ${path.waitOfficial ?? "none published"}${cite(path.waitEvidence, guide.sources)}`);
    if (path.waitReported) out.push(`- Approval wait (reported): ${path.waitReported}`);
    out.push(`- Cost: ${path.cost}. ${path.costNote}${cite(path.costEvidence, guide.sources)}`);
    out.push(`- Next: ${path.next}`);
    for (const l of path.untilApproved) out.push(`- Until approved: ${l.text}${cite(l.evidence, guide.sources)}`);
    out.push("");
  }
  const prereqs = guide.prereqs.filter((p) => applies(p.paths, path?.id));
  if (prereqs.length) {
    out.push("## Before you start", "");
    for (const p of prereqs) out.push(`- [ ] ${p.text} — ${p.why} (${OWNER_LABEL[p.owner]})`);
    out.push("");
  }
  out.push("## Steps", "");
  for (const phase of Object.keys(PHASE_LABEL) as (keyof typeof PHASE_LABEL)[]) {
    const inPhase = steps.filter((s) => s.phase === phase);
    if (!inPhase.length) continue;
    out.push(`### ${PHASE_LABEL[phase]}`, "");
    for (const s of inPhase) {
      out.push(`- [ ] **${s.title}** (${OWNER_LABEL[s.owner]}, ${s.time}) — ${s.detail}${cite(s.evidence, guide.sources)}`);
      for (const v of s.values) out.push(`  - ${v.label}:\n\n    \`\`\`\n${v.text.split("\n").map((l) => "    " + l).join("\n")}\n    \`\`\``);
    }
    out.push("");
  }
  const gotchas = guide.gotchas.filter((g) => applies(g.paths, path?.id));
  if (gotchas.length) {
    out.push("## Watch out", "");
    for (const g of gotchas) out.push(`- ${g.text}${cite(g.evidence, guide.sources)}`);
    out.push("");
  }
  const blockers = guide.blockers.filter((b) => applies(b.paths, path?.id));
  if (blockers.length) {
    out.push("## If you're blocked", "", "| You see | Usually because | Do this |", "|---|---|---|");
    for (const b of blockers) out.push(`| ${b.see} | ${b.cause} | ${b.fix} |`);
    out.push("");
  }
  out.push(`## AI use`, "", `${guide.aiPolicy.summary}${cite(guide.aiPolicy.evidence, guide.sources)}`, "");
  if (guide.unknowns.length) {
    out.push("## What we couldn't confirm", "");
    for (const u of guide.unknowns) out.push(`- ${u}`);
    out.push("");
  }
  out.push("## Sources", "");
  for (const s of guide.sources) out.push(`- ${s.title} — ${s.url} (${s.class}, ${s.retrievedAt})`);
  return out.join("\n");
}

// Instructions a coding agent can follow: it does the agent steps and stops at each human step.
export function agentRunbook(guide: Guide, path: GuidePath | null, pageUrl: string): string {
  const steps = guide.steps.filter((s) => applies(s.paths, path?.id));
  const lines = [
    `You are helping a developer set up the ${guide.name} OAuth app for a Composio integration (${path?.label ?? "default path"}).`,
    `Source guide: ${pageUrl}. Verify anything time-sensitive against the cited links before acting.`,
    "",
    "Rules:",
    "- Do steps marked AGENT yourself. For AGENT DRAFTS, prepare the text or code and ask the developer to review before it is used.",
    "- At every YOU, PROVIDER, LAB or CUSTOMER ADMIN step, stop and tell the developer exactly what to do, with the values below.",
    "- Never accept terms, submit reviews, pay, or enter credentials on the developer's behalf.",
    "",
    "Steps:",
  ];
  steps.forEach((s, i) => {
    const owner = s.owner === "agent" ? "AGENT" : s.owner === "agent_drafts" ? "AGENT DRAFTS" : `STOP — ${OWNER_LABEL[s.owner].toUpperCase()}`;
    lines.push(`${i + 1}. [${owner}] ${s.title}: ${s.detail}`);
    for (const v of s.values) lines.push(`   ${v.label}:\n   ${v.text.replace(/\n/g, "\n   ")}`);
  });
  return lines.join("\n");
}
