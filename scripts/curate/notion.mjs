// Notion: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";

const g = load("notion");
const limits = source(g, "https://developers.notion.com/reference/request-limits", "Request limits");
const refresh = source(g, "https://developers.notion.com/reference/refresh-a-token", "Refresh a token");
const mcp = source(g, "https://developers.notion.com/guides/mcp/build-mcp-client", "Build an MCP client");
const enterprise = source(g, "https://www.notion.com/help/enterprise-connection-settings", "Enterprise connection settings");
const overview = source(g, "https://developers.notion.com/guides/get-started/overview", "Developer overview");
const auth = source(g, "https://developers.notion.com/guides/get-started/authorization", "Authorization");

g.summary = "Public connections work for any workspace without review; only a Marketplace listing is reviewed, and the installation scope can never be changed.";
const anyWs = path(g, "any_workspace_unlisted");
anyWs.customerAdmin = "sometimes";
const listing = path(g, "marketplace_listing");
listing.drivenBy = "Listing is optional; listed connections pass a Notion security review first, then listing review.";
listing.waitEvidence = Array.from(new Set([...listing.waitEvidence, overview]));

step(g, "s3").evidence = Array.from(new Set([...step(g, "s3").evidence, auth]));
g.customerAdminNote = "Notion Enterprise owners can limit members to approved connections only. Ask their workspace owner to approve your connection before rollout.";

g.gotchas = [
  ...g.gotchas.filter((x) => /permanent|No review is needed|Access is per user/.test(x.text)),
  { text: "The authorize URL begins with https://api.notion.com/v1/oauth/authorize; the token exchange uses HTTP Basic with your client ID and secret.", evidence: [auth], paths: null },
  { text: "Each refresh returns a new access token and a new refresh token. Store both.", evidence: [refresh], paths: null },
  { text: "Rate limits: 600 requests a minute per connection on Business and Enterprise, 180 on other plans, plus a per-workspace limit shared by all connections.", evidence: [limits], paths: null },
  { text: "Notion's MCP server registers clients itself (dynamic registration and client ID metadata documents), but an MCP token works only with Notion MCP, not the REST API that Composio's toolkit uses.", evidence: [mcp], paths: null },
  { text: "Enterprise workspaces can be set to approved connections only.", evidence: [enterprise], paths: ["any_workspace_unlisted", "marketplace_listing"] },
  ...g.gotchas.filter((x) => /expire within seconds/.test(x.text)),
];
// Read in full in the final review (2026-10-21): no AI clause; §2.1 and §3.1(i) limit data use.
const devTerms = source(g, "https://www.notion.com/notion/developer-terms-ba4131408d0844e08330da2cbb225c20", "Developer Terms (updated 2 Apr 2026)");
g.aiPolicy = {
  status: "restrictions",
  summary:
    "Notion's Developer Terms (2 Apr 2026) have no AI-specific clause, but data read through the API may be used only to provide your connection's features, for no other purpose, and never without the user's consent. Read literally, that rules out training models on workspace content.",
  evidence: [devTerms],
};
for (const p of g.paths) p.costNote = /listing/.test(p.id) ? "Notion publishes no listing fee." : "Notion publishes no fee.";
const createStep = step(g, "s2");
createStep.detail = createStep.detail.replace(/The notes do not give Notion's capability labels[^.]*\./, "Select only the content, comment and user-information capabilities your agent needs.");
g.unknowns = [
  "REST access-token lifetime: the token response documents no expiry.",
  "Whether creating a public connection needs the workspace owner role.",
];
save(g);
