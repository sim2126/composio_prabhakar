// Dev-only: run one research track against the live API and print what comes back.
// Usage: node --env-file=.env --import tsx scripts/dev/try-track.ts <track> "<App name>" <domain>
import { runTrack, type TrackName } from "../../lib/agent/research";

async function main() {
  const [track = "review", name = "Pipedrive", domain = "pipedrive.com"] = process.argv.slice(2);
  const started = Date.now();
  const out = await runTrack(
    track as TrackName,
    { input: name, name, vendorDomain: domain, docsUrl: null, composio: "", endpoints: "" },
    (e) => console.log(`  [${((Date.now() - started) / 1000).toFixed(0)}s] ${e.text}`),
    AbortSignal.timeout(240_000),
  );
  console.log("\n--- notes ---\n" + out.notes);
  console.log("\n--- sources ---");
  for (const s of out.sources) console.log(`${s.fetched ? "fetched" : "cited  "} ${s.domain} | ${s.title.slice(0, 70)} | snippets=${s.snippets.length}`);
  console.log(`\nsearches=${out.searches} fetches=${out.fetches} cost=$${out.costUsd.toFixed(3)} time=${((Date.now() - started) / 1000).toFixed(1)}s error=${out.error}`);
}

main();
