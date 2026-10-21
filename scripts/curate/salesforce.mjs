// Salesforce: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";

const g = load("salesforce");
const eca = source(g, "https://help.salesforce.com/s/articleView?id=xcloud.external_client_apps.htm&language=en_US&type=5", "External Client Apps");
const editions = source(g, "https://developer.salesforce.com/docs/platform/api-rest/guide/intro-rest-compatible-editions.html", "Supported editions for the REST API");
const controls = source(g, "https://help.salesforce.com/s/articleView?id=005387798&language=en_US&type=1", "Security controls for partner apps");
const uninstalled = source(g, "https://help.salesforce.com/s/articleView?id=005132365&language=en_US&type=1", "Uninstalled connected app restrictions");
const sr = source(g, "https://trailhead.salesforce.com/content/learn/modules/isv_security_review/isv_security_review_submit", "Submit for security review (Trailhead)");
const restricted = source(g, "https://help.salesforce.com/s/articleView?id=005228017&language=en_US&type=1", "Connected app creation restrictions");
const refresh = source(g, "https://help.salesforce.com/s/articleView?id=xcloud.connected_app_manage_oauth.htm&language=en_US&type=5", "Manage OAuth access policies");
const composioKb = source(g, "https://docs.composio.dev/kb/guide/toolkits-salesforce", "Composio: Salesforce toolkit notes");

g.summary = "New integrations use an External Client App; reaching other companies means packaging it so each customer's admin installs it, and an AppExchange listing adds a paid security review.";
const pkg = path(g, "packaged_unlisted");
Object.assign(pkg, {
  review: "light",
  drivenBy: "Each customer's admin must install your packaged External Client App before their users can connect. Whether an unreviewed package installs cleanly in production orgs is unconfirmed.",
  customerAdmin: "always",
  cost: "$0",
  costNote: "No fee for packaging; customers need an edition with API access.",
  next: "Package the External Client App and plan an admin install step in each customer's onboarding.",
  untilApproved: [{ text: "Users can't authorize an app that isn't installed in their org unless they hold 'Approve Uninstalled Connected Apps'.", evidence: [uninstalled] }],
});
const ax = path(g, "appexchange");
Object.assign(ax, {
  waitOfficial: "Typically 4–5 weeks",
  waitEvidence: [sr],
  cost: "$999 per attempt",
  costNote: "For paid solutions, charged on submission and on every resubmission; waived for free solutions. Reviewed again every year.",
  costEvidence: [sr],
});

const c = step(g, "s1");
c.detail = "Setup → App Manager → New External Client App. New connected apps can no longer be created (except by installing a package); existing ones keep working.";
c.evidence = [eca, restricted];
step(g, "s6").detail = "Add the External Client App to a managed package (second-generation packaging is recommended). Subscriber admins can set policies but can't edit your app's settings.";
const ctl = step(g, "s7");
ctl.detail = "Apps used by more than two customer production orgs must use PKCE, refresh-token rotation, a 30-day idle timeout and an IP allowlist. The 11 May 2026 deadline has passed; non-compliant integrations may be suspended.";
ctl.evidence = [controls];
const inst = step(g, "s9");
inst.detail = "Since September 2025, users can't authorize a connected app that isn't installed in their org unless they hold 'Approve Uninstalled Connected Apps'. The customer's admin installs your package and grants access.";
inst.evidence = [uninstalled];
step(g, "s11").evidence = [sr];

g.prereqs = [
  ...g.prereqs,
  { text: "Customers on an edition with API access", why: "Enterprise, Performance, Unlimited and Developer include it; Professional needs a paid add-on. Users also need the API Enabled permission.", owner: "customer_admin", paths: null },
];
g.customerAdminNote = "Each customer's Salesforce admin must install your package (or approve your app) before users can connect, and users need the API Enabled permission.";
g.gotchas = [
  ...g.gotchas.filter((x) => /cannot be created through the UI|only in its own org|does not return a refresh token|reusing a rotated-out|Review Controls/.test(x.text)),
  { text: "Refresh tokens are valid until revoked by default; each customer's admin can change that policy.", evidence: [refresh], paths: null },
  { text: "Salesforce keeps five refresh tokens per user per app; a sixth approval revokes the oldest, breaking that user's older connection.", evidence: [composioKb], paths: null },
  { text: "Apps used by more than two customer production orgs must meet partner security controls (PKCE, rotation, idle timeout, IP allowlist) or risk suspension.", evidence: [controls], paths: null },
  { text: "Professional Edition orgs have no API access without a paid add-on.", evidence: [editions], paths: null },
];
g.unknowns = ["Whether a packaged External Client App that hasn't passed security review installs cleanly in customers' production orgs."];
pkg.drivenBy = "Each customer's admin must install your packaged External Client App before their users can connect. Salesforce doesn't say whether a package that hasn't passed security review installs cleanly in production orgs, so pilot with one customer first.";
g.prereqs = g.prereqs.map((p, i) => {
  if (/Get admin access to a Salesforce org/.test(p.text)) return { ...p, text: "Admin access to a Salesforce org where you can open Setup > App Manager and create an External Client App. A free Developer Edition org works for building." };
  if (/Partner Program/.test(p.text)) return { ...p, text: "Enroll in the Salesforce Partner Program (ISV) and budget for the security review: $999 per attempt for paid solutions, waived for free ones." };
  return p;
});
// Found in the final review (2026-10-21): Salesforce's protocols for AI agents, part of the API terms.
const agents = source(g, "https://developer.salesforce.com/salesforce-agent-integration-protocols", "Salesforce Agent Integration Protocols (30 Jun 2026)");
const aup = source(g, "https://www.salesforce.com/en-us/wp-content/uploads/sites/4/documents/legal/Agreements/policies/ai-acceptable-use-policy.pdf", "Artificial Intelligence Acceptable Use Policy");
g.aiPolicy = {
  status: "restrictions",
  summary:
    "Salesforce's Agent Integration Protocols (30 Jun 2026) bind every AI agent that calls its APIs: connect commercial use through a Connected App or External Client App you created, never mask which app or agent is calling, keep data access and retention to the minimum, prefer Salesforce's MCP and Agentforce APIs where they exist, and follow its AI Acceptable Use Policy.",
  evidence: [agents, aup],
};
g.gotchas.unshift({
  text: "Salesforce's agent protocols expect commercial agents to call its APIs through an app you created and forbid masking the calling app or chaining agents to hide the originating one. Plan to move off any shared app before launch.",
  evidence: [agents],
  paths: null,
});
path(g, "own_org").costNote = "No fee to create an External Client App.";
save(g);
