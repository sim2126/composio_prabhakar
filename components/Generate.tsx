"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { GuideSummary } from "@/lib/data";
import { LevelPill } from "./bits";
import { useCopy } from "./useCopy";

// Apps in the 100-app list with no guide yet, so a first-time visitor sees the agent run.
const EXAMPLES = ["Zoom", "Shopify", "Spotify", "Figma"];

type StageKey = "identify" | "setup" | "review" | "terms" | "reports" | "probe" | "write" | "check";
type StageState = "pending" | "running" | "done" | "failed";
type Event = Record<string, unknown> & { type: string };

const STAGES: { key: StageKey; title: string }[] = [
  { key: "identify", title: "Identify the app" },
  { key: "setup", title: "Research app setup" },
  { key: "review", title: "Research review rules and limits" },
  { key: "terms", title: "Read the API terms on AI use" },
  { key: "reports", title: "Search developer reports" },
  { key: "probe", title: "Probe live endpoints" },
  { key: "write", title: "Write the guide" },
  { key: "check", title: "Check every citation" },
];

const initialStages = () => Object.fromEntries(STAGES.map((s) => [s.key, { state: "pending" as StageState, lines: [] as string[] }])) as Record<StageKey, { state: StageState; lines: string[] }>;

async function readNdjson(res: Response, onEvent: (e: Event) => void) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

