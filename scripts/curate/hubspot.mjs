// HubSpot: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";

const g = load("hubspot");
const caps = source(g, "https://developers.hubspot.com/changelog/new-marketplace-distribution-app-install-limits", "Marketplace-distribution install limits (changelog)");
const userLevel = source(g, "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/authentication/user-level-apps", "User-level apps");
const listing = source(g, "https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/app-marketplace-listing-requirements", "App Marketplace listing requirements");
const v1 = source(g, "https://developers.hubspot.com/changelog/v1-oauth-api-deprecation", "v1 OAuth API deprecation (changelog)");
const aiRules = source(g, "https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/marketplace-restrictions", "Marketplace restrictions");
const sunset = source(g, "https://developers.hubspot.com/changelog/legacy-public-app-creation-sunset", "Legacy public app creation sunset (changelog)");
const may26 = source(g, "https://developers.hubspot.com/changelog/app-listing-and-app-certification-requirement-updates-for-may-2026", "Listing and certification updates, May 2026");
const usage = source(g, "https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines", "API usage guidelines");
const tokens = source(g, "https://developers.hubspot.com/blog/oauth-token-management-hubspot-integrations", "OAuth token management (HubSpot blog)");
const create = source(g, "https://developers.hubspot.com/docs/apps/developer-platform/build-apps/create-an-app", "Create an app");

g.summary = "Apps are built with the HubSpot CLI; unlisted apps reach up to 25 installs, and listing an AI connector requires user-level permissions.";

const pub = path(g, "public_marketplace");
pub.waitOfficial = "Initial review within 10 business days; up to 60 days after feedback";
pub.waitEvidence = [listing];
const unlisted = path(g, "customers_unlisted");
unlisted.untilApproved = [
  { text: "Marketplace-distribution apps stop at 25 installs until listed.", evidence: [caps] },
  { text: "Private OAuth distribution: up to 10 customers for app partners, 100 for Solutions Partners.", evidence: [caps] },
];

const c = step(g, "create-app");
c.title = "Create the app with the HubSpot CLI";
c.owner = "agent_drafts";
c.detail = "Run hs project create; set distribution, auth, scopes and redirectUrls (with the Composio redirect URI) in src/app/app-hsmeta.json, then hs project upload. You create the personal access key; an agent can run the rest. Legacy public apps can no longer be created.";
c.values = [{ label: "Redirect URI to list in redirectUrls", text: g.composio.defaultRedirect ?? "https://backend.composio.dev/api/v1/auth-apps/add" }];
c.evidence = [create, sunset];

const inst = step(g, "customer-install");
inst.title = "Have customers install the app";
inst.detail = "Account-level apps must be installed by a Super Admin in each customer account. User-level apps (isUserLevel) can be installed by each user who has the scopes.";
inst.evidence = [userLevel];

g.aiPolicy = {
  status: "restrictions",
  summary: "To list an app where AI chooses CRM actions, HubSpot requires user-level permissions: standard OAuth tokens are not sufficient. Build it as a user-level app or with HubSpot's MCP auth app; unlisted distribution stays within the install caps.",
  evidence: [aiRules, userLevel],
};

g.gotchas = [
  { text: "Listing an AI agent that picks CRM actions needs a user-level app; account-level apps cannot be migrated to user-level, so plan this before you build.", evidence: [aiRules, userLevel], paths: null },
  { text: "The v1 OAuth endpoints are deprecated and work until 16 Feb 2027. Use POST /oauth/2026-03/token; new listings must already use it.", evidence: [v1, may26], paths: null },
  { text: "From 2 Nov 2026, new listings must be on developer platform 2025.2 or 2026.03.", evidence: [may26], paths: ["public_marketplace"] },
  { text: "Access tokens last 30 minutes. Refresh tokens do not expire for now, and a refresh can return a new one: always store the latest.", evidence: [tokens], paths: null },
  { text: "Test, developer, sandbox and team-created accounts do not count toward the 3 active installs needed to list.", evidence: [listing], paths: ["public_marketplace"] },
  { text: "Rate limit: 110 requests per 10 seconds for each account that installs your app.", evidence: [usage], paths: null },
  ...g.gotchas.filter((x) => /MCP server accepts pre-registered|Conditional scopes/.test(x.text)),
];
g.unknowns = g.unknowns.filter((u) => !/refresh token|token lifetime/i.test(u));
for (const p of g.paths) if (/notes|found/i.test(p.costNote)) p.costNote = "HubSpot's docs list no fee for building or listing an app.";
const scopesStep = g.steps.find((s) => /scope/i.test(s.title));
if (scopesStep) scopesStep.detail = scopesStep.detail.replace(/The notes do not list scope names for deals, companies or tickets, so look them up in HubSpot's scope list\./, "Look up scope names for deals, companies and tickets in HubSpot's scope list.");
save(g);
