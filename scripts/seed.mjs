// Builds the trimmed seed data in /data from two MIT-licensed sources:
//   - Composio toolkit catalog (ComposioHQ/composio, docs/public/data/toolkits.json)
//   - Ampersand connector catalog (amp-labs/connectors, internal/generated/catalog.json)
// Usage: node scripts/seed.mjs [path/to/toolkits.json] [path/to/catalog.json]
// Without paths, both files are downloaded from GitHub.
import { readFile, writeFile, mkdir } from "node:fs/promises";

const SOURCES = {
  composio: "https://raw.githubusercontent.com/ComposioHQ/composio/next/docs/public/data/toolkits.json",
  ampersand: "https://raw.githubusercontent.com/amp-labs/connectors/main/internal/generated/catalog.json",
};

// The 100-app library, in display order. `unit` groups toolkits that share one
// provider OAuth app (and so one approval process) into a single guide.
const APPS = [
  ["gmail", "google-workspace"], ["googlecalendar", "google-workspace"], ["googledrive", "google-workspace"],
  ["googledocs", "google-workspace"], ["googlesheets", "google-workspace"], ["googleslides", "google-workspace"],
  ["googlemeet", "google-workspace"], ["googletasks", "google-workspace"],
  ["outlook", "microsoft-365"], ["microsoft_teams", "microsoft-365"], ["one_drive", "microsoft-365"],
  ["share_point", "microsoft-365"], ["excel", "microsoft-365"],
  ["slack", "slack"], ["salesforce", "salesforce"], ["hubspot", "hubspot"], ["notion", "notion"],
  ["strava", "strava"],
  ["jira", "atlassian"], ["confluence", "atlassian"],
  ["linear", "linear"], ["github", "github"], ["gitlab", "gitlab"], ["bitbucket", "bitbucket"],
  ["asana", "asana"], ["trello", "trello"], ["clickup", "clickup"], ["monday", "monday"], ["airtable", "airtable"],
  ["zoom", "zoom"], ["calendly", "calendly"], ["cal", "cal"], ["dropbox", "dropbox"], ["box", "box"],
  ["figma", "figma"], ["canva", "canva"], ["miro", "miro"], ["discord", "discord"],
  ["twitter", "twitter"], ["linkedin", "linkedin"], ["reddit", "reddit"], ["instagram", "meta"], ["facebook", "meta"],
  ["youtube", "youtube"], ["spotify", "spotify"], ["tiktok", "tiktok"], ["pinterest", "pinterest"], ["twitch", "twitch"],
  ["shopify", "shopify"], ["stripe", "stripe"], ["square", "square"], ["paypal", "paypal"],
  ["quickbooks", "quickbooks"], ["xero", "xero"], ["freshbooks", "freshbooks"],
  ["docusign", "docusign"], ["dropbox_sign", "dropbox-sign"],
  ["zendesk", "zendesk"], ["intercom", "intercom"], ["gorgias", "gorgias"], ["help_scout", "help-scout"],
  ["pipedrive", "pipedrive"], ["zoho", "zoho"], ["attio", "attio"],
  ["gong", "gong"], ["fathom", "fathom"], ["webex", "webex"], ["dialpad", "dialpad"], ["aircall", "aircall"],
  ["typeform", "typeform"], ["survey_monkey", "surveymonkey"], ["mailchimp", "mailchimp"], ["klaviyo", "klaviyo"],
  ["todoist", "todoist"], ["ticktick", "ticktick"], ["basecamp", "basecamp"], ["wrike", "wrike"], ["harvest", "harvest"],
  ["pagerduty", "pagerduty"], ["sentry", "sentry"], ["supabase", "supabase"], ["vercel", "vercel"],
  ["webflow", "webflow"], ["wix", "wix"], ["contentful", "contentful"], ["eventbrite", "eventbrite"],
  ["productboard", "productboard"], ["greenhouse", "greenhouse"], ["lever", "lever"], ["workable", "workable"],
  ["bamboohr", "bamboohr"], ["gusto", "gusto"], ["ramp", "ramp"], ["brex", "brex"],
  ["servicenow", "servicenow"], ["workday", "workday"], ["netsuite", "netsuite"],
  ["snowflake", "snowflake"], ["databricks", "databricks"], ["googleads", "google-ads"],
];

