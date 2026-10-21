// Microsoft 365: corrections from independent verification on 2026-10-21.
import { load, path, save, source, step } from "./lib.mjs";

const g = load("microsoft-365");
const consent = source(g, "https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/manage-app-consent-policies", "Manage app consent policies");
const mc = source(g, "https://mc.merill.net/message/MC1163922", "MC1163922: default consent policy blocks mail and calendar (Message Center mirror)", "third_party");
const pv = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/publisher-verification-overview", "Publisher verification");
const vetting = source(g, "https://learn.microsoft.com/en-us/partner-center/enroll/understand-the-verification-process", "Partner Center verification process");
const replyUrl = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/reply-url", "Redirect URI restrictions");
const refresh = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/refresh-tokens", "Refresh tokens");
const throttle = source(g, "https://learn.microsoft.com/en-us/graph/throttling-limits", "Microsoft Graph throttling limits");
const creds = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials", "Add credentials");
const cert = source(g, "https://learn.microsoft.com/en-us/microsoft-365-app-certification/docs/certification", "Microsoft 365 Certification");
const stepUp = source(g, "https://learn.microsoft.com/en-us/entra/identity/enterprise-apps/configure-risk-based-step-up-consent", "Risk-based step-up consent");
const adminConsent = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/v2-admin-consent", "Admin consent on the Microsoft identity platform");
const quick = source(g, "https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app", "Register an application");
const redirect = g.composio.defaultRedirect ?? "https://backend.composio.dev/api/v1/auth-apps/add";

g.name = "Microsoft 365";
g.covers = ["Outlook", "Outlook Calendar", "Teams", "OneDrive", "SharePoint", "Excel"];
g.summary = "Microsoft does not review your app, but other organisations' admins usually must consent to mail and calendar access, and multi-tenant apps should be publisher verified.";
g.capabilities = [
  { id: "read_mail", label: "Read email", scopes: [{ name: "Mail.Read", tier: "sensitive", label: "Admin consent" }], alternative: "No user-consentable way to read mail in tenants on Microsoft's default policy." },
  { id: "send_mail", label: "Send email", scopes: [{ name: "Mail.Send", tier: "basic", label: "User consent" }], alternative: null },
  { id: "calendar", label: "Manage calendar", scopes: [{ name: "Calendars.ReadWrite", tier: "sensitive", label: "Admin consent" }], alternative: "Admin consent in tenants on Microsoft's default policy." },
  { id: "contacts", label: "Read contacts", scopes: [{ name: "Contacts.Read", tier: "basic", label: "User consent" }], alternative: "Contacts.ReadWrite needs admin consent since mid-2026." },
];
g.defaultCapabilities = ["read_mail", "send_mail", "calendar"];

const single = path(g, "single_tenant");
single.tiers = ["basic", "sensitive", "restricted"];
const verifiedPath = path(g, "multitenant_verified");
const shared = {
  audiences: ["customers", "public"],
  review: "light",
  effort: "1–3 days",
  waitOfficial: "3–5 business days to vet your partner account; verification then takes minutes",
  waitReported: "Weeks to months when partner vetting is rejected",
  waitEvidence: [vetting, pv],
  cost: "$0",
  costNote: "Microsoft charges no fee for publisher verification.",
  costEvidence: [pv],
  lanes: { you: ["~1 hour", "~1 day", "", "~30 min"], provider: ["", "", "3–5 BD", ""] },
};
g.paths = [
  single,
  {
    ...verifiedPath,
    ...shared,
    id: "multitenant-user",
    label: "Other organisations, user-consentable scopes",
    tiers: ["basic"],
    drivenBy: "Users in many tenants can't consent to unverified multi-tenant apps, so get publisher verified; send-mail and read-contacts scopes stay user-consentable.",
    customerAdmin: "sometimes",
    next: "Start AI Cloud Partner Program verification today; it gates publisher verification.",
    untilApproved: [{ text: "Unverified multi-tenant apps show 'Unverified', and users in tenants with step-up consent cannot consent (AADSTS90094).", evidence: [stepUp, pv] }],
  },
  {
    ...verifiedPath,
    ...shared,
    id: "multitenant-admin",
    label: "Other organisations, mail or calendar access",
    tiers: ["sensitive", "restricted"],
    drivenBy: "In tenants on Microsoft's default consent policy, users can't consent to mail or calendar scopes: each customer's admin must, even for a verified app.",
    customerAdmin: "always",
    next: "Start partner verification today and build an admin-consent step into every customer's onboarding.",
    untilApproved: [
      { text: "Each customer's admin must grant consent to mail and calendar scopes, verified or not.", evidence: [consent, mc] },
      { text: "Unverified multi-tenant apps show 'Unverified', and step-up consent blocks users entirely.", evidence: [stepUp, pv] },
    ],
  },
];
const both = ["multitenant-user", "multitenant-admin"];
const own = ["single_tenant", ...both];

// The draft's path ids were replaced above, so point every reference at the new ids and drop
// items that only applied to the removed "use Composio's managed app" path.
const remap = (ids) => {
  if (!ids) return null;
  const out = new Set();
  for (const id of ids) {
    if (id === "single_tenant") out.add("single_tenant");
    if (id === "multitenant_verified" || id === "m365_certification") both.forEach((b) => out.add(b));
  }
  return out.size ? [...out] : "drop";
};
for (const key of ["steps", "gotchas", "blockers", "prereqs"]) {
  g[key] = g[key].map((x) => ({ ...x, paths: remap(x.paths) })).filter((x) => x.paths !== "drop");
}

