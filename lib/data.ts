import appsFile from "@/data/apps.json";
import { SNAPSHOTS } from "@/data/generated";
import { CURATED } from "@/data/guides";
import { Guide } from "./guide";
import { levelFor, pickPath, worstTier, type Level } from "./rubric";
import { getJSON, setJSON } from "./store";

export type AppEntry = {
  rank: number;
  slug: string;
  unit: string;
  name: string;
  category: string | null;
  logo: string | null;
  inComposio: boolean;
  authSchemes: string[];
  managed: boolean;
  toolCount: number;
  defaultRedirect: string | null;
  defaultScopes: string[];
};
export const APPS = appsFile.apps as AppEntry[];

export type GuideSummary = {
  slug: string;
  name: string;
  kind: "verified" | "generated";
  level: Level;
  effort: string;
  wait: string;
  note: string;
  checkedAt: string;
};

export type LibraryRow = {
  slug: string;
  name: string;
  category: string | null;
  logo: string | null;
  unit: string;
  managed: boolean;
  inComposio: boolean;
  guide: GuideSummary | null;
};

const INDEX_KEY = "guides:index";

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

export async function getGuide(slug: string): Promise<Guide | null> {
  if (CURATED[slug]) return CURATED[slug];
  const stored = await getJSON<Guide>(`guide:${slug}`);
  if (stored) {
    const parsed = Guide.safeParse(stored);
    if (parsed.success) return parsed.data;
  }
  return SNAPSHOTS[slug] ?? null;
}

export async function saveGeneratedGuide(guide: Guide): Promise<void> {
  await setJSON(`guide:${guide.slug}`, guide);
  const index = (await getJSON<GuideSummary[]>(INDEX_KEY)) ?? [];
  const next = [summarize(guide), ...index.filter((g) => g.slug !== guide.slug)].slice(0, 500);
  await setJSON(INDEX_KEY, next);
}

// Which capabilities to preselect when a guide is opened from a specific app row.
export const CAP_PRESETS: Record<string, Record<string, string[]>> = {
  "google-workspace": {
    gmail: ["send", "read"],
    googlecalendar: ["calendar"],
    googledrive: ["drive-picked"],
    googledocs: ["drive-picked"],
    googlesheets: ["drive-picked"],
    googleslides: ["drive-picked"],
    googlemeet: ["calendar"],
    googletasks: ["tasks"],
  },
};

// The library's one-line view of a guide: the path an external B2B app with typical scopes takes.
export function summarize(guide: Guide, caps?: string[]): GuideSummary {
  const tier = worstTier(guide, caps ?? guide.defaultCapabilities);
  const path = pickPath(guide, "customers", tier);
  const level = path ? levelFor(path.review, guide) : levelFor("unknown", guide);
  const generic = guide.capabilities.length > 1 && guide.paths.length > 2;
  const shortWait = path?.lanes.provider[2] || (path?.waitOfficial ? path.waitOfficial.split(/[,;(]/)[0] : "") || "None published";
  return {
    slug: guide.slug,
    name: guide.name,
    kind: guide.kind,
    level,
    effort: guide.outcome === "oauth_app" ? (path?.effort ?? "—") : "—",
    wait: guide.outcome === "oauth_app" ? shortWait : "—",
    note:
      guide.outcome !== "oauth_app"
        ? outcomeLabel(guide.outcome)
        : path?.customerAdmin === "always"
          ? "Customer admin must approve"
          : generic
            ? "Depends on scopes"
            : "",
    checkedAt: guide.checkedAt,
  };
}

export function outcomeLabel(outcome: Guide["outcome"]): string {
  switch (outcome) {
    case "api_key_only":
      return "No OAuth: API keys only";
    case "partner_only":
      return "Partner access only";
    case "closed":
      return "API closed to new apps";
    case "unknown":
      return "Unclear";
    default:
      return "";
  }
}

export async function libraryRows(): Promise<LibraryRow[]> {
  const stored = (await getJSON<GuideSummary[]>(INDEX_KEY)) ?? [];
  const storedSlugs = new Set(stored.map((g) => g.slug));
  const generated = [...stored, ...Object.values(SNAPSHOTS).filter((g) => !storedSlugs.has(g.slug)).map((g) => summarize(g))].filter((g) => !CURATED[g.slug]);
  const byUnit = new Map<string, GuideSummary>();
  for (const g of generated) byUnit.set(g.slug, g);
  for (const g of Object.values(CURATED)) byUnit.set(g.slug, summarize(g));

  const rows: LibraryRow[] = APPS.map((a) => {
    const preset = CAP_PRESETS[a.unit]?.[a.slug];
    const curated = CURATED[a.unit];
    return {
      slug: a.slug,
      name: a.name,
      category: a.category,
      logo: a.logo,
      unit: a.unit,
      managed: a.managed,
      inComposio: a.inComposio,
      guide: preset && curated ? summarize(curated, preset) : (byUnit.get(a.unit) ?? null),
    };
  });

  // Guides generated for apps outside the 100-app list still belong in the library.
  const known = new Set(APPS.map((a) => a.unit));
  for (const g of generated) {
    if (known.has(g.slug)) continue;
    rows.push({ slug: g.slug, name: g.name, category: null, logo: null, unit: g.slug, managed: false, inComposio: false, guide: g });
  }
  return rows;
}

// Map free-text input to a library unit when it names a known app.
export function matchApp(input: string): AppEntry | null {
  const q = slugify(input.replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].replace(/\.(com|io|so|app|ai|co|dev|net|org)$/i, ""));
  if (!q) return null;
  return (
    APPS.find((a) => slugify(a.name) === q || a.slug.replace(/_/g, "-") === q || a.unit === q) ??
    null
  );
}
