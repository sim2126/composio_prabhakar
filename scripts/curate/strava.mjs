// Strava: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";

const g = load("strava");
const policy = source(g, "https://www.strava.com/legal/api_policy", "Strava API Policy (effective 1 Jun 2026)");
const post = source(g, "https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428", "An update to our developer program (Strava, 1 Jun 2026)");
const faq = source(g, "https://communityhub.strava.com/developers-knowledge-base-14/strava-api-faq-12906", "Strava API FAQ (updated 4 Jun 2026)");
const limits = source(g, "https://developers.strava.com/docs/rate-limits/", "Rate limits");
const composio = source(g, "https://composio.dev/toolkits/strava", "Composio Strava toolkit page");

g.summary = "Strava's June 2026 API Policy bans using its data with AI applications and bans intermediaries that re-expose its API, which likely rules out an agent integration through Composio.";
g.composio = { toolkits: [{ slug: "strava", name: "Strava", managed: false }], defaultRedirect: "https://backend.composio.dev/api/v1/auth-apps/add" };
g.aiPolicy = {
  status: "prohibited",
  summary: "Policy 5.3 bans use with any AI application; 5.5 bans vector or search indexes; 5.10 bans transfers to AI or model providers even with user consent; 5.16 bans integration platforms, aggregators and agent interfaces that re-expose the API. The Strava MCP is the only authorised agent interface.",
  evidence: [policy, faq],
};
for (const p of g.paths) {
  p.cost = "Strava subscription";
  p.costNote = "A Strava subscription is required to create and keep an app; there is no separate API fee.";
  p.costEvidence = [faq, post];
}
const std = path(g, "standard_review");
std.waitOfficial = "No committed timeline (policy 3.6)";
std.waitReported = "7–10 business days (staff reply, May 2025)";
std.waitEvidence = [policy];

const first = step(g, "s1");
first.title = "Check the API Policy before you build";
first.detail = "Strava's policy bans AI applications (5.3) and intermediaries that re-expose its API (5.16). Routing Strava data through an integration platform such as Composio is no longer supported, so most agent use cases stop here.";
first.evidence = [policy, post];

g.gotchas = [
  { text: "Apps that route Strava data through third-party intermediary platforms are no longer supported.", evidence: [post, policy], paths: null },
  { text: "Apps that expose athlete data to third-party AI tools will not be approved.", evidence: [faq], paths: null },
  { text: "New apps start with 1 athlete; you can self-upgrade to 10, which replaced the old review queue. Above 10 needs review.", evidence: [limits, post], paths: null },
  { text: "Existing developers needed a subscription from 30 Jun 2026; active developers without one got three months free.", evidence: [post], paths: null },
  { text: "Default limits: 200 requests per 15 minutes and 2,000 a day. The self-upgrade raises the overall limit to 400 and 4,000, but reads stay at 200 and 2,000.", evidence: [limits], paths: null },
  { text: "Cache Strava data for at most 7 days, honour deletions within 48 hours, and delete data within 30 days when access ends.", evidence: [policy], paths: null },
  { text: "From 1 Jun 2027 the API moves to https://www.api-v3.strava.com, tokens must be sent in headers, and oauth/deauthorize is replaced by oauth/revoke.", evidence: [post], paths: null },
  { text: "Each refresh returns a new refresh token and invalidates the old one.", evidence: g.gotchas.find((x) => /refresh/i.test(x.text))?.evidence ?? [], paths: null },
];
g.unknowns = [
  "Policy 6.1 and 2.3 appear to conflict on showing one athlete's data to other users; ask Strava before doing it.",
  "Subscription price varies by country.",
  "Composio's open toolkit catalog has no Strava entry, while composio.dev still lists a Strava toolkit.",
];
void composio;
for (const p of g.prereqs) p.why = p.why.replace(/The price is not published in the notes\./, "The price varies by country.");
const createApp = step(g, "s2");
createApp.values = createApp.values.map((v) => (/notes/.test(v.text) ? { label: "Authorization Callback Domain", text: "backend.composio.dev" } : v));
const reviewStep = step(g, "s9");
reviewStep.detail = reviewStep.detail.replace(/\s*The review form contents are not in the notes\./, "");
save(g);