export function Generate() {
  const params = useSearchParams();
  const router = useRouter();
  const [input, setInput] = useState(params.get("q") ?? "");
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState(initialStages);
  const [app, setApp] = useState<{ name: string; domain: string; composio: string; ambiguous: string | null } | null>(null);
  const [result, setResult] = useState<{ slug: string; summary: GuideSummary; stats: Record<string, number> } | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [existing, setExisting] = useState<{ slug: string; name: string; kind: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const { copy, label } = useCopy();
  const started = useRef(0);
  const autoStarted = useRef(false);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  function update(key: StageKey, patch: Partial<{ state: StageState; line: string }>) {
    setStages((s) => {
      const cur = s[key];
      const lines = patch.line ? [...cur.lines, patch.line].slice(-6) : cur.lines;
      return { ...s, [key]: { state: patch.state ?? cur.state, lines } };
    });
  }

  async function start(refresh = false) {
    const q = input.trim();
    if (!q || running) return;
    setRunning(true);
    setStages(initialStages());
    setApp(null);
    setResult(null);
    setError(null);
    setExisting(null);
    started.current = Date.now();
    setElapsed(0);
    const demoKey = new URLSearchParams(window.location.search).get("key") ?? window.sessionStorage.getItem("preflight-demo-key");
    if (demoKey) window.sessionStorage.setItem("preflight-demo-key", demoKey);
    const headers: Record<string, string> = { "content-type": "application/json", ...(demoKey ? { "x-demo-key": demoKey } : {}) };

    let bundle: { bundle: string; sig: string } | null = null;
    let failed = false;
    const fail = (code: string, message: string) => {
      failed = true;
      setError({ code, message });
    };

    try {
      const res = await fetch("/api/generate/research", { method: "POST", headers, body: JSON.stringify({ q, refresh }) });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        fail("bad_input", (j as { error?: string }).error ?? "Couldn't start the run.");
      } else {
        await readNdjson(res, (e) => {
          if (e.type === "stage" && e.stage === "identify") update("identify", { state: "running" });
          if (e.type === "identified") {
            update("identify", { state: "done", line: `${e.name} · ${e.domain}` });
            update("identify", { line: String(e.composio) });
            setApp({ name: String(e.name), domain: String(e.domain), composio: String(e.composio), ambiguous: (e.ambiguous as string | null) ?? null });
          }
          if (e.type === "stage" && e.stage === "research") (["setup", "review", "terms", "reports"] as StageKey[]).forEach((k) => update(k, { state: "running" }));
          if (e.type === "progress" && typeof e.track === "string") update(e.track as StageKey, { line: String(e.text) });
          if (e.type === "track_done") update(e.track as StageKey, { state: e.error ? "failed" : "done", line: `${e.sources} sources · ${e.searches} searches · ${e.fetches} pages read` });
          if (e.type === "exists") setExisting({ slug: String(e.slug), name: String(e.name), kind: String(e.kind) });
          if (e.type === "error") fail(String(e.code), String(e.message));
          if (e.type === "research_done") bundle = { bundle: String(e.bundle), sig: String(e.sig) };
        });
      }

      if (bundle && !failed) {
        const res2 = await fetch("/api/generate/write", { method: "POST", headers, body: JSON.stringify(bundle) });
        if (!res2.ok) {
          const j = await res2.json().catch(() => ({}));
          fail("write", (j as { error?: string }).error ?? "Couldn't write the guide.");
        } else {
          await readNdjson(res2, (e) => {
            if (e.type === "stage" && e.stage === "probe") update("probe", { state: "running" });
            if (e.type === "progress" && e.track === "probe") update("probe", { line: String(e.text) });
            if (e.type === "stage" && e.stage === "write") {
              update("probe", { state: "done" });
              update("write", { state: "running" });
            }
            if (e.type === "writing") setStages((s) => ({ ...s, write: { state: "running", lines: [`${Math.round(Number(e.chars) / 100) / 10}k characters written`] } }));
            if (e.type === "stage" && e.stage === "check") {
              update("write", { state: "done" });
              update("check", { state: "running" });
            }
            if (e.type === "saved") {
              const stats = e.stats as Record<string, number>;
              update("check", { state: "done", line: `${stats.cited} of ${stats.sources} sources cited · ${stats.probes} probes` });
              setResult({ slug: String(e.slug), summary: e.summary as GuideSummary, stats });
            }
            if (e.type === "error") fail(String(e.code), String(e.message));
          });
        }
      }
    } catch {
      fail("network", "The connection dropped. Check your network and try again.");
    } finally {
      setRunning(false);
      setStages((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.state === "running" ? { ...v, state: failed ? "failed" : "done" } : v])) as typeof s);
    }
  }

  // Start automatically only when the visitor clicked "Generate" in the library (auto=1).
  useEffect(() => {
    if (!autoStarted.current && params.get("auto") === "1" && input.trim()) {
      autoStarted.current = true;
      void start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLine = running ? `Running · ${elapsed}s` : result ? `Done in ${result.stats.seconds ?? elapsed}s · ~$${result.stats.costUsd ?? "?"}` : "";

  return (
    <>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 className="h1" style={{ fontSize: 22 }}>
          Generate a guide
        </h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
          style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}
        >
          <label htmlFor="app" className="sr">
            App name or URL
          </label>
          <input id="app" className="input" style={{ height: 44 }} value={input} onChange={(e) => setInput(e.target.value)} placeholder="App name or website, e.g. zoom.us" maxLength={100} autoComplete="off" />
          <button type="submit" className="btn btn-primary" style={{ height: 44 }} disabled={running || !input.trim()}>
            {running ? "Generating…" : result ? "Run again" : "Generate"}
          </button>
          <span className="mono small">{statusLine}</span>
        </form>
        <p className="small">An agent researches the provider&apos;s docs and developer reports, probes its endpoints, and writes a cited guide. Usually 2–4 minutes.</p>
        {!running && !result && !existing && !app && !error ? (
          <span className="row-wrap small" style={{ alignItems: "center" }}>
            Not in the library yet:
            {EXAMPLES.map((name) => (
              <button key={name} type="button" className="btn btn-sm" onClick={() => setInput(name)}>
                {name}
              </button>
            ))}
            or any app&apos;s website.
          </span>
        ) : null}
      </section>

      {existing ? (
        <div className="banner">
          <span className="label-strong">Already in the library</span>
          <span style={{ fontSize: 15 }}>
            {existing.name} has a {existing.kind === "verified" ? "verified" : "recently generated"} guide.
          </span>
          <span className="row-wrap" style={{ marginTop: 6 }}>
            <Link className="btn btn-primary btn-sm" style={{ height: 34 }} href={`/guides/${existing.slug}`}>
              Open guide
            </Link>
            {existing.kind !== "verified" ? (
              <button type="button" className="btn" onClick={() => void start(true)}>
                Generate a fresh one
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="err" role="alert">
          {error.message}{" "}
          {error.code !== "rate" ? (
            <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void start()}>
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {existing ? null : (
        <div className="gen-cols">
          <section className="agent-log" aria-label="Agent progress" aria-live="polite">
            <span className="label-strong" style={{ paddingBottom: 8 }}>
              Agent
            </span>
            {STAGES.map((s) => {
              const st = stages[s.key];
              return (
                <div key={s.key} className={`stage stage-${st.state}`}>
                  <span style={{ display: "inline-flex", paddingTop: 2 }}>
                    {st.state === "done" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Done">
                        <circle cx="8" cy="8" r="7" stroke="#166534" strokeWidth="1.3" />
                        <path d="M5 8.2l2 2L11 6" stroke="#166534" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : st.state === "running" ? (
                      <svg className="spin" width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Running">
                        <circle cx="8" cy="8" r="7" stroke="#e3e5e8" strokeWidth="1.6" />
                        <path d="M8 1a7 7 0 0 1 7 7" stroke="#1d4ed8" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    ) : st.state === "failed" ? (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Failed">
                        <circle cx="8" cy="8" r="7" stroke="#9a3412" strokeWidth="1.3" />
                        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#9a3412" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" role="img" aria-label="Waiting">
                        <circle cx="8" cy="8" r="7" stroke="#c9cdd3" strokeWidth="1.3" strokeDasharray="2 2.2" />
                      </svg>
                    )}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                    <span className="stage-title" style={{ fontWeight: st.state === "pending" ? 400 : 500 }}>
                      {s.title}
                    </span>
                    {st.lines.map((l, i) => (
                      <span key={i} className="stage-line">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="preview" aria-label="Guide preview">
            {app ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.015em" }}>{app.name}</span>
                <span className="small">
                  {app.domain} · {app.composio}
                </span>
                {app.ambiguous ? <span style={{ fontSize: 13, color: "var(--amber)" }}>Assumed {app.name}. {app.ambiguous}</span> : null}
                <span className="tag" style={{ alignSelf: "flex-start", borderStyle: "dashed", background: "#fff", marginTop: 4 }}>
                  AGENT-GENERATED · NOT HUMAN-REVIEWED
                </span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 14 }} aria-hidden="true">
                <span className="skel" style={{ width: 40, height: 40, borderRadius: 8 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span className="skel" style={{ width: 180, height: 18 }} />
                  <span className="skel" style={{ width: 260, height: 12 }} />
                </div>
              </div>
            )}

            <div className="verdict" style={{ borderBottom: "1px solid var(--line)" }}>
              <div className="verdict-grid tight" style={{ borderBottom: 0 }}>
                {[
                  ["Difficulty", result ? <LevelPill key="l" level={result.summary.level} large /> : null],
                  ["Your effort", result ? <span className="big">{result.summary.effort}</span> : null],
                  ["Approval wait", result ? <span style={{ fontSize: 15, fontWeight: 500 }}>{result.summary.wait}</span> : null],
                  ["Guide", result ? <span style={{ fontSize: 15, fontWeight: 500 }}>{result.stats.cited} sources cited</span> : null],
                ].map(([label, value], i) => (
                  <div className="vcell" key={i}>
                    <span className="label">{label}</span>
                    {value ?? (
                      <>
                        <span className="skel" style={{ width: "70%", height: 20 }} />
                        <span className="skel" style={{ width: "90%", height: 10 }} />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {result ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 8 }}>
                <span className="small">
                  {result.summary.note ? `${result.summary.note} · ` : ""}Saved to the library. Anyone with the link can open it.
                </span>
                <span className="row-wrap">
                  <button type="button" className="btn" onClick={() => void copy("link", `${window.location.origin}/guides/${result.slug}`)}>
                    {label("link", "Copy link", "Link copied")}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" style={{ height: 34 }} onClick={() => router.push(`/guides/${result.slug}`)}>
                    Open guide
                  </button>
                </span>
              </div>
            ) : (
              <p className="small">The full guide opens here when the agent finishes: plan, steps with owners, blockers, and every source it read.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
