import type { Audience, Guide, GuidePath, Review, Tier } from "./guide";

export type Level = "self_serve" | "light" | "formal" | "heavy" | "restricted" | "unknown";

// The published rubric: difficulty follows from the strongest review on the path,
// overridden by access gates and AI-use bans. The model never picks the level.
export function levelFor(review: Review, guide: Pick<Guide, "outcome" | "aiPolicy">): Level {
  if (guide.outcome === "closed" || guide.outcome === "partner_only") return "restricted";
  if (guide.aiPolicy.status === "prohibited") return "restricted";
  switch (review) {
    case "none":
      return "self_serve";
    case "light":
      return "light";
    case "formal":
      return "formal";
    case "assessment":
      return "heavy";
    case "partner":
      return "restricted";
    default:
      return "unknown";
  }
}

export const LEVEL_LABEL: Record<Level, string> = {
  self_serve: "Self-serve",
  light: "Light review",
  formal: "Formal review",
  heavy: "Heavy review",
  restricted: "Restricted",
  unknown: "Unclear",
};

export const RUBRIC: { level: Level; rule: string }[] = [
  { level: "self_serve", rule: "No provider review for this audience and these scopes." },
  { level: "light", rule: "Brand checks, install caps or an optional listing; usually days." },
  { level: "formal", rule: "A provider reviews the app before external users can connect; days to weeks." },
  { level: "heavy", rule: "Review plus a security assessment or similar paid audit; weeks to months." },
  { level: "restricted", rule: "Partner-only or closed access, or the provider's terms prohibit this agent use." },
  { level: "unknown", rule: "The provider does not say what review applies; the guide shows what is known." },
];

const ORDER: Record<Tier, number> = { basic: 1, sensitive: 2, restricted: 3 };

export function worstTier(guide: Guide, selected: string[]): Tier {
  let worst: Tier = "basic";
  for (const cap of guide.capabilities) {
    if (!selected.includes(cap.id)) continue;
    for (const s of cap.scopes) if (ORDER[s.tier] > ORDER[worst]) worst = s.tier;
  }
  return worst;
}

export function pickPath(guide: Guide, audience: Audience, tier: Tier): GuidePath | null {
  const exact = guide.paths.find((p) => p.audiences.includes(audience) && p.tiers.includes(tier));
  if (exact) return exact;
  const byAudience = guide.paths.filter((p) => p.audiences.includes(audience));
  if (byAudience.length) {
    // Closest tier at or above the selection, else the strongest available.
    const sorted = [...byAudience].sort((a, b) => maxTier(a) - maxTier(b));
    return sorted.find((p) => maxTier(p) >= ORDER[tier]) ?? sorted[sorted.length - 1];
  }
  return guide.paths[0] ?? null;
}

function maxTier(p: GuidePath): number {
  return Math.max(...p.tiers.map((t) => ORDER[t]), 0);
}

export function applies(paths: string[] | null, pathId: string | undefined): boolean {
  return !paths || !pathId || paths.includes(pathId);
}
