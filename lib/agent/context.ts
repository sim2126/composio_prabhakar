import composioFile from "@/data/composio-index.json";
import endpointsFile from "@/data/oauth-endpoints.json";
import { APPS, slugify } from "@/lib/data";

type Toolkit = (typeof composioFile)["toolkits"][number];
const TOOLKITS: Toolkit[] = composioFile.toolkits;
const ENDPOINTS = endpointsFile.endpoints as Record<string, { displayName: string; authURL: string | null; tokenURL: string | null }>;
const COMPOSIO_REDIRECT = "https://backend.composio.dev/api/v1/auth-apps/add";

const norm = (s: string) => slugify(s).replace(/-/g, "");

// Composio toolkits for an app: every toolkit in the same library unit, else name matches.
export function composioFor(name: string, unit: string | null) {
  const fromUnit = unit ? APPS.filter((a) => a.unit === unit && a.inComposio) : [];
  if (fromUnit.length) {
    return {
      toolkits: fromUnit.map((a) => ({ slug: a.slug, name: a.name, managed: a.managed })),
      defaultRedirect: fromUnit.find((a) => a.defaultRedirect)?.defaultRedirect ?? COMPOSIO_REDIRECT,
      oauth: fromUnit.some((a) => a.authSchemes.includes("OAUTH2")),
    };
  }
  const key = norm(name);
  const hits = TOOLKITS.filter((t) => norm(t.name) === key || norm(t.slug) === key || norm(t.slug) === key + "mcp");
  return {
    toolkits: hits.filter((t) => !t.slug.endsWith("_mcp")).map((t) => ({ slug: t.slug, name: t.name, managed: t.managed })),
    defaultRedirect: hits.some((t) => t.authSchemes.includes("OAUTH2")) ? COMPOSIO_REDIRECT : null,
    oauth: hits.some((t) => t.authSchemes.includes("OAUTH2")),
    schemes: Array.from(new Set(hits.flatMap((t) => t.authSchemes))),
  };
}

export function composioLine(c: ReturnType<typeof composioFor>): string {
  if (!c.toolkits.length) return "Composio has no toolkit for this app.";
  const names = c.toolkits.map((t) => t.slug).join(", ");
  const managed = c.toolkits.some((t) => t.managed);
  return `Composio toolkit(s): ${names}. ${managed ? "Composio offers a managed OAuth app (consent screen shows Composio)." : "No Composio-managed OAuth app: developers must bring their own."}${
    c.defaultRedirect ? ` Redirect URI to register in the provider app: ${c.defaultRedirect}` : ""
  }`;
}

export function endpointsFor(name: string, domain: string | null): { authURL: string | null; tokenURL: string | null } | null {
  const key = norm(name);
  for (const [k, v] of Object.entries(ENDPOINTS)) {
    if (norm(k) === key || norm(v.displayName) === key) return { authURL: v.authURL, tokenURL: v.tokenURL };
  }
  if (domain) {
    for (const v of Object.values(ENDPOINTS)) {
      const host = v.authURL ? safeHost(v.authURL) : null;
      if (host && (host === domain || host.endsWith("." + domain))) return { authURL: v.authURL, tokenURL: v.tokenURL };
    }
  }
  return null;
}

export function safeHost(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
