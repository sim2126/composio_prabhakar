# Preflight — OAuth app readiness for agent builders

Guides that tell a developer what it takes to get a provider's OAuth app approved for their AI agent: how hard it is, how long it takes (your work and the provider's wait, separately), what can block you, and which steps an agent can do. A live agent researches any other app and writes a cited, shareable guide in about three minutes.

**Live:** https://composioprabhakar.vercel.app · Built as a Composio APM (Integrations) take-home.

## The problem and scope

A Composio integration has three layers: the **provider OAuth app**, a Composio **auth config** that points at it, and one **connected account** per user. Managed apps are fine for building, but production usually means your own app, and then the provider's rules apply: reviews that depend on the scopes you pick, customer admins who must approve, caps and rate limits before approval, and AI-use terms that can rule an integration out. These rules change monthly, and most guides stop at "get a client ID".

**Scope:** teams building an agent on Composio that need their own OAuth app, either moving off the managed app before launch or with no managed app to use (28 of the 100 apps).

## What's here

- **Library:** Composio's 100 OAuth apps, grouped into the provider "approval units" that share one OAuth app, with difficulty, effort, approval wait and managed-app availability.
- **Guides:** pick who connects and what your agent does; the verdict recomputes. A plan split into your work and the provider's wait, steps with owners (agent, you, provider, customer admin), blockers with fixes, AI-use terms, and every source. Exports as Markdown or a runbook for a coding agent.
- **Live generation:** four research agents run in parallel on Claude with web search and fetch, code probes the provider's OAuth endpoints, a second model writes the guide into a fixed schema, and code checks every citation.
- **Method** (`/method`): the difficulty rubric, evidence classes, current numbers, and a log of what was tested, corrected and could not be verified.

## Key decisions

1. **Computed, not written, verdicts.** Who connects and which scopes you need decide the review path, so difficulty comes from a published rubric applied to the strongest review on that path. The model classifies the review; it never picks the level.
2. **Evidence on every claim, classified in code:** Official, Probed, Tested, Third-party or Unverified. Agents may only cite pages they actually retrieved in that run.
3. **Two numbers for time.** Your effort and the provider's wait are shown separately, and the wait as "official" and "reported" side by side.
4. **Automate creation, not approval.** Agents draft, probe, configure and register apps where providers allow it; people sign in, accept terms, pay and submit. Every step says which.
5. **Composio-specific guidance:** which redirect URI to register, the managed app's limits, the cost of switching, and routing the callback through your own domain for Google verification.
6. **Claude over Gemini.** Gemini's search-grounding terms forbid sharing or caching grounded results, which a shared library needs.
7. **Reuse over rebuild:** the app list and scopes come from Composio's open toolkit catalog (MIT), OAuth endpoints from Ampersand's catalog (MIT), and logos from logos.composio.dev.

## What we checked

- **Verifier agents** re-checked six agent-written guides claim by claim against live sources: 12 claims contradicted and 20 critical omissions, mostly 2025–26 policy changes and AI-use terms. Corrections live in [`scripts/curate/`](scripts/curate), so every change is reviewable.
- **Agent setup attempts:** Resend (an OAuth client registered by API in under a second) and Slack end to end on Composio (app and auth config created by API, one human approval, then a live connection and working tool calls; [record](data/tests/slack-setup.json)).
- **Edge cases:** typos, ambiguous names, URLs, prompt injection, private-network addresses, duplicate and replayed requests, and rate limits. The full log is on the Method page.

## Run it locally

Requires Node 20+ and an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # set ANTHROPIC_API_KEY and PREFLIGHT_SECRET
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Required for live generation. |
| `PREFLIGHT_SECRET` | Signs research results between the two generation stages. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash Redis for storage and rate limits. Optional locally (falls back to `.data/` and memory). |
| `DEMO_KEY` | `/generate?key=…` gets its own rate-limit bucket. |
| `RATE_PER_HOUR`, `RATE_PER_DAY`, `RATE_GLOBAL_PER_DAY`, `RATE_DEMO_PER_DAY` | Generation limits (defaults 4, 12, 80, 60). |

**Deploy:** Vercel Hobby with the Upstash for Redis integration (free plan) and the variables above. Each generation stage stays under the 300-second function limit.

## Limitations

- **Generated guides are not human-reviewed.** They are labelled and list what they could not confirm, but can be wrong. Verified guides cover Google Workspace, Microsoft 365, Slack, Salesforce, HubSpot, Notion and Strava.
- **Runs can disagree** on providers whose docs are vague; verified guides are pinned and generated ones show their date.
- **Wait times are estimates.** Providers rarely publish them, and reported times are anecdotes.
- **Only Resend and Slack are setup-tested.** Most providers need a human login to create the app, so other guides are sourced and probed.
- **Pages that need JavaScript to render** can't be read by the fetch tool, so some facts end up unverified.
- **Cost:** about $1.10–1.70 per generated guide; rate limits keep spend bounded.
- **Not legal advice.** AI-use terms are summarised with links to the source.