g.prereqs = [
  { text: "A verified AI Cloud Partner Program account", why: "Needed for publisher verification. Vetting checks government ID, domain and business registration; usually 3–5 business days.", owner: "you", paths: both },
  { text: "A work or school Entra tenant", why: "Apps registered with a personal Microsoft account can never be publisher verified.", owner: "you", paths: own },
  { text: "A custom domain verified in that tenant", why: "*.onmicrosoft.com is not accepted as a publisher domain.", owner: "you", paths: both },
];

g.steps = g.steps.filter((s) => !["s1", "s9", "s10"].includes(s.id));
const reg = step(g, "s2");
reg.owner = "agent";
reg.title = "Register the app";
reg.detail = "Sign in with az login (you), then the agent registers it. Choose 'Multiple Entra ID tenants' to serve other organisations. The app object can't move between tenants later.";
reg.values = [{ label: "Azure CLI", text: `az ad app create --display-name "Your agent" --sign-in-audience AzureADMultipleOrgs --web-redirect-uris ${redirect}` }];
reg.evidence = [quick, pv];
reg.paths = own;
const ru = step(g, "s3");
ru.detail = "Paste the redirect URI from your Composio auth config. HTTPS only (http just for localhost), case-sensitive, at most 256 characters; a mismatch fails with AADSTS50011.";
ru.values = [{ label: "Redirect URI", text: redirect }];
ru.evidence = [replyUrl];
const sec = step(g, "s4");
sec.detail = "Certificates & secrets → New client secret (24 months at most; Microsoft recommends under 12 and certificates in production). API permissions → Microsoft Graph delegated permissions, including offline_access.";
sec.values = [{ label: "Delegated permissions", text: "offline_access Mail.Read Mail.Send Calendars.ReadWrite" }];
sec.evidence = [creds, refresh];
step(g, "s7").detail = "Use the partner global account's Partner One ID (location IDs are rejected). Your partner email domain must match the publisher domain. You need Application Administrator or Cloud Application Administrator plus a Partner Center admin role, with MFA.";
const adm = step(g, "s12");
adm.paths = both;
adm.title = "Get admin consent in each customer tenant";
adm.detail = "Send each customer's admin the admin-consent link. Required for mail and calendar scopes in tenants on the default policy, and for any tenant that blocks user consent.";
adm.values = [{ label: "Admin consent link (fill in your client ID)", text: `https://login.microsoftonline.com/organizations/v2.0/adminconsent?client_id=YOUR_CLIENT_ID&scope=https://graph.microsoft.com/.default&redirect_uri=${encodeURIComponent(redirect)}` }];
adm.evidence = [adminConsent, consent];
g.steps.push({
  id: "certification",
  phase: "wait",
  title: "Optional: Microsoft 365 Certification",
  owner: "lab",
  time: "14 + 60 days",
  detail: "Not required to connect. A paid audit by Microsoft's assessor (Claranet): a 14-day document stage, then up to 60 days for evidence. Renewed every year. Some enterprise buyers ask for it.",
  values: [],
  evidence: [cert],
  paths: both,
});

g.customerAdminNote = "In tenants on Microsoft's default consent policy, users can't grant mail, calendar or files access. Send their admin the admin-consent link from the steps.";
g.gotchas = [
  { text: "Microsoft's default consent policy now blocks user consent to mail, calendar, files and contacts-write permissions (rolled out July 2025 to July 2026). It applies to tenants on the Microsoft-managed policy; existing grants are unaffected.", evidence: [consent, mc], paths: null },
  { text: "Publisher verification does not exempt your app from those admin-consent requirements.", evidence: [consent], paths: both },
  { text: "Access tokens last about an hour. Refresh tokens last 90 days and are replaced on each use; request offline_access to get one.", evidence: [refresh], paths: null },
  { text: "Client secrets expire after at most 24 months. Rotate them before they lapse or every connection breaks.", evidence: [creds], paths: null },
  { text: "Outlook throttling is per app per mailbox: 10,000 requests per 10 minutes and 4 concurrent requests.", evidence: [throttle], paths: null },
  ...g.gotchas.filter((x) => /moved between tenants|national clouds|does not signal compliance|syncing or backing up/.test(x.text)),
];
g.unknowns = ["Whether Composio's managed Outlook app is publisher verified, and which scopes it requests.", "The price of Microsoft 365 Certification, which is paid to the assessor and not published."];
const apiTerms = source(g, "https://learn.microsoft.com/en-us/legal/microsoft-apis/terms-of-use", "Microsoft APIs Terms of Use (Oct 2025)");
for (const x of g.gotchas) if (/syncing or backing up/.test(x.text)) x.evidence = Array.from(new Set([...x.evidence, apiTerms]));
for (const b of g.blockers) b.cause = b.cause.replace(/^Not confirmed(?: in the reports)?\.\s*/i, "").replace(/^Likely causes are /, "Likely ");
save(g);
