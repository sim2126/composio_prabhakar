import type { Metadata } from "next";
import { LevelPill } from "@/components/bits";
import { SNAPSHOTS } from "@/data/generated";
import { CURATED } from "@/data/guides";
import { CHECKS } from "@/data/verification";
import { APPS } from "@/lib/data";
import { RUBRIC } from "@/lib/rubric";

const KIND = {
  tested: ["Tested", "ev-tested"],
  corrected: ["Corrected", "ev-third_party"],
  conflict: ["Sources disagree", "ev-unverified"],
  confirmed: ["Confirmed", "ev-official"],
  unverified: ["Not verified", "ev-unverified"],
} as const;

export const metadata: Metadata = { title: "Method" };

const EVIDENCE = [
  ["Official", "ev-official", "The provider's own docs, policies or changelog, linked with the date we read them."],
  ["Probed", "ev-probed", "A live request to the provider's OAuth endpoints or discovery documents, recorded with its response."],
  ["Tested", "ev-tested", "We did the step ourselves in a real account and timed it."],
  ["Third-party", "ev-third_party", "Developer write-ups, forums, vendors and labs. Used for real-world wait times and rejection reasons."],
  ["Unverified", "ev-unverified", "No source supports the claim. Shown so you know to check it."],
] as const;

const PIPELINE = [
  ["Identify", "Resolve the name or URL to one product and its developer docs. Ambiguous input is flagged, not guessed."],
  ["Research", "Four agents run in parallel on Claude with web search and fetch: app setup, review and policy, API and AI-use terms, and developer reports."],
  ["Probe", "Code calls the provider's discovery documents and token endpoint with a dummy client to confirm the endpoints exist."],
  ["Write", "A second model turns the research notes into the guide schema. It may only cite sources the research agents actually read."],
  ["Check", "Code drops citations to sources that were never read, classifies each source, and computes difficulty from the rubric."],
] as const;

// Computed from the guides that ship with the app, so the numbers move as guides are added.
function numbers() {
  const units = new Set(APPS.map((a) => a.unit));
  const verified = APPS.filter((a) => CURATED[a.unit]).length;
  const generated = APPS.filter((a) => !CURATED[a.unit] && SNAPSHOTS[a.unit]).length;
  const outside = Object.keys(SNAPSHOTS).filter((s) => !units.has(s) && !CURATED[s]).length;
  const guides = [...Object.values(CURATED), ...Object.values(SNAPSHOTS)];
  const sources = guides.flatMap((g) => g.sources);
  const of = (cls: string) => sources.filter((s) => s.class === cls).length;
  const tested = guides.filter((g) => g.sources.some((s) => s.class === "tested")).map((g) => g.name);
  const runs = Object.values(SNAPSHOTS).flatMap((g) => (g.run ? [g.run] : []));
  const secs = runs.map((r) => r.seconds).sort((a, b) => a - b);
  const costs = runs.map((r) => r.costUsd);
  const kinds = (k: string) => CHECKS.filter((c) => c.kind === k).length;
  return [
    ["Apps with a guide", `${verified + generated} of ${APPS.length}`, `${verified} verified · ${generated} generated · ${outside} more outside the list`],
    ["Sources cited", String(sources.length), `${of("official")} official · ${of("probed")} probed · ${of("third_party")} third-party, across ${guides.length} guides`],
    ["Setup tested", String(tested.length), tested.join(", ") || "None yet"],
    [
      "Live generation",
      `${(secs[Math.floor(secs.length / 2)] / 60).toFixed(1)} min`,
      `Median of ${runs.length} runs · $${Math.min(...costs).toFixed(2)}–${Math.max(...costs).toFixed(2)} a guide`,
    ],
    ["Checks logged", String(CHECKS.length), `${kinds("corrected")} corrected · ${kinds("conflict")} sources disagree · ${kinds("confirmed")} confirmed`],
  ];
}

export default function MethodPage() {
  return (
    <main className="wrap" style={{ maxWidth: 880 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 className="h1">Method</h1>
        <p className="lede">
          Each guide answers four questions for a provider OAuth app: how hard it is, how long it takes including approval, what can block you, and which
          steps an agent can do. Here is how those answers are produced and how much to trust them.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">In numbers</h2>
        <div className="verdict-grid tight" style={{ borderBottom: 0 }}>
          {numbers().map(([label, value, note]) => (
            <div className="vcell" key={label}>
              <span className="label">{label}</span>
              <span className="big">{value}</span>
              <span className="small">{note}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="h2">Difficulty</h2>
        <p className="muted">The level follows from the strongest review on your path. Access gates and AI-use bans override it. The model never picks it.</p>
        <div>
          {RUBRIC.map((r) => (
            <div key={r.level} className="list-row two">
              <LevelPill level={r.level} />
              <span>{r.rule}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="h2">Evidence</h2>
        <div>
          {EVIDENCE.map(([label, cls, text]) => (
            <div key={label} className="list-row two">
              <span className={`chip ${cls}`} style={{ alignSelf: "baseline" }}>
                <span className="dot" />
                {label}
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <p className="muted">
          Wait times are shown as two numbers: what the provider publishes and what developers report. Neither is a promise.
        </p>
      </section>

      <section className="section">
        <h2 className="h2">How a live guide is generated</h2>
        <div>
          {PIPELINE.map(([name, text], i) => (
            <div key={name} className="list-row two">
              <span className="mono" style={{ fontSize: 13 }}>
                {String(i + 1).padStart(2, "0")} {name}
              </span>
              <span>{text}</span>
            </div>
          ))}
        </div>
        <p className="muted">
          Generated guides are labelled as such and are not human-reviewed. Agents never sign in, accept terms, pay or submit reviews; those steps are marked
          for you.
        </p>
      </section>

      <section className="section" id="checked">
        <h2 className="h2">What we checked</h2>
        <p className="muted">A sample of guidance re-checked against live sources and one real setup attempt. Corrections are already applied to the guides.</p>
        <div>
          {CHECKS.map((c) => (
            <div key={c.topic} className="list-row two">
              <span className={`chip ${KIND[c.kind][1]}`} style={{ alignSelf: "baseline" }}>
                <span className="dot" />
                {KIND[c.kind][0]}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontWeight: 500 }}>{c.topic}</span>
                <span>{c.finding}</span>
                <a href={c.source} target="_blank" rel="noopener noreferrer" className="small">
                  {c.source.replace(/^https:\/\//, "").slice(0, 70)}
                </a>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="h2">Data</h2>
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          <li>
            The 100-app list, managed-app availability and default scopes come from Composio&apos;s open toolkit catalog (
            <a href="https://github.com/ComposioHQ/composio">ComposioHQ/composio</a>, MIT).
          </li>
          <li>
            Authorization and token URLs for probes come from Ampersand&apos;s connector catalog (
            <a href="https://github.com/amp-labs/connectors">amp-labs/connectors</a>, MIT).
          </li>
          <li>Logos are served by logos.composio.dev and remain their owners&apos; trademarks.</li>
        </ul>
      </section>
    </main>
  );
}
