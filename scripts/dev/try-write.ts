// Dev-only: rerun just the write step on a saved research bundle (.data/last-bundle.json),
// so the writer can be debugged without paying for research again.
import { readFileSync } from "node:fs";
import { buildRegistry, notesBlock, sourcesBlock } from "../../lib/agent/finalize";
import { writeGuide } from "../../lib/agent/write";

async function main() {
  const bundle = JSON.parse(JSON.parse(readFileSync(".data/last-bundle.json", "utf8")).bundle);
  const reg = buildRegistry(bundle.tracks, bundle.resolved.vendorDomain);
  const t0 = Date.now();
  try {
    const { draft, costUsd } = await writeGuide(
      { appBlock: `App: ${bundle.resolved.name}\n${bundle.ctx.composio}`, sourcesBlock: sourcesBlock(reg), notesBlock: notesBlock(bundle.tracks, reg), probesBlock: "none" },
      (c) => process.stdout.write(`\r${c} chars`),
      AbortSignal.timeout(280_000),
    );
    console.log(`\nok in ${((Date.now() - t0) / 1000).toFixed(0)}s, $${costUsd.toFixed(3)}: ${draft.paths.length} paths, ${draft.steps.length} steps, outcome ${draft.outcome}`);
    console.log(JSON.stringify(draft.paths[0], null, 1).slice(0, 1500));
  } catch (e) {
    console.error("\nFAILED:", e);
  }
}

main();
