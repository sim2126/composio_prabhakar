// Dev-only: drive both generation stages against a running server, like the browser does.
// Usage: node scripts/dev/try-generate.mjs "<app name or URL>" [baseUrl] [--refresh]
const [q, base = "http://localhost:3100"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const refresh = process.argv.includes("--refresh");
const t0 = Date.now();
const ts = () => `[${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s]`;

async function stream(res, onEvent) {
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

const headers = { "content-type": "application/json", ...(process.env.DEMO_KEY ? { "x-demo-key": process.env.DEMO_KEY } : {}) };
const r1 = await fetch(`${base}/api/generate/research`, { method: "POST", headers, body: JSON.stringify({ q, refresh }) });
if (!r1.ok) {
  console.log(ts(), "research HTTP", r1.status, await r1.text());
  process.exit(0);
}
let bundle = null;
await stream(r1, (e) => {
  if (e.type === "ping") return;
  if (e.type === "research_done") bundle = { bundle: e.bundle, sig: e.sig };
  else console.log(ts(), e.type, JSON.stringify({ ...e, type: undefined }).slice(0, 220));
});
if (!bundle) process.exit(0);
const { mkdirSync, writeFileSync } = await import("node:fs");
mkdirSync(".data", { recursive: true });
writeFileSync(".data/last-bundle.json", JSON.stringify(bundle));
const r2 = await fetch(`${base}/api/generate/write`, { method: "POST", headers, body: JSON.stringify(bundle) });
if (!r2.ok) {
  console.log(ts(), "write HTTP", r2.status, await r2.text());
  process.exit(0);
}
await stream(r2, (e) => {
  if (e.type === "ping" || e.type === "writing") return;
  console.log(ts(), e.type, JSON.stringify({ ...e, type: undefined }).slice(0, 400));
});
