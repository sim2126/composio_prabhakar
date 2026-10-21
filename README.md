# Preflight — OAuth app readiness for agent builders

A library of guides that tell a developer what it takes to get a provider's OAuth app approved for their AI agent — how hard it is, how long it takes (your work and the provider's wait, separately), what can block you, and which steps an agent can do for you — plus a live agent that researches any other app and writes a cited, shareable guide in about three minutes.

Built as a Composio APM (Integrations) take-home. **Live:** https://composioprabhakar.vercel.app · **Source:** https://github.com/sim2126/composio_prabhakar

## The problem, briefly

A Composio integration has three layers: the **provider OAuth app** (registered once with Google, Slack, etc.), a Composio **auth config** that points at it, and one **connected account** per end user. Composio's managed apps are fine for building, but production usually means your own app — your brand on the consent screen, your quota, your scopes — and then the provider's rules apply to you:

- **Difficulty depends on your choices.** Gmail send-only is a ~10-day review; reading mail is a restricted scope that adds a yearly paid security assessment; an internal-only Workspace app needs no review at all.
- **Three parties can block you.** The provider's review, your customer's IT admin (Microsoft admin consent, Salesforce package installs, Workspace trusted apps), and you.
- **Penalties apply before approval.** 100-user caps and 7-day re-consent (Google), 1 request/minute on history for unlisted apps (Slack), 25 installs until listed (HubSpot).
- **AI-use terms are now a gate of their own.** Strava bans putting its data into model context; many providers ban training.
- **It all changes monthly**, and existing guides (including Composio's own) are undated and stop at "get a client ID".

**Scope.** Preflight is for a team building an agent on Composio that needs its own OAuth app: either it is moving off the managed app before launch, or there is no managed app (28 of the 100 apps). That is the point where approval rules start to cost time, and where existing docs stop.

## What's here

| | |
|---|---|
| **Library** | 100 OAuth apps from Composio's catalog, grouped into the provider "approval units" that share one OAuth app (Gmail, Calendar and Drive share one Google project). Each row shows difficulty, your effort, the approval wait, and whether Composio has a managed app. |
| **Guides** | Set who connects and what your agent does; the verdict recomputes. Then: a two-lane plan (your work vs the provider's wait), prerequisites, a step checklist with owners (agent / agent drafts / you / provider / customer admin), gotchas, blocker → fix table, AI-use terms, and every source with its date. Export as Markdown or as a runbook for your coding agent. |
| **Live generation** | Enter any app name or URL. Four research agents (setup, review, API terms, developer reports) run in parallel on Claude with web search and fetch; code probes the provider's OAuth endpoints; a second model writes the guide into a fixed schema; code checks every citation. Saved with a permalink. |
| **Method** | The difficulty rubric, evidence classes, pipeline, and a log of what we checked, corrected and could not verify. |

## Key decisions

1. **Guide per approval unit, personalised by audience × capabilities.** Those two inputs decide the review path, so the verdict is computed from them rather than written once.
2. **Difficulty is computed by a published rubric** from the strongest review on your path, overridden by access gates and AI-use bans. The model classifies the review; it never picks the level.
3. **Evidence on every claim, classified in code.** Official (provider docs), Probed (live endpoint check), Tested (we did it), Third-party, Unverified. Research agents may only cite pages they actually retrieved in that run; anything else is dropped and shows as Unverified.
4. **Two numbers for time.** Your effort and the provider's wait are separate, and the wait is shown as "official" and "reported" side by side, because they often disagree.
5. **Automate creation, not approval.** Agents draft, probe, configure and (where providers allow) register apps; humans sign in, accept terms, pay and submit. Each step says which.
6. **Composio-specific guidance.** Redirect URIs copied from the auth config (the docs and defaults disagree), the managed app's limits, the re-consent cost of switching, and routing the callback through your own domain for Google verification.
7. **Claude over Gemini.** Gemini was cheaper, but its search-grounding terms only allow showing results to the person who asked and forbid caching them — incompatible with a shared library. Claude's web tools allow it with citations.
8. **Reuse over rebuild.** The 100-app list, managed-app flags and default scopes come from Composio's open toolkit catalog (MIT); OAuth endpoints for probes from Ampersand's connector catalog (MIT); logos from logos.composio.dev. Nango's catalog is Elastic-licensed, so it is linked, not copied.
9. **Small on purpose.** Next.js and the Anthropic SDK; no database needed locally; Upstash Redis in production for storage and rate limits.

## How it was built with agents

- **Research:** parallel agents surveyed Composio's auth docs and catalog, 45 providers' approval rules, competitors, developer write-ups and reusable open-source data, each with cited sources.
- **Independent review:** three reviewer agents (a Composio hiring panel, a target developer, an agent/eval engineer) critiqued the plan; it was revised and re-scored before building.
- **Design:** a clickable Claude design canvas was agreed before any UI code.
- **Verification:** separate verifier agents re-checked generated guides claim by claim against live sources; their corrections were applied before promoting guides to "verified".
- **Edge cases:** the live pipeline was run against ambiguous names, typos, URLs, API-key-only and closed APIs, AI-banned apps, prompt injection, private-network URLs, duplicate concurrent submissions, replayed and tampered requests, and rate limits.

## What we checked

The full log is at `/method#checked` in the app. In short:

- **Agent drafts vs independent verification.** Six agent-generated guides were re-checked claim by claim by separate verifier agents against live sources: 12 claims contradicted, about two dozen partly right, 20 critical omissions. The agent rarely invented facts; what it missed were 2025–26 policy changes and AI-use terms. That led to two pipeline changes (a dedicated API-terms research track, and a rule against "use Composio's managed app" paths). Corrections are in [`scripts/curate/`](scripts/curate), so every change to a draft is reviewable.
- **Real setup attempts.** Resend: an agent registered an OAuth client through Resend's public registration endpoint (HTTP 201 in 0.76 s, no human step), and Resend's authorize endpoint accepted it with Composio's callback. Slack, end to end on Composio: an agent created the app from a manifest in 0.6 s and the Composio auth config in 1.1 s, both by API; after one human approval the connection went active and read-only tool calls succeeded ([script](scripts/dev/slack-setup-test.mjs), [record](data/tests/slack-setup.json)). That run showed Composio's Slack toolkit uses user-token scopes and that its connect links expire after 10 minutes. Most other providers need a human login to create the app, so their guides are sourced and probed.
- **Corrected assumptions.** Resend does support OAuth (since Jul 2026); Google assessment prices are published by the labs; Salesforce's review fee is $999 per attempt, not the legacy $2,700; and Salesforce's Agent Integration Protocols (Jun 2026) do set rules for AI agents, which the first verification missed.
- **Conflicts shown, not hidden.** Google's own pages disagree on review time and on the 100-user cap; Composio's docs and auth-config defaults name different callback URLs.

### Edge cases run against the live pipeline

| Input | Result |
|---|---|
| `gmail`, `Google Calendar`, a Pipedrive marketing URL | Opened the existing guide; no model calls |
| `qwzxv plork lorem`, a prompt-injection sentence | "Couldn't find a software product" after one cheap identification call |
| `localhost:3000`, `http://169.254.169.254/…`, `javascript:…`, private IPs, empty or 150-character input | Rejected before any spend |
| `Hubspott` (typo), `Close`, `Clio` (ambiguous names) | Resolved, with the ambiguity shown on the guide |
| `Resend` (assumed API-key only) | Found OAuth 2.1; guide generated and later setup-tested |
| `Reddit`, `Strava` | Restricted: partner-only access; AI use prohibited |
| `Procore` and `procore.com` submitted together | One run, the other told it is already in progress |
| Replayed or tampered research bundle | Refused (409 / 400) |
| More than 4 runs an hour from one visitor | Rate-limited with a clear message |
| A real browser run (Calendly) | Live progress, saved guide, permalink |

## Run it locally

Requirements: Node 20+ and an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Without Redis configured, guides and rate limits are kept locally (`.data/`, in memory).

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required for live generation. |
| `PREFLIGHT_SECRET` | Signs research results between the two generation stages. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis (Vercel's Upstash integration sets these). Optional locally. |
| `DEMO_KEY` | Visitors who open `/generate?key=…` get a separate, larger rate-limit bucket. |
| `RESEARCH_MODEL`, `WRITE_MODEL` | Default `claude-sonnet-5-5` (research) and `claude-opus-5-5` (writing). |
| `RATE_PER_HOUR`, `RATE_PER_DAY`, `RATE_GLOBAL_PER_DAY` | Live-generation limits (default 4, 12, 80). |
| `RATE_DEMO_PER_DAY` | Daily limit for the demo-key bucket (default 60). |

Refresh the seed data from the upstream catalogs with `npm run seed`.

## Deploy

Vercel (Hobby is enough: each generation stage stays under the 300-second limit; `vercel.json` sets the Next.js preset). Add the Upstash for Redis integration (the free plan is enough) and set the variables above. The live deployment caps generation at 20 public and 10 demo-key runs a day.

## What I'd do next

- **Get to 100.** `scripts/dev/batch-generate.mjs` generates the remaining 79 guides for roughly $90–135 (measured $1.11–1.71 a guide). Verify them in catalog order, starting with apps that have no managed app.
- **Keep guides fresh.** Re-run research on each guide monthly and diff it against the stored one; a changed level, fee or new gate sends it back for verification. In the last 18 months Slack, Microsoft, Strava and Salesforce all changed rules that affect agents.
- **Learn from real connections.** Failed connections and support tickets on Composio (redirect mismatches, admin-consent errors) are the best source for the blocker tables.
- **Track a few numbers.** Apps with a guide, days since each was checked, correction rate per verification and share of guides with a setup test. The Method page shows the current values.

## Limitations

- **Generated guides are not human-reviewed.** They are labelled, cite what they read, and list what they could not confirm — but they can still be wrong. Verified guides cover Google Workspace, Microsoft 365, Slack, Salesforce, HubSpot, Notion and Strava.
- **Runs can disagree on ambiguous providers.** Facts are usually stable between runs, but the difficulty level can shift when a provider's docs are vague (Clio moved between Heavy and Self-serve). Verified guides are pinned; generated ones show their date.
- **Wait times are estimates.** Providers rarely publish them, and reported times are anecdotes.
- **Probes prove less than setup.** A dummy-client probe shows an endpoint is live and how it errors, not what review applies. Only Resend and Slack have agent-run setup tests so far; most providers need a human login to create the app.
- **Docs that need JavaScript to render** cannot be read by the fetch tool, so some providers' facts end up "not verified".
- **Costs:** about $1–1.75 per generated guide (Claude Sonnet 5.5 for research, Opus 5.5 for writing). Rate limits and caching keep spend bounded.
- **Not legal advice.** AI-use terms are summarised with links; read the source before relying on them.
