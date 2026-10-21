"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { LibraryRow } from "@/lib/data";
import type { Level } from "@/lib/rubric";
import { AppTile, LevelPill, formatDate } from "./bits";

type Filter = "all" | Level | "none";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["self_serve", "Self-serve"],
  ["light", "Light review"],
  ["formal", "Formal review"],
  ["heavy", "Heavy review"],
  ["restricted", "Restricted"],
  ["none", "Not generated"],
];

const levelOf = (r: LibraryRow): Level | "none" => r.guide?.level ?? "none";
const guideHref = (r: LibraryRow) => (r.guide ? `/guides/${r.unit}?app=${r.slug}` : `/generate?q=${encodeURIComponent(r.name)}&auto=1`);

export function Library({ rows }: { rows: LibraryRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const q = query.trim().toLowerCase();
  const byQuery = useMemo(
    () => rows.filter((r) => !q || `${r.name} ${r.slug} ${r.category ?? ""}`.toLowerCase().includes(q)),
    [rows, q],
  );
  const shown = byQuery.filter((r) => filter === "all" || levelOf(r) === filter);
  const exact = rows.find((r) => r.name.toLowerCase() === q || r.slug === q);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    if (exact?.guide) router.push(guideHref(exact));
    else router.push(`/generate?q=${encodeURIComponent(value)}&auto=1`);
  }

  return (
    <>
      <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: -14 }}>
        <label htmlFor="q" className="sr">
          Search apps or enter any app name or URL
        </label>
        <input
          id="q"
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search 100 apps, or enter any app name or URL"
          autoComplete="off"
          maxLength={120}
        />
        <button type="submit" className="btn btn-primary">
          {exact?.guide ? "Open guide" : "Generate guide"}
        </button>
      </form>

      <div className="row-wrap" role="group" aria-label="Filter by approval level">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className="seg" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            <span>{label}</span>
            <span className="count">{key === "all" ? byQuery.length : byQuery.filter((r) => levelOf(r) === key).length}</span>
          </button>
        ))}
      </div>

      <div className="lib-scroll">
        <div className="tbl-in" role="table" aria-label="OAuth apps">
          <div className="tr th" role="row">
            <div role="columnheader">App</div>
            <div role="columnheader">Approval</div>
            <div role="columnheader">Your effort</div>
            <div role="columnheader">Approval wait</div>
            <div role="columnheader">Composio app</div>
            <div role="columnheader">Guide</div>
          </div>
          {shown.map((r) => (
            <div className="tr body" role="row" key={r.slug}>
              <div role="cell" className="app-cell">
                <AppTile name={r.name} logo={r.logo} />
                <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <Link href={guideHref(r)}>{r.name}</Link>
                  <span className="small">{r.category ?? "—"}</span>
                </div>
              </div>
              <div role="cell" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                <LevelPill level={levelOf(r)} />
                {r.guide?.note ? <span className="small">{r.guide.note}</span> : null}
              </div>
              <div role="cell">{r.guide?.effort ?? "—"}</div>
              <div role="cell">{r.guide?.wait ?? "—"}</div>
              <div role="cell" className="muted">
                {!r.inComposio ? "Not in Composio" : r.managed ? "Managed available" : "Bring your own"}
              </div>
              <div role="cell">
                {r.guide ? (
                  <Link className="nowrap" href={guideHref(r)} style={{ color: r.guide.kind === "verified" ? "var(--ink)" : "var(--text-2)", fontWeight: r.guide.kind === "verified" ? 500 : 400 }}>
                    {r.guide.kind === "verified" ? "Verified" : "Generated"} · {formatDate(r.guide.checkedAt).replace(/ \d{4}$/, "")}
                  </Link>
                ) : (
                  <Link href={guideHref(r)} style={{ fontWeight: 500 }}>
                    Generate
                  </Link>
                )}
              </div>
            </div>
          ))}
          {q && shown.length === 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 16px" }}>
              <span className="muted">No guide for “{query.trim()}” yet.</span>
              <Link className="btn btn-primary" style={{ height: 38 }} href={`/generate?q=${encodeURIComponent(query.trim())}&auto=1`}>
                Generate guide for “{query.trim()}”
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <p className="small" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
        <span>
          Showing {shown.length} of {rows.length}. Levels assume an external B2B app with typical scopes; open a guide to set your audience and scopes.
        </span>
        <span>Verified: checked against official sources · Generated: agent research, not human-reviewed</span>
      </p>
    </>
  );
}
