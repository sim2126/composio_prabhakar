import { z } from "zod/v4";

// ---- Shared vocabulary -------------------------------------------------------

export const AUDIENCES = ["team", "customers", "public"] as const;
export const Audience = z.enum(AUDIENCES);
export type Audience = z.infer<typeof Audience>;

// Provider-neutral scope weight. Each scope also carries the provider's own label.
export const TIERS = ["basic", "sensitive", "restricted"] as const;
export const Tier = z.enum(TIERS);
export type Tier = z.infer<typeof Tier>;

export const Owner = z.enum(["agent", "agent_drafts", "you", "provider", "lab", "customer_admin"]);
export type Owner = z.infer<typeof Owner>;

export const Phase = z.enum(["today", "week", "wait", "launch"]);
export type Phase = z.infer<typeof Phase>;

// Strongest review a path goes through. The difficulty level is derived from this (see lib/rubric.ts).
export const Review = z.enum(["none", "light", "formal", "assessment", "partner", "unknown"]);
export type Review = z.infer<typeof Review>;

export const Outcome = z.enum(["oauth_app", "api_key_only", "partner_only", "closed", "unknown"]);
export type Outcome = z.infer<typeof Outcome>;

export const AiPolicyStatus = z.enum(["ok", "restrictions", "prohibited", "unknown"]);

export const SourceClass = z.enum(["official", "third_party", "probed", "tested", "unverified"]);
export type SourceClass = z.infer<typeof SourceClass>;

const SourceIds = z.array(z.string()).describe("Ids from the numbered source list, e.g. [\"S2\",\"S5\"]. Empty if no source supports it.");
const PathIds = z.array(z.string()).nullable().describe("Path ids this applies to; null = every path.");

// ---- What the research agent writes ------------------------------------------
// Everything here is produced by the model from research notes. Composio data,
// probe results, source classes and the difficulty level are filled in by code.

export const DraftScope = z.object({
  name: z.string().describe("Exact scope string as the provider writes it"),
  tier: Tier,
  label: z.string().describe("Provider's own classification, e.g. 'Restricted', 'Sensitive', 'Admin consent'"),
});

export const DraftCapability = z.object({
  id: z.string().describe("short kebab-case id"),
  label: z.string().describe("What the agent does, 2-4 words, e.g. 'Read email'"),
  scopes: z.array(DraftScope),
  alternative: z.string().nullable().describe("Narrower option that lowers review, or null"),
});

export const DraftPath = z.object({
  id: z.string().describe("short kebab-case id"),
  label: z.string().describe("e.g. 'Customers' workspaces, unlisted app'"),
  audiences: z.array(Audience).describe("Audiences this path covers"),
  tiers: z.array(Tier).describe("Worst requested scope tiers this path covers"),
  review: Review,
  drivenBy: z.string().describe("One sentence: what makes this path as hard as it is"),
  effort: z.string().describe("Your hands-on time including prep, e.g. '~1 hour', '1–2 days'"),
  waitOfficial: z.string().nullable().describe("Provider's stated wait, or null if none published"),
  waitReported: z.string().nullable().describe("What developers report, or null"),
  waitEvidence: SourceIds,
  cost: z.string().describe("e.g. '$0', '$19 one-time', 'A$35+/month'"),
  costNote: z.string(),
  costEvidence: SourceIds,
  customerAdmin: z.enum(["none", "sometimes", "always", "unknown"]),
  next: z.string().describe("One imperative sentence: what to do first"),
  untilApproved: z.array(z.object({ text: z.string(), evidence: SourceIds })).describe("Limits that apply before approval"),
  lanes: z.object({
    you: z.array(z.string()).describe("4 entries: your work in Today, This week, Waiting, Launch; '' when nothing"),
    provider: z.array(z.string()).describe("4 entries: provider/lab time per phase; '' when nothing"),
  }),
});

export const DraftStep = z.object({
  id: z.string(),
  phase: Phase,
  title: z.string().describe("Imperative, under 9 words"),
  owner: Owner,
  time: z.string().describe("e.g. '5 min', '1–2 h', '~6 wk'"),
  detail: z.string().describe("1-3 short sentences with exact console paths and field names"),
  values: z.array(z.object({ label: z.string(), text: z.string() })).describe("Exact values to paste (scopes, URLs, commands). Empty if none."),
  evidence: SourceIds,
  paths: PathIds,
});

export const DraftGuide = z.object({
  outcome: Outcome,
  outcomeNote: z.string().nullable().describe("Required when outcome is not oauth_app: what the developer should do instead"),
  name: z.string(),
  vendorDomain: z.string().describe("Primary domain, e.g. 'pipedrive.com'"),
  covers: z.array(z.string()).describe("Product names this OAuth app covers"),
  summary: z.string().describe("One sentence, no adjectives"),
  capabilities: z.array(DraftCapability),
  defaultCapabilities: z.array(z.string()).describe("Capability ids a typical AI-agent integration needs"),
  paths: z.array(DraftPath),
  prereqs: z.array(z.object({ text: z.string(), why: z.string(), owner: Owner, paths: PathIds })),
  steps: z.array(DraftStep),
  gotchas: z.array(z.object({ text: z.string(), evidence: SourceIds, paths: PathIds })),
  blockers: z.array(z.object({ see: z.string(), cause: z.string(), fix: z.string(), paths: PathIds })),
  aiPolicy: z.object({ status: AiPolicyStatus, summary: z.string(), evidence: SourceIds }),
  customerAdminNote: z.string().nullable(),
  unknowns: z.array(z.string()).describe("Things the research could not confirm"),
});
export type DraftGuide = z.infer<typeof DraftGuide>;

