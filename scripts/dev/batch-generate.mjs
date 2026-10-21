// Dev-only: run several live generations (edge cases) against a running server and summarise.
// Usage: DEMO_KEY=... node scripts/dev/batch-generate.mjs "<input>" "<input>" ...
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.BASE_URL || "http://localhost:3100";
const inputs = process.argv.slice(2);
const headers = { "content-type": "application/json", ...(process.env.DEMO_KEY ? { "x-demo-key": process.env.DEMO_KEY } : {}) };
mkdirSync(".data/runs", { recursive: true });

async function lines(res, onEvent) {
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
}

async function run(q) {
  const t0 = Date.now();
  const log = [];
  const result = { input: q, outcome: "?", detail: "", seconds: 0 };
  try {
    const r1 = await fetch(`${base}/api/generate/research`, { method: "POST", headers, body: JSON.stringify({ q, refresh: process.env.REFRESH === "1" }) });
    if (!r1.ok) {
      result.outcome = `HTTP ${r1.status}`;
      result.detail = (await r1.text()).slice(0, 120);
      return result;
    }
    let bundle = null;
    await lines(r1, (e) => {
      if (e.type === "ping") return;
      log.push(JSON.stringify(e).slice(0, 300));
      if (e.type === "identified") result.detail = `${e.name} (${e.domain})${e.ambiguous ? " AMBIGUOUS: " + e.ambiguous : ""}`;
      if (e.type === "exists") result.outcome = `exists → ${e.slug}`;
      if (e.type === "error") result.outcome = `error:${e.code}`, (result.detail = e.message);
      if (e.type === "research_done") bundle = { bundle: e.bundle, sig: e.sig };
    });
    if (bundle) {
      const r2 = await fetch(`${base}/api/generate/write`, { method: "POST", headers, body: JSON.stringify(bundle) });
      await lines(r2, (e) => {
        if (e.type === "ping" || e.type === "writing") return;
        log.push(JSON.stringify(e).slice(0, 400));
        if (e.type === "saved") result.outcome = `saved ${e.slug}: ${e.summary.level} | ${e.summary.note || "-"} | $${e.stats.costUsd} | cited ${e.stats.cited}/${e.stats.sources}`;
        if (e.type === "error") result.outcome = `error:${e.code}`, (result.detail = e.message);
      });
      // Replaying the same signed bundle must be refused.
      const r3 = await fetch(`${base}/api/generate/write`, { method: "POST", headers, body: JSON.stringify(bundle) });
      log.push(`replay → HTTP ${r3.status}`);
      result.replay = r3.status;
    }
  } catch (err) {
    result.outcome = "exception";
    result.detail = String(err).slice(0, 120);
  } finally {
    result.seconds = Math.round((Date.now() - t0) / 1000);
    writeFileSync(`.data/runs/${q.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}.log`, log.join("\n"));
  }
  return result;
}

const results = await Promise.all(inputs.map(run));
for (const r of results) console.log(`${r.input.padEnd(34)} ${String(r.seconds).padStart(4)}s  ${r.outcome}${r.replay ? `  replay=${r.replay}` : ""}\n${" ".repeat(41)}${r.detail}`);
