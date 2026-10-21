// Slack: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";
import { readFileSync } from "node:fs";

const g = load("slack");
const rate = source(g, "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps", "Rate limit changes for non-Marketplace apps");
const installs = source(g, "https://docs.slack.dev/changelog/2026/09/01/slack-marketplace-install-requirement/", "Marketplace install requirement (changelog)");
const dist = source(g, "https://docs.slack.dev/distribution/", "Distributing your app");
const terms = source(g, "https://slack.com/terms-of-service/api", "Slack API Terms of Service (10 Oct 2025)");
const manifest = source(g, "https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests/", "Configuring apps with app manifests");
const oauth = source(g, "https://docs.slack.dev/authentication/installing-with-oauth/", "Installing with OAuth");
const approval = source(g, "https://slack.com/help/articles/222386767-Manage-app-approval-for-your-workspace", "Manage app approval for your workspace");
const pkce = source(g, "https://docs.slack.dev/changelog/2026/03/30/pkce", "PKCE (changelog)");
const mcp = source(g, "https://docs.slack.dev/ai/slack-mcp-server/", "Slack MCP server");
const rotation = source(g, "https://docs.slack.dev/authentication/using-token-rotation/", "Using token rotation");
const review = source(g, "https://docs.slack.dev/slack-marketplace/slack-marketplace-review-guide/", "Slack Marketplace review guide");
const redirect = g.composio.defaultRedirect ?? "https://backend.composio.dev/api/v1/auth-apps/add";

g.summary = "Creating and distributing a Slack app is self-serve, but commercial apps need a Marketplace listing (at least 10 active installs, then up to ~11 weeks of review), and unlisted apps are rate-limited on message history.";
g.capabilities = [
  { id: "send_messages", label: "Send messages", scopes: [{ name: "chat:write", tier: "basic", label: "Standard" }], alternative: null },
  { id: "read_history", label: "Read channel history", scopes: [{ name: "channels:history", tier: "restricted", label: "Rate-limited when unlisted" }], alternative: "Use the Events API to receive new messages instead of polling history." },
  { id: "search_messages", label: "Search messages", scopes: [{ name: "search:read", tier: "sensitive", label: "Often rejected in review" }], alternative: null },
];
g.defaultCapabilities = ["send_messages", "read_history"];

const ownWs = path(g, "own_workspace");
ownWs.tiers = ["basic", "sensitive", "restricted"];
const unlisted = path(g, "unlisted_distribution");
Object.assign(unlisted, {
  label: "Customers' workspaces, unlisted",
  tiers: ["basic", "sensitive"],
  review: "light",
  drivenBy: "Activate Public Distribution is self-serve, but Slack's API Terms require a Marketplace listing or a separate agreement to distribute commercially.",
  effort: "~1 day",
  customerAdmin: "sometimes",
  next: "Activate public distribution for pilots, and plan the Marketplace listing for commercial launch.",
  untilApproved: [{ text: "Commercial distribution outside the Marketplace needs a separate agreement with Slack.", evidence: [terms] }],
  lanes: { you: ["~2 hours", "~1 day", "", "~30 min"], provider: ["", "", "", ""] },
});
const market = path(g, "marketplace");
Object.assign(market, {
  audiences: ["customers", "public"],
  tiers: ["basic", "sensitive", "restricted"],
  waitOfficial: "Up to 10 business days, then up to 10 weeks of functional review",
  waitReported: "2 weeks to 4 months",
  waitEvidence: [review],
  customerAdmin: "sometimes",
  next: "Get 10 active workspace installs on unlisted distribution, then submit; read-heavy features stay rate-limited until you are listed.",
  untilApproved: [
    { text: "Unlisted commercially distributed apps created since 29 May 2025: 1 request per minute and 15 objects per call on conversations.history and conversations.replies.", evidence: [rate] },
    { text: "Submission needs at least 10 active workspace installs (used in the last 28 days), held throughout review.", evidence: [installs] },
  ],
  lanes: { you: ["~2 hours", "1–2 weeks", "fix feedback", "~30 min"], provider: ["", "", "≤10 BD + ≤10 wk", ""] },
});
g.paths = [ownWs, unlisted, market];

