import type { Owner, Source } from "@/lib/guide";
import { LEVEL_LABEL, type Level } from "@/lib/rubric";

export function LevelPill({ level, large }: { level: Level | "none"; large?: boolean }) {
  const label = level === "none" ? "Not generated" : LEVEL_LABEL[level];
  return <span className={`pill lv-${level}${large ? " pill-lg" : ""}`}>{label}</span>;
}

const OWNER_LABEL: Record<Owner, string> = {
  agent: "AGENT",
  agent_drafts: "AGENT DRAFTS",
  you: "YOU",
  provider: "PROVIDER",
  lab: "LAB",
  customer_admin: "CUSTOMER ADMIN",
};

export function OwnerTag({ owner, provider }: { owner: Owner; provider?: string }) {
  const label = owner === "provider" && provider ? provider.toUpperCase() : OWNER_LABEL[owner];
  return <span className={`tag tag-${owner}`}>{label}</span>;
}

export const CLASS_LABEL: Record<Source["class"], string> = {
  official: "Official",
  third_party: "Third-party",
  probed: "Probed",
  tested: "Tested",
  unverified: "Unverified",
};

export function EvidenceChips({ ids, sources }: { ids: string[]; sources: Source[] }) {
  const found = ids.map((id) => sources.find((s) => s.id === id)).filter((s): s is Source => Boolean(s));
  if (found.length === 0) {
    return (
      <span className="chip ev-unverified" title="No source found for this claim">
        <span className="dot" />
        Unverified
      </span>
    );
  }
  return (
    <>
      {found.map((s) => (
        <a key={s.id} href={s.url} className={`chip ev-${s.class}`} target="_blank" rel="noopener noreferrer" title={s.title}>
          <span className="dot" />
          <span className="chip-text">
            {CLASS_LABEL[s.class]} · {s.domain}
          </span>
        </a>
      ))}
    </>
  );
}

export { AppTile } from "./AppTile";

export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00Z" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
