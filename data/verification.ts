import { REPO_URL } from "@/lib/config";

// What we checked, corrected and could not verify. Shown on the Method page and in the README.
export type Check = {
  topic: string;
  kind: "corrected" | "confirmed" | "conflict" | "unverified" | "tested";
  finding: string;
  source: string;
};

export const CHECKS: Check[] = [
  {
    topic: "Agent drafts vs independent verification",
    kind: "corrected",
    finding:
      "Six agent-generated drafts (Microsoft 365, Slack, Salesforce, HubSpot, Notion, Strava) were re-checked claim by claim by separate verifier agents against live sources: 12 claims contradicted, about two dozen partly right, and 20 critical omissions. The agent rarely invented facts; its misses were 2025–26 policy changes and AI-use terms. Corrections are applied in scripts/curate/ and the guides are marked verified.",
    source: `${REPO_URL}/tree/main/scripts/curate`,
  },
  {
    topic: "Microsoft default consent lockdown",
    kind: "corrected",
    finding:
      "The draft missed that Microsoft's default consent policy (rolled out Jul 2025 – Jul 2026) blocks user consent to mail, calendar, files and contacts-write permissions. Each customer's admin must consent, even for a publisher-verified app.",
    source: "https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies",
  },
  {
    topic: "Slack unlisted-app rate limits",
    kind: "corrected",
    finding:
      "The draft missed that unlisted commercial apps created since 29 May 2025 get 1 request per minute and 15 objects on message history, and claimed app creation can't be automated (it can, via apps.manifest.create).",
    source: "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps",
  },
  {
    topic: "HubSpot AI connectors",
    kind: "corrected",
    finding:
      "The draft said HubSpot had no AI rules. Marketplace apps where AI chooses CRM actions must enforce user-level permissions; standard OAuth tokens are not sufficient. It also missed the v1 token endpoint deprecation (works until 16 Feb 2027).",
    source: "https://developers.hubspot.com/docs/apps/developer-platform/list-apps/listing-your-app/marketplace-restrictions",
  },
  {
    topic: "Salesforce security review fee",
    kind: "corrected",
    finding: "The draft quoted $2,700 from a legacy page. Current Trailhead guidance: $999 per attempt for paid solutions, waived for free ones, typically 4–5 weeks.",
    source: "https://trailhead.salesforce.com/content/learn/modules/isv_security_review/isv_security_review_submit",
  },
  {
    topic: "Salesforce rules for AI agents",
    kind: "corrected",
    finding:
      "The first verification said Salesforce had no AI-specific API rule. A final review found its Agent Integration Protocols (30 Jun 2026), part of the API terms: agents must call through an app the developer created for commercial use, must not mask their identity, must minimise data, and should prefer Salesforce's MCP and Agentforce APIs.",
    source: "https://developer.salesforce.com/salesforce-agent-integration-protocols",
  },
  {
    topic: "Notion Developer Terms",
    kind: "confirmed",
    finding:
      "The page renders only with JavaScript, so the research agents could not read it; it was read in full from Notion's page data instead. No AI clause, but API data may be used only to provide the integration's features, with the user's consent.",
    source: "https://www.notion.com/notion/developer-terms-ba4131408d0844e08330da2cbb225c20",
  },
  {
    topic: "Strava bans intermediaries",
    kind: "confirmed",
    finding:
      "Strava's June 2026 API Policy bans integration platforms and aggregators that re-expose its API and any use with AI applications, and says routing data through third-party intermediaries is no longer supported. An agent integration through Composio is very likely out of policy.",
    source: "https://www.strava.com/legal/api_policy",
  },
  {
    topic: "Slack setup attempt",
    kind: "tested",
    finding:
      "An agent created the Slack app from a manifest by API in 0.6 s (redirect URLs and scopes included, no console step) and a custom Composio auth config with its client ID and secret in 1.1 s. Two corrections came out of it: Composio's Slack toolkit uses user-token scopes, not bot scopes, and its connect links expire after 10 minutes. The end-user approval is the one human step.",
    source: `${REPO_URL}/blob/main/data/tests/slack-setup.json`,
  },
  {
    topic: "Resend setup attempt",
    kind: "tested",
    finding:
      "An agent registered a confidential OAuth client through Resend's public registration endpoint (HTTP 201 in 0.76 s, no human step), and the authorize endpoint accepted it with Composio's callback (302 to the consent page; an unknown client gets 401).",
    source: "https://resend.com/docs/guides/building-a-resend-oauth-client",
  },
  {
    topic: "Resend supports OAuth",
    kind: "corrected",
    finding:
      "We assumed Resend was API-key only. The research agent found OAuth 2.1 with PKCE and dynamic client registration, announced 13 Jul 2026; the setup attempt confirmed it. Resend still recommends pre-registering remote clients, which the guide now says.",
    source: "https://resend.com/changelog/oauth-support",
  },
  {
    topic: "Google security assessment price",
    kind: "corrected",
    finding: "Our first plan said lab prices were unpublished. Labs publish them: from about $540 a year for a Tier 2 assessment to $3,000–6,000 at other labs.",
    source: "https://tacsecurity.com/?p=18721",
  },
  {
    topic: "Google sensitive-scope review time",
    kind: "conflict",
    finding: "Google's FAQ says about 10 business days; its sensitive-scope page says 3–5. The guide shows both instead of picking one.",
    source: "https://support.google.com/cloud/answer/13463817",
  },
  {
    topic: "Google 100-user cap",
    kind: "conflict",
    finding: "Google's FAQ calls the unverified-app cap permanent for the project's lifetime; the unverified-apps page says quotas might be adjusted. The guide flags the conflict and plans for the stricter reading.",
    source: "https://support.google.com/cloud/answer/7454865",
  },
  {
    topic: "Google verifies redirect domains",
    kind: "confirmed",
    finding:
      "Verification covers every domain in your redirect URIs, and third-party domains need a justification. With Composio's default callback that domain is composio.dev, so the guide adds a step to route the redirect through your own domain using Composio's documented 302 proxy.",
    source: "https://support.google.com/cloud/answer/13804266",
  },
  {
    topic: "Composio callback URL",
    kind: "conflict",
    finding:
      "Composio's docs name …/api/v3/toolkits/auth/callback, while every OAuth2 toolkit's auth config defaults to …/api/v1/auth-apps/add. The docs (re-read 21 Oct 2026) say the v1 URL remains supported and that both places must match exactly, so guides tell you to copy the value from your auth config.",
    source: "https://docs.composio.dev/docs/white-labeling-authentication",
  },
  {
    topic: "Procore customer path",
    kind: "unverified",
    finding:
      "Two runs disagreed: the first sent B2B customers through Procore's partner marketplace; the second, after the rubric wording was sharpened, routes them through a company-admin install. Not independently verified, so the guide stays labelled agent-generated.",
    source: "https://developers.procore.com/",
  },
  {
    topic: "Run-to-run stability",
    kind: "conflict",
    finding:
      "Regenerating an app usually reproduces the same facts, but the level can shift where a provider's docs are ambiguous: Clio moved from Heavy to Self-serve, and Reddit and Close only classified consistently after the review definitions were made sharper. That is why generated guides carry a label and verified guides are pinned.",
    source: `${REPO_URL}/blob/main/lib/agent/write.ts`,
  },
  {
    topic: "Strava in Composio",
    kind: "conflict",
    finding: "Composio's open toolkit catalog has no Strava entry, while composio.dev still lists a Strava toolkit. The guide shows the toolkit as bring-your-own and flags the conflict.",
    source: "https://composio.dev/toolkits/strava",
  },
];
