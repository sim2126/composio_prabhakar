import type { DraftGuide, Guide, Probe, Source } from "@/lib/guide";
import { normalizeUrl, type TrackName, type TrackOutput } from "./research";

const TRACK_TITLE: Record<TrackName, string> = {
  setup: "App setup",
  review: "Review and limits",
  terms: "API terms on AI and data",
  reports: "Developer reports",
};
const FORUM = /^(community|forum|forums|devcommunity|discuss|discussions|answers|support-community)\./;

function hostPath(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return { host: u.hostname.toLowerCase().replace(/^www\./, ""), path: u.pathname.toLowerCase() };
  } catch {
    return null;
  }
}

// Official = the vendor's own domains (and Composio's docs). Forums count as third-party even
// on the vendor's domain. Decided in code from the URL, never by the model.
export function classify(url: string, vendorDomain: string): "official" | "third_party" {
  const hp = hostPath(url);
  if (!hp) return "third_party";
  const { host, path } = hp;
  if (FORUM.test(host)) return "third_party";
  if (host === "docs.composio.dev" || host === "composio.dev") return "official";
  if (vendorDomain && (host === vendorDomain || host.endsWith("." + vendorDomain))) return "official";
  const brand = vendorDomain.split(".")[0];
  if (brand.length >= 4 && host.split(".").slice(0, -1).some((part) => part === brand || part === `${brand}dev` || part === `${brand}-developers`)) return "official";
  if (vendorDomain === "linkedin.com" && host === "learn.microsoft.com" && path.includes("/linkedin/")) return "official";
  return "third_party";
}

export type Registry = { sources: Source[]; idByUrl: Map<string, string> };

export function buildRegistry(tracks: TrackOutput[], vendorDomain: string): Registry {
  const merged = new Map<string, { url: string; title: string; domain: string; retrievedAt: string | null; fetched: boolean }>();
  for (const t of tracks) {
    for (const s of t.sources) {
      if (!hostPath(s.url)) continue;
      const key = normalizeUrl(s.url);
      const prev = merged.get(key);
      if (!prev) merged.set(key, { url: s.url, title: s.title, domain: s.domain, retrievedAt: s.retrievedAt, fetched: s.fetched });
      else if (s.fetched && !prev.fetched) merged.set(key, { ...prev, title: s.title || prev.title, retrievedAt: s.retrievedAt, fetched: true });
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const list = [...merged.values()]
    .map((s) => ({ ...s, cls: classify(s.url, vendorDomain) }))
    .sort((a, b) => (a.cls === b.cls ? 0 : a.cls === "official" ? -1 : 1));
  const idByUrl = new Map<string, string>();
  const sources: Source[] = list.map((s, i) => {
    const id = `S${i + 1}`;
    idByUrl.set(normalizeUrl(s.url), id);
    return { id, url: s.url, title: (s.title || s.domain).slice(0, 140), domain: s.domain, class: s.cls, retrievedAt: (s.retrievedAt ?? today).slice(0, 10) };
  });
  return { sources, idByUrl };
}

export function notesBlock(tracks: TrackOutput[], reg: Registry): string {
  return tracks
    .filter((t) => t.notes)
    .map((t) => {
      const body = t.notes.replace(/\[(https?:\/\/[^\]\s]+)\]/g, (_, url: string) => {
        const id = reg.idByUrl.get(normalizeUrl(url));
        return id ? `[${id}]` : "[no source]";
      });
      return `## ${TRACK_TITLE[t.track]}\n${body}`;
    })
    .join("\n\n");
}

export function sourcesBlock(reg: Registry): string {
  return reg.sources.map((s) => `${s.id}: ${s.title} — ${s.url} (${s.class === "official" ? "official" : "third-party"})`).join("\n");
}

export function probeSources(probes: Probe[], startAt: number): Source[] {
  return probes.map((p, i) => ({
    id: `P${startAt + i}`,
    url: `https://${p.target}`,
    title: `${p.request}: ${p.result}`.slice(0, 140),
    domain: p.target.split("/")[0],
    class: "probed" as const,
    retrievedAt: p.at.slice(0, 10),
  }));
}

// Make the model's draft safe to store: only citations to sources that exist, only
// references to paths that exist, fixed-size lanes, unique ids.
// Guides talk about the provider, never about how they were researched. The writer is told
// this; anything that slips through is removed here before a guide is saved.
const PROCESS_SENTENCE = /[^.;]*\b(the notes|research notes|in (?:the )?research|the research|were not (?:read|fetched|retrieved|checked|reviewed)|was not (?:read|fetched|retrieved|checked|reviewed)|not (?:checked|researched|captured)|tool limits|cut short)\b[^.;]*[.;]?/gi;

// Phrase-level rewrites first, so sentences that carry a fact keep it.
function rephrase(s: string): string {
  return s
    .replace(/\s*\((?:[^)]*\b)?(?:not given|not published|not in) (?:in )?the notes\)/gi, "")
    .replace(/\bfound in the (?:research )?notes\b/gi, "found in the provider's docs")
    .replace(/\b(?:published|given) in the (?:research )?notes\b/gi, "published")
    .replace(/\bin the (?:research )?notes\b/gi, "in the provider's docs")
    .replace(/\s+(?:on|in|from) the (?:official )?pages read\b/gi, "")
    .replace(/,?\s+that we could find\b/gi, "");
}

function tidyText(s: string): string {
  return rephrase(s).replace(PROCESS_SENTENCE, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
}

function tidyUnknown(s: string): string {
  return s
    .replace(/\s*\([^)]*\b(?:not checked|not read|notes)\b[^)]*\)/gi, "")
    .replace(/\b(?:was|were) not (?:checked|read|fetched|retrieved|reviewed)\b/gi, "is unconfirmed")
    .replace(/\s*(?:in|from) the (?:research )?notes\b/gi, "")
    .trim();
}

