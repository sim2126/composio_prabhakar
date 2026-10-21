import type { Probe } from "@/lib/guide";
import { safeFetch } from "@/lib/security";
import { safeHost } from "./context";

const PROBE_REDIRECT = "https://backend.composio.dev/api/v1/auth-apps/add";

function allowed(host: string | null, vendorDomain: string, trusted: Set<string>): host is string {
  if (!host) return false;
  return trusted.has(host) || (vendorDomain !== "" && (host === vendorDomain || host.endsWith("." + vendorDomain)));
}

function summarizeError(body: string): string {
  try {
    const j = JSON.parse(body);
    const code = j.error?.code ?? j.error ?? j.code ?? j.status;
    const desc = j.error_description ?? j.message ?? j.error?.message;
    return [typeof code === "string" || typeof code === "number" ? String(code) : null, typeof desc === "string" ? desc.slice(0, 90) : null].filter(Boolean).join(": ");
  } catch {
    return body.replace(/\s+/g, " ").slice(0, 60);
  }
}

// Read-only checks that the provider's OAuth endpoints exist and how they answer an
// unknown client. Only hosts on the vendor's domain (or from the seed catalog) are contacted.
export async function probeProvider(
  vendorDomain: string,
  known: { authURL: string | null; tokenURL: string | null } | null,
  emit: (text: string) => void,
): Promise<Probe[]> {
  const probes: Probe[] = [];
  const at = new Date().toISOString();
  const trusted = new Set([known?.authURL, known?.tokenURL].map((u) => (u ? safeHost(u) : null)).filter((h): h is string => Boolean(h)));
  let tokenURL = known?.tokenURL && !known.tokenURL.includes("{{") ? known.tokenURL : null;
  const authHost = known?.authURL && !known.authURL.includes("{{") ? safeHost(known.authURL) : null;

  // 1. OpenID / OAuth discovery documents.
  for (const host of Array.from(new Set([authHost, vendorDomain ? `auth.${vendorDomain}` : null, vendorDomain || null]))) {
    if (!allowed(host, vendorDomain, trusted)) continue;
    for (const path of ["/.well-known/openid-configuration", "/.well-known/oauth-authorization-server"]) {
      try {
        const r = await safeFetch(`https://${host}${path}`);
        if (r.status !== 200 || !r.contentType.includes("json")) continue;
        const j = JSON.parse(r.body);
        const pkce = Array.isArray(j.code_challenge_methods_supported) ? j.code_challenge_methods_supported.join("/") : "not listed";
        probes.push({ target: `${host}${path}`, request: "GET discovery document", result: `200: token endpoint ${j.token_endpoint ?? "missing"}, PKCE ${pkce}${j.registration_endpoint ? ", dynamic client registration offered" : ""}`, at });
        emit(`Discovery document found on ${host}`);
        if (!tokenURL && typeof j.token_endpoint === "string" && allowed(safeHost(j.token_endpoint), vendorDomain, trusted)) tokenURL = j.token_endpoint;
        break;
      } catch {
        /* not reachable: try the next one */
      }
    }
  }

  // 2. Token endpoint with an unknown client: proves the endpoint is live and shows its error format.
  if (tokenURL && allowed(safeHost(tokenURL), vendorDomain, trusted)) {
    try {
      const r = await safeFetch(tokenURL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
        body: new URLSearchParams({ grant_type: "authorization_code", code: "preflight-probe", redirect_uri: PROBE_REDIRECT, client_id: "preflight-probe", client_secret: "preflight-probe" }).toString(),
      });
      const result = `${r.status}${r.body ? `: ${summarizeError(r.body)}` : ""}`;
      probes.push({ target: safeHost(tokenURL) + new URL(tokenURL).pathname, request: "POST token request with an unknown client", result, at });
      emit(`Token endpoint answered ${result.slice(0, 80)}`);
    } catch (e) {
      probes.push({ target: tokenURL, request: "POST token request with an unknown client", result: `no answer (${e instanceof Error ? e.message : "error"})`, at });
    }
  }

  // 3. Official MCP server metadata: whether agents can register a client without a portal app.
  if (vendorDomain) {
    const host = `mcp.${vendorDomain}`;
    try {
      const r = await safeFetch(`https://${host}/.well-known/oauth-authorization-server`);
      if (r.status === 200 && r.contentType.includes("json")) {
        const j = JSON.parse(r.body);
        const reg = j.registration_endpoint ? "dynamic client registration" : null;
        const cimd = j.client_id_metadata_document_supported ? "client ID metadata documents" : null;
        probes.push({ target: `${host}/.well-known/oauth-authorization-server`, request: "GET MCP server auth metadata", result: `200: ${[reg, cimd].filter(Boolean).join(" and ") || "pre-registered clients only"}`, at });
        emit(`Official MCP server found at ${host}`);
      }
    } catch {
      /* no MCP server: nothing to record */
    }
  }
  return probes;
}
