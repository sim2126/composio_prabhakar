"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { REPO_URL } from "@/lib/config";
import type { Audience, Guide, GuidePath, Phase } from "@/lib/guide";
import { agentRunbook, guideMarkdown } from "@/lib/markdown";
import { applies, levelFor, pickPath, worstTier } from "@/lib/rubric";
import { AppTile, CLASS_LABEL, EvidenceChips, LevelPill, OwnerTag, formatDate } from "./bits";
import { useCopy } from "./useCopy";

const AUDIENCES: [Audience, string][] = [
  ["team", "Your team only"],
  ["customers", "Your customers"],
  ["public", "Anyone"],
];
const PHASES: { key: Phase; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "wait", label: "Waiting" },
  { key: "launch", label: "Launch" },
];
const AI_LABEL = { ok: "Allowed", restrictions: "Allowed with limits", prohibited: "Prohibited", unknown: "Unclear" } as const;

function shortScope(name: string) {
  return name.replace("https://www.googleapis.com/auth/", "");
}

// One row per scope across the selected capabilities; a capability's note goes on its last row.
function scopeRows(caps: Guide["capabilities"]) {
  const seen = new Set<string>();
  return caps.flatMap((c) => {
    const scopes = c.scopes.filter((s) => !seen.has(s.name) && Boolean(seen.add(s.name)));
    return scopes.map((s, i) => ({ key: c.id + s.name, scope: s, note: i === scopes.length - 1 ? c.alternative : null }));
  });
}

