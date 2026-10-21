// Setup test for the Slack guide: an agent creates the Slack app from a manifest, creates a custom
// Composio auth config with its credentials, and opens a connect link; a person approves it once.
// Then read-only tool calls prove the connection works.
//
// Needs in .env.local: SLACK_CONFIG_TOKEN (api.slack.com/apps → Your App Configuration Tokens)
// and COMPOSIO_API_KEY (project API key). Secrets stay in .data/slack-test.json (gitignored);
// timings and outcomes go to data/tests/slack-setup.json.
//
// Usage: node scripts/dev/slack-setup-test.mjs setup   # create app, auth config, connect link
//        node scripts/dev/slack-setup-test.mjs link    # fresh connect link (links expire after ~10 minutes)
//        node scripts/dev/slack-setup-test.mjs wait    # wait for approval, then run read-only tools
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const STATE = ".data/slack-test.json";
const RECORD = "data/tests/slack-setup.json";
const V3_CALLBACK = "https://backend.composio.dev/api/v3/toolkits/auth/callback";
const V1_CALLBACK = "https://backend.composio.dev/api/v1/auth-apps/add";
const USER_SCOPES = ["channels:read", "channels:history", "chat:write", "team:read", "users:read"];
const TEST_USER = "preflight-slack-test";

function loadEnv(file = ".env.local") {
  const out = {};
  for (const raw of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
    const m = raw.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

const env = loadEnv();
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { steps: [] };
function record(name, ms, result) {
  state.steps.push({ name, ms, result, at: new Date().toISOString() });
  writeFileSync(STATE, JSON.stringify(state, null, 1));
  // The public record never includes credentials.
  writeFileSync(RECORD, JSON.stringify({ app: state.app?.id ?? null, authConfig: state.authConfig?.id ?? null, scopes: USER_SCOPES, steps: state.steps }, null, 1));
  console.log(`${name}: ${result} (${ms} ms)`);
}
const composio = (path, init = {}) =>
  fetch(`https://backend.composio.dev/api/v3.1${path}`, { ...init, headers: { "x-api-key": env.COMPOSIO_API_KEY, "content-type": "application/json" } });

async function createApp() {
  const manifest = {
    display_information: { name: "Preflight Test", description: "Setup test for the Preflight Slack guide" },
    oauth_config: { redirect_urls: [V3_CALLBACK, V1_CALLBACK], scopes: { user: USER_SCOPES } },
    settings: { org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false },
  };
  const t = Date.now();
  const r = await fetch("https://slack.com/api/apps.manifest.create", {
    method: "POST",
    headers: { authorization: `Bearer ${env.SLACK_CONFIG_TOKEN}`, "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ manifest: JSON.stringify(manifest) }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`apps.manifest.create: ${j.error}`);
  state.app = { id: j.app_id, client_id: j.credentials.client_id, client_secret: j.credentials.client_secret };
  record("slack apps.manifest.create", Date.now() - t, `ok: app ${j.app_id}`);
}

async function createAuthConfig() {
  const t = Date.now();
  const r = await composio("/auth_configs", {
    method: "POST",
    body: JSON.stringify({
      toolkit: { slug: "slack" },
      auth_config: {
        type: "use_custom_auth",
        auth_scheme: "OAUTH2",
        name: "Preflight Slack test",
        credentials: { client_id: state.app.client_id, client_secret: state.app.client_secret, oauth_redirect_uri: V3_CALLBACK, scopes: USER_SCOPES.join(",") },
      },
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`create auth config ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  state.authConfig = { id: j.auth_config?.id ?? j.id };
  record("composio create auth config", Date.now() - t, `ok: ${state.authConfig.id}`);
}

async function createLink() {
  const t = Date.now();
  const r = await composio("/connected_accounts/link", { method: "POST", body: JSON.stringify({ auth_config_id: state.authConfig.id, user_id: TEST_USER }) });
  const j = await r.json();
  if (!r.ok) throw new Error(`create link ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  state.link = { url: j.redirect_url, connected_account_id: j.connected_account_id, expires_at: j.expires_at };
  record("composio create connect link", Date.now() - t, `ok: account ${j.connected_account_id}, expires ${j.expires_at}`);
  console.log(`\nOpen within 10 minutes and click Allow:\n${j.redirect_url}\n`);
}

async function waitAndCall() {
  const id = state.link.connected_account_id;
  const start = Date.now();
  let acct;
  while (Date.now() - start < 15 * 60_000) {
    acct = await (await composio(`/connected_accounts/${id}`)).json();
    if (["ACTIVE", "FAILED", "EXPIRED"].includes(acct.status)) break;
    await new Promise((res) => setTimeout(res, 4000));
  }
  record("composio connected account", Date.now() - start, `${acct?.status}${acct?.status_reason ? `: ${acct.status_reason}` : ""}`);
  if (acct?.status !== "ACTIVE") process.exit(1);
  for (const [slug, args] of [["SLACK_FETCH_TEAM_INFO", {}], ["SLACK_LIST_ALL_CHANNELS", { limit: 5 }]]) {
    const t = Date.now();
    const r = await composio(`/tools/execute/${slug}`, { method: "POST", body: JSON.stringify({ connected_account_id: id, user_id: TEST_USER, arguments: args }) });
    const j = await r.json();
    const d = j.data ?? {};
    const what = slug === "SLACK_FETCH_TEAM_INFO" ? `team found: ${Boolean(d.team?.id ?? d.id)}` : `${(d.channels ?? []).length} channels listed`;
    record(`composio execute ${slug}`, Date.now() - t, `${j.successful ? "ok" : "failed"}: ${what}${j.error ? ` (${String(j.error).slice(0, 160)})` : ""}`);
  }
}

const cmd = process.argv[2];
if (cmd === "setup") {
  if (!state.app) await createApp();
  if (!state.authConfig) await createAuthConfig();
  await createLink();
} else if (cmd === "link") await createLink();
else if (cmd === "wait") await waitAndCall();
else console.log("Usage: setup | link | wait");