async function load(pathOrUrl) {
  if (/^https?:/.test(pathOrUrl)) {
    const res = await fetch(pathOrUrl);
    if (!res.ok) throw new Error(`GET ${pathOrUrl} -> ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(pathOrUrl, "utf8"));
}

function oauthDetails(tk) {
  const d = (tk.authConfigDetails || []).find((x) => x.mode === "OAUTH2");
  const opt = d?.fields?.auth_config_creation?.optional || [];
  const field = (n) => opt.find((f) => f.name === n)?.default || null;
  const scopes = field("scopes");
  return {
    defaultRedirect: field("oauth_redirect_uri"),
    defaultScopes: scopes ? scopes.split(/[,\s]+/).filter(Boolean) : [],
  };
}

const [composioPath = SOURCES.composio, ampPath = SOURCES.ampersand] = process.argv.slice(2);
const toolkits = await load(composioPath);
const amp = await load(ampPath);
const bySlug = new Map(toolkits.map((t) => [t.slug, t]));

const missing = [];
const apps = APPS.map(([slug, unit], i) => {
  const tk = bySlug.get(slug);
  if (!tk) missing.push(slug);
  const oauth = tk ? oauthDetails(tk) : { defaultRedirect: null, defaultScopes: [] };
  return {
    rank: i + 1,
    slug,
    unit,
    name: tk?.name ?? slug,
    category: tk?.category ?? null,
    logo: tk?.logo ?? null,
    inComposio: Boolean(tk),
    authSchemes: tk?.authSchemes ?? [],
    managed: Boolean(tk?.composioManagedAuthSchemes?.includes("OAUTH2")),
    toolCount: tk?.toolCount ?? 0,
    ...oauth,
  };
});

const endpoints = {};
for (const [name, c] of Object.entries(amp.catalog || {})) {
  if (c.authType !== "oauth2" || !c.oauth2Opts) continue;
  endpoints[name] = {
    displayName: c.displayName,
    authURL: c.oauth2Opts.authURL || null,
    tokenURL: c.oauth2Opts.tokenURL || null,
    explicitScopesRequired: Boolean(c.oauth2Opts.explicitScopesRequired),
    docsURL: c.docsURL || null,
  };
}

// Compact index of every Composio toolkit, so guides for apps outside the 100 can still
// say whether Composio has a toolkit and a managed app.
const composioIndex = toolkits.map((t) => ({
  slug: t.slug,
  name: t.name,
  logo: t.logo ?? null,
  authSchemes: t.authSchemes ?? [],
  managed: Boolean(t.composioManagedAuthSchemes?.includes("OAUTH2")),
}));

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
const meta = { generatedAt: new Date().toISOString(), sources: SOURCES, license: "MIT (both sources)" };
await writeFile(new URL("../data/composio-index.json", import.meta.url), JSON.stringify({ meta, toolkits: composioIndex }));
await writeFile(new URL("../data/apps.json", import.meta.url), JSON.stringify({ meta, apps }, null, 1));
await writeFile(new URL("../data/oauth-endpoints.json", import.meta.url), JSON.stringify({ meta, endpoints }, null, 1));

console.log(`apps: ${apps.length} (${apps.filter((a) => a.managed).length} with a Composio-managed app)`);
console.log(`units: ${new Set(apps.map((a) => a.unit)).size}`);
console.log(`endpoints: ${Object.keys(endpoints).length}`);
if (missing.length) console.log(`not in Composio catalog: ${missing.join(", ")}`);
