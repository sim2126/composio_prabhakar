// Adds the recorded Resend setup attempt (2026-10-20) to the stored Resend guide as Tested evidence.
// The attempt: POST https://api.resend.com/oauth/register (confidential client, Composio callback)
// returned 201 in 0.76 s; the authorize endpoint then answered 302 to the consent page.
import { readFileSync, writeFileSync } from "node:fs";

const file = ".data/guide_resend.json";
const g = JSON.parse(readFileSync(file, "utf8"));
const docs = "https://resend.com/docs/guides/building-a-resend-oauth-client";
let docId = g.sources.find((s) => s.url.startsWith(docs))?.id;
if (!docId) {
  docId = `S${g.sources.filter((s) => s.id.startsWith("S")).length + 1}`;
  g.sources.push({ id: docId, url: docs, title: "Building a Resend OAuth client", domain: "resend.com", class: "official", retrievedAt: "2026-10-21" });
}
if (!g.sources.some((s) => s.id === "T1")) {
  g.sources.push({ id: "T1", url: "https://api.resend.com/oauth/register", title: "Registered a confidential client by API (201 in 0.76 s); authorize accepted it with the Composio callback (302 to consent)", domain: "api.resend.com", class: "tested", retrievedAt: "2026-10-20" });
  g.probes.push({ target: "api.resend.com/oauth/register", request: "POST client registration (client_secret_basic, emails:send, Composio callback)", result: "201: client issued in 0.76 s; authorize then answered 302 to the consent page (unknown client: 401)", at: "2026-10-20T20:07:55Z" });
}
const reg = g.steps.find((s) => /regist/i.test(s.title));
if (reg) {
  reg.owner = "agent";
  reg.evidence = Array.from(new Set([...(reg.evidence ?? []), "T1", docId]));
  if (!/Tested:/.test(reg.detail)) reg.detail += " Tested: an agent registered a client this way in under a second, with no console or human step.";
}
if (!g.gotchas.some((x) => /pre-register/i.test(x.text))) {
  g.gotchas.unshift({ text: "Resend recommends pre-registering remote third-party clients rather than registering them by API, because it has no domain-ownership checks yet. Ask Resend before relying on self-registration in production.", evidence: [docId], paths: null });
}
writeFileSync(file, JSON.stringify(g, null, 1));
console.log(`resend: registration step = ${reg ? reg.title : "(none found)"}; sources ${g.sources.length}`);