export function GuideView({ guide, logo, initialCaps }: { guide: Guide; logo: string | null; initialCaps: string[] }) {
  const [audience, setAudience] = useState<Audience>("customers");
  const [caps, setCaps] = useState<string[]>(initialCaps.filter((c) => guide.capabilities.some((x) => x.id === c)));
  const [open, setOpen] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const { copy, label } = useCopy();
  const storeKey = `preflight:done:${guide.slug}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storeKey);
      if (saved) setDone(JSON.parse(saved));
    } catch {
      /* private mode or blocked storage: progress just isn't remembered */
    }
  }, [storeKey]);

  function toggleDone(id: string) {
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try {
        window.localStorage.setItem(storeKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const tier = worstTier(guide, caps);
  const path: GuidePath | null = pickPath(guide, audience, tier);
  const level = path ? levelFor(path.review, guide) : levelFor("unknown", guide);
  const steps = guide.steps.filter((s) => applies(s.paths, path?.id));
  const agentSteps = steps.filter((s) => s.owner === "agent" || s.owner === "agent_drafts").length;
  const doneCount = steps.filter((s) => done[s.id]).length;
  const selectedCaps = guide.capabilities.filter((c) => caps.includes(c.id));
  const providerName = guide.name.split(" ")[0];
  const humanOwners = Array.from(new Set(steps.filter((s) => s.owner === "you").map(() => "you")));
  const proxyIndex = steps.findIndex((s) => s.id === "redirect-proxy");

  const counts = useMemo(() => {
    const c = { official: 0, probed: 0, tested: 0, third_party: 0, unverified: 0 };
    for (const s of guide.sources) c[s.class] += 1;
    return c;
  }, [guide.sources]);

  const numbered = new Map(steps.map((s, i) => [s.id, String(i + 1).padStart(2, "0")]));
  // Read the URL after mount so server and client render the same markup.
  const [pageUrl, setPageUrl] = useState(`/guides/${guide.slug}`);
  useEffect(() => setPageUrl(window.location.href), []);

  const phaseOutcome = (key: Phase, active: boolean) => {
    if (!active) return "Not needed";
    if (key === "today") return path && path.review === "none" ? "Connected" : "Connected in testing";
    if (key === "week") return "Submitted";
    if (key === "wait") return "Approved";
    return "Live on your own app";
  };

  return (
    <main className="wrap" style={{ paddingTop: 24 }}>
      <div className="crumbs">
        <Link href="/">Library</Link>
        <span aria-hidden="true">/</span>
        <span>{guide.name}</span>
      </div>

      <section style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <AppTile name={guide.name} logo={logo} large />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
            <h1 className="h1">{guide.name}</h1>
            <span style={{ fontSize: 14, color: "var(--text-2)" }}>{guide.covers.join(" · ")}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          <span className="small" style={{ paddingRight: 4 }}>
            {guide.kind === "verified" ? "Verified" : "Agent-generated · not human-reviewed"} · checked {formatDate(guide.checkedAt)}
          </span>
          <button type="button" className="btn" onClick={() => copy("link", pageUrl)}>
            {label("link", "Copy link", "Link copied")}
          </button>
          <button type="button" className="btn" onClick={() => copy("md", guideMarkdown(guide, path, pageUrl))}>
            {label("md", "Copy as Markdown")}
          </button>
          <button type="button" className="btn" onClick={() => copy("agent", agentRunbook(guide, path, pageUrl))}>
            {label("agent", "Copy for your agent")}
          </button>
        </div>
      </section>

      <p style={{ fontSize: 15, color: "var(--text-2)", maxWidth: 820, marginTop: -12 }}>{guide.summary}</p>

      {guide.outcome !== "oauth_app" && guide.outcomeNote ? (
        <div className="banner">
          <span className="label-strong">Before you build</span>
          <span style={{ fontSize: 15 }}>{guide.outcomeNote}</span>
        </div>
      ) : null}

      {guide.paths.length > 0 ? (
        <section className="setup" aria-label="Your setup">
          <div className="setup-row" style={{ alignItems: "center" }}>
            <span id="who" className="setup-key" style={{ paddingTop: 0 }}>
              Who connects
            </span>
            <div className="row-wrap" role="group" aria-labelledby="who">
              {AUDIENCES.map(([key, label]) => (
                <button key={key} type="button" className="seg" aria-pressed={audience === key} onClick={() => setAudience(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {guide.capabilities.length > 0 ? (
            <div className="setup-row">
              <span id="needs" className="setup-key">
                Your agent needs to
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "1 1 280px", minWidth: 0 }}>
                <div className="row-wrap" role="group" aria-labelledby="needs">
                  {guide.capabilities.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="toggle"
                      aria-pressed={caps.includes(c.id)}
                      onClick={() => setCaps((cs) => (cs.includes(c.id) ? cs.filter((x) => x !== c.id) : [...cs, c.id]))}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {selectedCaps.length > 0 ? (
                  <div className="scope-table">
                    {scopeRows(selectedCaps).map(({ key, scope, note }) => (
                      <div className="scope-row" key={key}>
                        <span className="mono" style={{ overflowWrap: "anywhere" }}>
                          {shortScope(scope.name)}
                        </span>
                        <span className={`tier tier-${scope.tier}`}>{scope.label}</span>
                        {note ? <span className="muted scope-note">{note}</span> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="small">Nothing selected: the verdict assumes sign-in only.</span>
                )}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {path ? (
        <section className="verdict" aria-label="Verdict">
          <div className="verdict-grid">
            <div className="vcell">
              <span className="label">Difficulty</span>
              <LevelPill level={level} large />
              <span style={{ fontSize: 13, color: "var(--text-2)" }}>{path.drivenBy}</span>
              {path.customerAdmin === "always" || path.customerAdmin === "sometimes" ? (
                <span style={{ fontSize: 12.5, color: "var(--amber)" }}>
                  {path.customerAdmin === "always" ? "Each customer's admin must approve or install the app." : "Some customers' admins will need to approve the app."}
                </span>
              ) : null}
            </div>
            <div className="vcell">
              <span className="label">Time</span>
              <span className="big">{path.effort}</span>
              <span style={{ fontSize: 13 }}>your work, then waiting:</span>
              <span style={{ fontSize: 12.5 }}>
                <span className="muted">Official </span>
                {path.waitOfficial ?? "none published"}
              </span>
              <span style={{ fontSize: 12.5 }}>
                <span className="muted">Reported </span>
                {path.waitReported ?? "no recent reports found"}
              </span>
              <span className="row-wrap" style={{ marginTop: 4 }}>
                <EvidenceChips ids={path.waitEvidence.slice(0, 2)} sources={guide.sources} />
              </span>
            </div>
            <div className="vcell">
              <span className="label">Cost</span>
              <span className="big">{path.cost}</span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{path.costNote}</span>
            </div>
            <div className="vcell">
              <span className="label">Agent vs you</span>
              <span className="big">
                {agentSteps} of {steps.length} steps
              </span>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                done or drafted by the agent{humanOwners.length ? " · you sign in, verify and submit" : ""}
              </span>
            </div>
          </div>
          <div className="vline">
            <span className="label-strong">Next</span>
            <span className="body">{path.next}</span>
          </div>
          {path.untilApproved.length > 0 ? (
            <div className="vline">
              <span className="label-strong">Until approved</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 280px", minWidth: 0 }}>
                {path.untilApproved.map((l) => (
                  <div className="limit" key={l.text}>
                    <span>{l.text}</span>
                    <EvidenceChips ids={l.evidence} sources={guide.sources} />
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="cols">
        <div className="main-col">
          {path ? (
            <section id="plan" className="section">
              <h2 className="h2">Plan</h2>
              <div className="plan">
                <div className="plan-in">
                  <div className="ph corner" />
                  {PHASES.map((p, i) => (
                    <div className="ph" key={p.key}>
                      <span className="label-strong">{p.label}</span>
                      <span className="small">{phaseOutcome(p.key, Boolean(path.lanes.you[i] || path.lanes.provider[i]))}</span>
                    </div>
                  ))}
                  <div className="lane-key r1">You</div>
                  {PHASES.map((p, i) => (
                    <div className="r1" key={p.key}>
                      {path.lanes.you[i] ? <span className="bar bar-you">{path.lanes.you[i]}</span> : <span className="bar-none">—</span>}
                    </div>
                  ))}
                  <div className="lane-key">{providerName} · others</div>
                  {PHASES.map((p, i) => (
                    <div key={p.key}>
                      {path.lanes.provider[i] ? <span className="bar bar-them">{path.lanes.provider[i]}</span> : <span className="bar-none">—</span>}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ) : null}

          {guide.prereqs.filter((p) => applies(p.paths, path?.id)).length > 0 ? (
            <section id="before" className="section">
              <h2 className="h2">Before you start</h2>
              <div>
                {guide.prereqs
                  .filter((p) => applies(p.paths, path?.id))
                  .map((p) => (
                    <div className="list-row" key={p.text}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontWeight: 500 }}>{p.text}</span>
                        <span className="small">{p.why}</span>
                      </div>
                      <OwnerTag owner={p.owner} provider={providerName} />
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {steps.length > 0 ? (
            <section id="steps" className="section">
              <div className="section-head">
                <h2 className="h2">
                  Steps{" "}
                  <span className="mono" style={{ fontSize: 13, fontWeight: 400, color: "var(--text-3)", paddingLeft: 6 }}>
                    {doneCount} of {steps.length} done
                  </span>
                </h2>
                <div className="row-wrap">
                  <span className="tag tag-agent">AGENT</span>
                  <span className="tag tag-agent_drafts">AGENT DRAFTS</span>
                  <span className="tag tag-you">YOU</span>
                  <span className="tag">{providerName.toUpperCase()} · LAB</span>
                </div>
              </div>
              {PHASES.map((ph) => {
                const inPhase = steps.filter((s) => s.phase === ph.key);
                if (!inPhase.length) return null;
                return (
                  <div key={ph.key}>
                    <div className="phase-head">
                      <span className="label-strong">{ph.label}</span>
                    </div>
                    {inPhase.map((s) => {
                      const isOpen = open === s.id;
                      return (
                        <div className={`step${done[s.id] ? " step-done" : ""}`} key={s.id}>
                          <div className="step-line">
                            <button
                              type="button"
                              className="check"
                              aria-pressed={Boolean(done[s.id])}
                              aria-label={`${done[s.id] ? "Mark not done" : "Mark done"}: ${s.title}`}
                              onClick={() => toggleDone(s.id)}
                            >
                              {done[s.id] ? (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                  <path d="M2.5 6.2l2.2 2.2L9.5 3.6" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              ) : null}
                            </button>
                            <button type="button" className="step-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.id)}>
                              <span className="mono" style={{ fontSize: 13, color: "var(--text-3)" }}>
                                {numbered.get(s.id)}
                              </span>
                              <span className="step-title">{s.title}</span>
                              <OwnerTag owner={s.owner} provider={providerName} />
                              <span className="step-time">{s.time}</span>
                              <svg className="chev" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                <path d="M4 6l4 4 4-4" stroke="#667080" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </button>
                          </div>
                          {isOpen ? (
                            <div className="step-body">
                              <p>{s.detail}</p>
                              {s.values.map((v, i) => (
                                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <span className="small">{v.label}</span>
                                  <div className="codebox">
                                    <code>{v.text}</code>
                                    <button type="button" onClick={() => copy(`${s.id}-${i}`, v.text)}>
                                      {label(`${s.id}-${i}`, "Copy")}
                                    </button>
                                  </div>
                                </div>
                              ))}
                              <div className="row-wrap">
                                <EvidenceChips ids={s.evidence} sources={guide.sources} />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </section>
          ) : null}

          {guide.gotchas.filter((g) => applies(g.paths, path?.id)).length > 0 ? (
            <section id="watch" className="section">
              <h2 className="h2">Watch out</h2>
              <div>
                {guide.gotchas
                  .filter((g) => applies(g.paths, path?.id))
                  .map((g) => (
                    <div key={g.text} style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "6px 16px", padding: "11px 0", borderBottom: "1px solid var(--line-soft)" }}>
                      <span style={{ flex: "1 1 260px", minWidth: 0 }}>{g.text}</span>
                      <span className="row-wrap">
                        <EvidenceChips ids={g.evidence} sources={guide.sources} />
                      </span>
                    </div>
                  ))}
              </div>
            </section>
          ) : null}

          {guide.blockers.filter((b) => applies(b.paths, path?.id)).length > 0 ? (
            <section id="blocked" className="section">
              <h2 className="h2">If you&apos;re blocked</h2>
              <div className="blk">
                <div className="blk-in" role="table" aria-label="Blockers">
                  <div className="blk-row th" role="row">
                    <div role="columnheader">You see</div>
                    <div role="columnheader">Usually because</div>
                    <div role="columnheader">Do this</div>
                  </div>
                  {guide.blockers
                    .filter((b) => applies(b.paths, path?.id))
                    .map((b) => (
                      <div className="blk-row" role="row" key={b.see}>
                        <div role="cell" className="mono" style={{ fontSize: 12.5 }}>
                          {b.see}
                        </div>
                        <div role="cell" className="muted">
                          {b.cause}
                        </div>
                        <div role="cell">{b.fix}</div>
                      </div>
                    ))}
                </div>
              </div>
            </section>
          ) : null}

          {guide.unknowns.length > 0 ? (
            <section id="unknowns" className="section">
              <h2 className="h2">What we couldn&apos;t confirm</h2>
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
                {guide.unknowns.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="sources" className="section">
            <div className="section-head">
              <h2 className="h2">Sources</h2>
              <a
                href={`${REPO_URL}/issues/new?title=${encodeURIComponent(`Outdated: ${guide.name} guide`)}&body=${encodeURIComponent(`Guide: ${pageUrl}\n\nWhat changed (with a link to the source):\n`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 13 }}
              >
                Report something outdated
              </a>
            </div>
            <div>
              {guide.sources.map((s) => (
                <div className="src-row" key={s.id}>
                  <span className={`chip ev-${s.class}`} style={{ alignSelf: "baseline" }}>
                    <span className="dot" />
                    {CLASS_LABEL[s.class]}
                  </span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">
                    {s.title} <span className="muted">· {s.domain}</span>
                  </a>
                  <span className="mono" style={{ fontSize: 12, color: "var(--text-3)", textAlign: "right" }}>
                    {formatDate(s.retrievedAt)}
                  </span>
                </div>
              ))}
            </div>
            {guide.probes.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                <span className="label">Live probes</span>
                {guide.probes.map((p) => (
                  <span key={p.target + p.request} className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                    {p.request} → {p.target}: {p.result}
                  </span>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <aside className="rail">
          <div className="card">
            <span className="label-strong">On Composio</span>
            <div className="kv">
              <span className="muted">Managed app</span>
              <span>
                {guide.composio.toolkits.length === 0
                  ? "No toolkit"
                  : guide.composio.toolkits.some((t) => t.managed)
                    ? "Available"
                    : "Bring your own"}
              </span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>
              {guide.composio.toolkits.some((t) => t.managed)
                ? "Fine for building. Users see “Composio” on the consent screen, quota is shared, and scopes are fixed."
                : guide.composio.toolkits.length
                  ? "Composio has no managed app here, so you need your own from day one."
                  : "Composio has no toolkit for this app today."}
            </p>
            {guide.composio.defaultRedirect ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="small">Redirect URI for your own app</span>
                <div className="codebox">
                  <code style={{ fontSize: 11.5 }}>{guide.composio.defaultRedirect}</code>
                  <button type="button" onClick={() => copy("redirect", guide.composio.defaultRedirect ?? "")}>
                    {label("redirect", "Copy")}
                  </button>
                </div>
                <span className="small">
                  Must match your auth config exactly.
                  {proxyIndex >= 0 ? ` For verification, route it through your own domain (step ${String(proxyIndex + 1).padStart(2, "0")}).` : ""}
                </span>
              </div>
            ) : null}
          </div>

          {audience === "customers" && guide.customerAdminNote ? (
            <div className="card card-warm">
              <span className="label-strong" style={{ color: "var(--amber)" }}>
                Your customers&apos; admins
              </span>
              <p style={{ fontSize: 13, color: "#2b3038" }}>{guide.customerAdminNote}</p>
              <button
                type="button"
                className="btn btn-sm"
                style={{ alignSelf: "flex-start" }}
                onClick={() => copy("admin", `To connect ${guide.name} to our app, your admin needs to: ${guide.customerAdminNote}`)}
              >
                {label("admin", "Copy note for admins")}
              </button>
            </div>
          ) : null}

          <div className="card">
            <span className="label-strong">AI use</span>
            <div className="kv">
              <span className="muted">Provider terms</span>
              <span>{AI_LABEL[guide.aiPolicy.status]}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-2)" }}>{guide.aiPolicy.summary}</p>
            <div className="row-wrap">
              <EvidenceChips ids={guide.aiPolicy.evidence} sources={guide.sources} />
            </div>
          </div>

          <div className="card">
            <span className="label-strong">Evidence</span>
            {(Object.keys(counts) as (keyof typeof counts)[]).filter((k) => counts[k] > 0).map((k) => (
              <div className="kv" key={k} style={{ fontSize: 13 }}>
                <span className={`chip ev-${k}`} style={{ border: 0, padding: 0, height: "auto", background: "transparent" }}>
                  <span className="dot" />
                  <span style={{ color: "var(--ink)", fontFamily: "var(--font-sans)", fontSize: 13 }}>{CLASS_LABEL[k]}</span>
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
                  {counts[k]}
                </span>
              </div>
            ))}
            <span className="small">Official = provider docs · Probed = live endpoint check · Tested = setup run · Third-party = blogs, forums, vendors</span>
          </div>

          <nav aria-label="On this page" className="toc">
            {[
              ["plan", "Plan"],
              ["before", "Before you start"],
              ["steps", "Steps"],
              ["watch", "Watch out"],
              ["blocked", "If you're blocked"],
              ["unknowns", "What we couldn't confirm"],
              ["sources", "Sources"],
            ].map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </main>
  );
}