g.steps = g.steps.filter((s) => s.id !== "s1");
const create = step(g, "s2");
create.owner = "agent_drafts";
create.title = "Create the Slack app from a manifest";
create.detail = "Generate an app configuration token at api.slack.com/apps (it expires after 12 hours); the agent then creates the app with apps.manifest.create. The Slack CLI works too.";
create.values = [{ label: "Manifest (YAML)", text: `display_information:\n  name: Your agent\noauth_config:\n  redirect_urls:\n    - ${redirect}\n  scopes:\n    bot:\n      - chat:write\nsettings:\n  token_rotation_enabled: false` }];
create.evidence = [manifest];
const ru = step(g, "s3");
ru.detail = "The redirect_uri must match, or sit under, a Redirect URL in your settings. HTTPS only, no '#'. Authorization codes expire after 10 minutes.";
ru.values = [{ label: "Redirect URL", text: redirect }];
ru.evidence = [oauth];
step(g, "s4").detail = "Request only what your features use. search:read, identity.* and admin.* are common reasons for rejection.";
g.steps.splice(g.steps.findIndex((s) => s.id === "s7"), 0, {
  id: "distribute",
  phase: "week",
  title: "Activate public distribution",
  owner: "you",
  time: "15 min",
  detail: "Manage Distribution → complete the checklist (HTTPS redirect URLs) → Activate Public Distribution. Deactivating later removes the app from other workspaces.",
  values: [],
  evidence: [dist],
  paths: ["unlisted_distribution", "marketplace"],
});
const reach = step(g, "s8");
reach.title = "Reach 10 active workspace installs";
reach.detail = "Workspaces that used the app in the last 28 days count; sandboxes don't. Keep at least 10 active while the review runs.";
reach.evidence = [installs];

g.customerAdminNote = "Workspace owners can require approval before members install apps, and Enterprise Grid orgs require it by default. Ask their admin to approve your app.";
g.gotchas = [
  { text: "Unlisted commercially distributed apps get 1 request per minute and 15 objects on conversations.history and conversations.replies. Internal and Marketplace apps are exempt; existing installs are not affected.", evidence: [rate], paths: null },
  { text: "Slack's API Terms (10 Oct 2025) allow commercial distribution only through the Marketplace or a separate agreement, and ban training large language models on API data.", evidence: [terms], paths: null },
  { text: "PKCE is opt-in and permanently turns the app into a public client (30-day refresh tokens, no bot scopes for desktop redirects). Don't enable it for Composio's confidential flow.", evidence: [pkce], paths: null },
  { text: "Token rotation can't be turned off once on: access tokens then expire every 12 hours and each refresh token works once.", evidence: [rotation], paths: null },
  { text: "Slack's MCP server has no dynamic registration, and unlisted apps are not allowed to use it.", evidence: [mcp], paths: null },
  { text: "Workspace owners can require approval before members install apps.", evidence: [approval], paths: ["unlisted_distribution", "marketplace"] },
  ...g.gotchas.filter((x) => /persistent copies|Bulk export|Free workspaces limit|Slack may audit/.test(x.text)),
];
g.unknowns = ["Whether Composio's managed Slack app is rate-limited as an unlisted app while its Marketplace review is pending.", "Whether the Slack Marketplace Agreement includes fees or a revenue share."];
const domainStep = step(g, "s7");
domainStep.detail = domainStep.detail.replace(/The notes do not say whether customer workspace admins must approve the app\./, "Workspace owners can require approval before members install apps.");
// Setup test (scripts/dev/slack-setup-test.mjs, record in data/tests/slack-setup.json).
const test = JSON.parse(readFileSync("data/tests/slack-setup.json", "utf8"));
const ran = (name) => test.steps.findLast((x) => x.name === name);
const secs = (name) => (ran(name).ms / 1000).toFixed(1);
const created = source(g, "https://docs.slack.dev/reference/methods/apps.manifest.create", `Created the app by API from a manifest in ${secs("slack apps.manifest.create")} s, with redirect URLs and user scopes set`, "tested", "2026-10-21");
const configured = source(g, "https://docs.composio.dev/reference/api-reference/auth-configs/postAuthConfigs", `Created a custom Composio auth config with the app's client ID and secret by API in ${secs("composio create auth config")} s`, "tested", "2026-10-21");
const linkTest = source(g, "https://docs.composio.dev/reference/api-reference/connected-accounts/postConnectedAccountsLink", "Connect link expired 10 minutes after it was created when nobody opened it", "tested", "2026-10-21");
const toolkit = source(g, "https://backend.composio.dev/api/v3.1/toolkits/slack", "Composio Slack toolkit auth fields: OAuth2 with user scopes (48 by default), default redirect …/api/v1/auth-apps/add", "probed", "2026-10-21");
const connected = ran("composio connected account")?.result.startsWith("ACTIVE") ? ran("composio connected account") : null;
const called = ran("composio execute SLACK_LIST_ALL_CHANNELS");
const live = connected && called?.result.startsWith("ok")
  ? source(g, "https://docs.composio.dev/reference/api-reference/tools/postToolsExecuteByToolSlug", `Approved once in Slack; the connection went active and read-only tool calls succeeded (${called.ms} ms)`, "tested", "2026-10-21")
  : null;
