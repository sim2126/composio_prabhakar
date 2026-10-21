// Copies selected generated guides from the local store (.data/) into data/generated/
// so a fresh deployment ships with them. Usage: node scripts/export-generated.mjs slug1 slug2 ...
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const slugs = process.argv.slice(2);
mkdirSync("data/generated", { recursive: true });
for (const slug of slugs) {
  const g = JSON.parse(readFileSync(`.data/guide_${slug}.json`, "utf8"));
  writeFileSync(`data/generated/${slug}.json`, JSON.stringify(g, null, 1));
}
const ident = (s) => s.replace(/[^a-z0-9]+(.)/gi, (_, c) => c.toUpperCase());
const lines = [
  'import { Guide } from "@/lib/guide";',
  ...slugs.map((s) => `import ${ident(s)} from "./${s}.json";`),
  "",
  "// Agent-generated guides captured during testing, shipped so a fresh deployment has examples.",
  "// They stay labelled as generated (not human-reviewed). The live store takes precedence.",
  "const RAW: Record<string, unknown> = {",
  ...slugs.map((s) => `  "${s}": ${ident(s)},`),
  "};",
  "",
  "export const SNAPSHOTS: Record<string, Guide> = Object.fromEntries(Object.entries(RAW).map(([slug, g]) => [slug, Guide.parse(g)]));",
  "",
];
writeFileSync("data/generated/index.ts", lines.join("\n"));
console.log(`exported ${slugs.length}: ${slugs.join(", ")}`);