function tidyDraft(d: DraftGuide): DraftGuide {
  const t = (s: string) => tidyText(s) || s;
  return {
    ...d,
    summary: t(d.summary),
    outcomeNote: d.outcomeNote ? t(d.outcomeNote) : d.outcomeNote,
    capabilities: d.capabilities.map((c) => ({ ...c, alternative: c.alternative ? t(c.alternative) : c.alternative })),
    paths: d.paths.map((p) => ({ ...p, drivenBy: t(p.drivenBy), costNote: t(p.costNote), next: t(p.next), untilApproved: p.untilApproved.map((l) => ({ ...l, text: t(l.text) })) })),
    prereqs: d.prereqs.map((p) => ({ ...p, why: t(p.why) })),
    steps: d.steps.map((s) => ({ ...s, detail: t(s.detail), values: s.values.map((v) => ({ ...v, text: rephrase(v.text) })) })),
    gotchas: d.gotchas.map((g) => ({ ...g, text: tidyText(g.text) })).filter((g) => g.text.length > 0),
    blockers: d.blockers.map((b) => ({ ...b, cause: t(b.cause), fix: t(b.fix) })),
    aiPolicy: { ...d.aiPolicy, summary: t(d.aiPolicy.summary) },
    customerAdminNote: d.customerAdminNote ? t(d.customerAdminNote) : d.customerAdminNote,
    unknowns: d.unknowns.map(tidyUnknown).filter(Boolean),
  };
}

export function sanitize(input: DraftGuide, validIds: Set<string>): DraftGuide {
  const draft = tidyDraft(dropManagedPaths(input));
  const ev = (ids: string[]) => Array.from(new Set(ids.map((i) => i.replace(/[[\]\s]/g, "")).filter((i) => validIds.has(i))));
  const pathIds = new Set(draft.paths.map((p) => p.id));
  const refs = (ids: string[] | null) => {
    if (!ids) return null;
    const kept = ids.filter((i) => pathIds.has(i));
    return kept.length ? kept : null;
  };
  const four = (xs: string[]) => [0, 1, 2, 3].map((i) => clip(xs[i] ?? "", 26));
  const seen = new Set<string>();
  const uniq = (id: string, i: number) => {
    const base = (id || `step-${i}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const out = seen.has(base) ? `${base}-${i}` : base;
    seen.add(out);
    return out;
  };
  const capIds = new Set(draft.capabilities.map((c) => c.id));
  return {
    ...draft,
    capabilities: draft.capabilities.slice(0, 6),
    defaultCapabilities: draft.defaultCapabilities.filter((c) => capIds.has(c)),
    summary: clip(draft.summary, 260),
    paths: draft.paths.slice(0, 4).map((p) => ({
      ...p,
      effort: clip(p.effort.split(/[:;(]/)[0], 28),
      cost: p.cost.trim() ? clip(p.cost, 32) : "Unknown",
      waitEvidence: ev(p.waitEvidence),
      costEvidence: ev(p.costEvidence),
      untilApproved: p.untilApproved.map((l) => ({ ...l, evidence: ev(l.evidence) })),
      lanes: { you: four(p.lanes.you), provider: four(p.lanes.provider) },
      tiers: p.tiers.length ? p.tiers : ["basic", "sensitive", "restricted"],
      audiences: p.audiences.length ? p.audiences : ["team", "customers", "public"],
    })),
    prereqs: draft.prereqs.map((p) => ({ ...p, paths: refs(p.paths) })),
    steps: draft.steps.slice(0, 16).map((s, i) => ({ ...s, id: uniq(s.id, i), evidence: ev(s.evidence), paths: refs(s.paths) })),
    gotchas: draft.gotchas.map((g) => ({ ...g, evidence: ev(g.evidence), paths: refs(g.paths) })),
    blockers: draft.blockers.map((b) => ({ ...b, paths: refs(b.paths) })),
    aiPolicy: { ...draft.aiPolicy, evidence: ev(draft.aiPolicy.evidence) },
  };
}

export type RunStats = Guide["run"];

// Guides are about the developer's own OAuth app. A path that just says "use Composio's managed
// app" would be picked as the default, so drop it and anything that only applied to it.
export function dropManagedPaths(draft: DraftGuide): DraftGuide {
  const managed = new Set(draft.paths.filter((p) => /composio|managed/i.test(`${p.id} ${p.label}`)).map((p) => p.id));
  if (managed.size === 0 || managed.size === draft.paths.length) return draft;
  const keep = <T extends { paths: string[] | null }>(items: T[]) =>
    items
      .map((x) => (x.paths ? { ...x, paths: x.paths.filter((id) => !managed.has(id)) } : x))
      .filter((x) => !x.paths || x.paths.length > 0);
  const paths = draft.paths.filter((p) => !managed.has(p.id));
  // Keep every audience covered after the drop.
  for (const aud of ["team", "customers", "public"] as const) {
    if (!paths.some((p) => p.audiences.includes(aud))) paths[paths.length - 1] = { ...paths[paths.length - 1], audiences: [...paths[paths.length - 1].audiences, aud] };
  }
  return { ...draft, paths, steps: keep(draft.steps), prereqs: keep(draft.prereqs), gotchas: keep(draft.gotchas), blockers: keep(draft.blockers) };
}

// Shorten at a word boundary so table cells never end mid-word.
function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[,.;:\s-]+$/, "") + "…";
}