const add = (s, ...ids) => (s.evidence = Array.from(new Set([...s.evidence, ...ids])));

const appStep = step(g, "s2");
appStep.owner = "agent";
appStep.detail = `Generate an app configuration token at api.slack.com/apps (it expires after 12 hours); the agent then creates the app with apps.manifest.create, with the redirect URLs and scopes in the manifest. Tested: created in ${secs("slack apps.manifest.create")} s with no console step.`;
add(appStep, created);
const redirectStep = step(g, "s3");
redirectStep.owner = "agent";
redirectStep.detail = `Put Composio's callback in the manifest's redirect_urls. It must match the auth config's redirect URI exactly; Composio's Slack default is …/api/v1/auth-apps/add. ${redirectStep.detail}`;
add(redirectStep, created, toolkit);
const scopeStep = step(g, "s4");
scopeStep.title = "Add only the user scopes your features need";
scopeStep.owner = "agent_drafts";
scopeStep.detail = "Composio's Slack toolkit connects with user-token scopes (its auth config lists 48 by default), so put yours under user scopes in the manifest and keep the list to what your agent uses. search:read, identity.* and admin.* are common reasons for rejection.";
add(scopeStep, toolkit);
const authStep = step(g, "s5");
authStep.detail = `${authStep.detail} Tested: created through Composio's API in ${secs("composio create auth config")} s.`;
add(authStep, configured);
const installStep = step(g, "s6");
installStep.detail = `${installStep.detail} Composio's connect link expires about 10 minutes after it is created, so create it when the person is ready to approve.${live ? " Tested: one approval in Slack, then the connection was active and read-only tool calls worked." : ""}`;
add(installStep, linkTest, ...(live ? [live] : []));
g.gotchas.unshift({ text: "Composio's Slack toolkit requests user-token scopes (48 by default), so scopes belong under user scopes in your app. Trim the default list to what your agent uses.", evidence: [toolkit], paths: null });

path(g, "own_workspace").costNote = "Slack publishes no fee.";
path(g, "unlisted_distribution").costNote = "Slack publishes no fee; commercial distribution requires a separate agreement with Slack.";
path(g, "marketplace").costNote = "Slack publishes no submission or listing fee.";
save(g);