// ---- What the model returns (wire format) ---------------------------------------
// Structured outputs compile the schema into a grammar with a size limit, so the model
// writes the guide in two smaller calls with no nullable fields ("" or [] mean none / all
// paths). toDraft() converts the pair into DraftGuide.

const WPathIds = z.array(z.string()).describe("Path ids this applies to; [] = every path");

export const WireProfile = z.object({
  outcome: Outcome,
  outcomeNote: z.string().describe("What to do instead when outcome is not oauth_app; '' otherwise"),
  name: z.string(),
  vendorDomain: z.string(),
  covers: z.array(z.string()),
  summary: z.string(),
  capabilities: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      scopes: z.array(z.object({ name: z.string(), tier: Tier, label: z.string() })),
      alternative: z.string().describe("Narrower option, or ''"),
    }),
  ),
  defaultCapabilities: z.array(z.string()),
  paths: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      audiences: z.array(Audience),
      tiers: z.array(Tier),
      review: Review,
      drivenBy: z.string(),
      effort: z.string(),
      waitOfficial: z.string().describe("Published wait, or ''"),
      waitReported: z.string().describe("Reported wait, or ''"),
      waitEvidence: z.array(z.string()),
      cost: z.string(),
      costNote: z.string(),
      costEvidence: z.array(z.string()),
      customerAdmin: z.enum(["none", "sometimes", "always", "unknown"]),
      next: z.string(),
      untilApproved: z.array(z.object({ text: z.string(), evidence: z.array(z.string()) })),
      laneYou: z.array(z.string()).describe("4 entries: Today, This week, Waiting, Launch"),
      laneProvider: z.array(z.string()).describe("4 entries: Today, This week, Waiting, Launch"),
    }),
  ),
  aiPolicy: z.object({ status: AiPolicyStatus, summary: z.string(), evidence: z.array(z.string()) }),
  customerAdminNote: z.string().describe("What customers' admins must do, or ''"),
  unknowns: z.array(z.string()),
});
export type WireProfile = z.infer<typeof WireProfile>;

export const WireWork = z.object({
  prereqs: z.array(z.object({ text: z.string(), why: z.string(), owner: Owner, paths: WPathIds })),
  steps: z.array(
    z.object({
      id: z.string(),
      phase: Phase,
      title: z.string(),
      owner: Owner,
      time: z.string(),
      detail: z.string(),
      values: z.array(z.object({ label: z.string(), text: z.string() })),
      evidence: z.array(z.string()),
      paths: WPathIds,
    }),
  ),
  gotchas: z.array(z.object({ text: z.string(), evidence: z.array(z.string()), paths: WPathIds })),
  blockers: z.array(z.object({ see: z.string(), cause: z.string(), fix: z.string(), paths: WPathIds })),
});
export type WireWork = z.infer<typeof WireWork>;

export function toDraft(p: WireProfile, w: WireWork): DraftGuide {
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  const ids = (xs: string[]) => (xs.length ? xs : null);
  return {
    outcome: p.outcome,
    outcomeNote: opt(p.outcomeNote),
    name: p.name,
    vendorDomain: p.vendorDomain,
    covers: p.covers,
    summary: p.summary,
    capabilities: p.capabilities.map((c) => ({ ...c, alternative: opt(c.alternative) })),
    defaultCapabilities: p.defaultCapabilities,
    paths: p.paths.map(({ laneYou, laneProvider, ...rest }) => ({
      ...rest,
      waitOfficial: opt(rest.waitOfficial),
      waitReported: opt(rest.waitReported),
      lanes: { you: laneYou, provider: laneProvider },
    })),
    prereqs: w.prereqs.map((x) => ({ ...x, paths: ids(x.paths) })),
    steps: w.steps.map((x) => ({ ...x, paths: ids(x.paths) })),
    gotchas: w.gotchas.map((x) => ({ ...x, paths: ids(x.paths) })),
    blockers: w.blockers.map((x) => ({ ...x, paths: ids(x.paths) })),
    aiPolicy: p.aiPolicy,
    customerAdminNote: opt(p.customerAdminNote),
    unknowns: p.unknowns,
  };
}

// ---- What we store and render -------------------------------------------------

export const Source = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  domain: z.string(),
  class: SourceClass,
  retrievedAt: z.string(),
});
export type Source = z.infer<typeof Source>;

export const Probe = z.object({
  target: z.string(),
  request: z.string(),
  result: z.string(),
  at: z.string(),
});
export type Probe = z.infer<typeof Probe>;

export const ComposioInfo = z.object({
  toolkits: z.array(z.object({ slug: z.string(), name: z.string(), managed: z.boolean() })),
  defaultRedirect: z.string().nullable(),
});

export const Guide = DraftGuide.extend({
  slug: z.string(),
  kind: z.enum(["verified", "generated"]),
  checkedAt: z.string(),
  sources: z.array(Source),
  probes: z.array(Probe),
  composio: ComposioInfo,
  run: z
    .object({ model: z.string(), seconds: z.number(), searches: z.number(), fetches: z.number(), costUsd: z.number() })
    .nullable(),
});
export type Guide = z.infer<typeof Guide>;
export type GuidePath = Guide["paths"][number];
export type GuideStep = Guide["steps"][number];
