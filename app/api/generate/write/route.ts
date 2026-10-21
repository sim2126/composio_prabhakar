import { endpointsFor } from "@/lib/agent/context";
import { buildRegistry, notesBlock, probeSources, sanitize, sourcesBlock } from "@/lib/agent/finalize";
import { MODELS, today } from "@/lib/agent/llm";
import { probeProvider } from "@/lib/agent/probe";
import type { AppContext, TrackOutput } from "@/lib/agent/research";
import type { Resolved } from "@/lib/agent/resolve";
import { writeGuide } from "@/lib/agent/write";
import { saveGeneratedGuide, summarize } from "@/lib/data";
import { Guide } from "@/lib/guide";
import { verify } from "@/lib/security";
import { acquireLock, releaseLock } from "@/lib/store";
import { ndjson } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Bundle = {
  v: 1;
  createdAt: number;
  startedAt: number;
  input: string;
  resolved: Resolved;
  ctx: AppContext;
  composio: { toolkits: { slug: string; name: string; managed: boolean }[]; defaultRedirect: string | null };
  tracks: TrackOutput[];
  costUsd: number;
};

// Stage 2 of a live guide: probe the provider, write the guide from the research, check it, save it.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { bundle?: unknown; sig?: unknown } | null;
  if (typeof body?.bundle !== "string" || body.bundle.length > 400_000 || !verify(body.bundle, body.sig)) {
    return Response.json({ error: "This research run is not valid. Start again from the library." }, { status: 400 });
  }
  const bundle = JSON.parse(body.bundle) as Bundle;
  if (Date.now() - bundle.createdAt > 30 * 60_000) {
    return Response.json({ error: "This research run has expired. Start again." }, { status: 410 });
  }
  // Each signed bundle can be written once.
  if (!(await acquireLock(`used:${String(body.sig).slice(0, 32)}`, 3600))) {
    return Response.json({ error: "This research run was already used." }, { status: 409 });
  }

  return ndjson(async (send, signal) => {
    const { resolved } = bundle;
    const lockKey = `lock:gen:${resolved.slug}`;
    try {
      send({ type: "stage", stage: "probe" });
      const probes = await probeProvider(resolved.vendorDomain, endpointsFor(resolved.name, resolved.vendorDomain), (text) => send({ type: "progress", track: "probe", text }));
      if (!probes.length) send({ type: "progress", track: "probe", text: "No public OAuth endpoints answered on the vendor's domain" });

      const reg = buildRegistry(bundle.tracks, resolved.vendorDomain);
      const probeSrc = probeSources(probes, 1);
      const appBlock = [
        `App: ${resolved.name} (${resolved.vendorDomain || "domain unknown"})`,
        resolved.ambiguous ? `The input "${bundle.input}" was ambiguous: ${resolved.ambiguous} This guide covers ${resolved.name}.` : "",
        bundle.ctx.composio,
        `OAuth support according to identification step: ${resolved.oauthSupport}.`,
      ]
        .filter(Boolean)
        .join("\n");

      send({ type: "stage", stage: "write" });
      const started = Date.now();
      const { draft, costUsd } = await writeGuide(
        {
          appBlock,
          sourcesBlock: [sourcesBlock(reg), ...probeSrc.map((p) => `${p.id}: ${p.title} (live probe)`)].join("\n"),
          notesBlock: notesBlock(bundle.tracks, reg),
          probesBlock: probes.map((p, i) => `P${i + 1}: ${p.request} → ${p.target}: ${p.result}`).join("\n") || "none",
        },
        (chars) => send({ type: "writing", chars }),
        signal,
      );

      send({ type: "stage", stage: "check" });
      const valid = new Set([...reg.sources.map((s) => s.id), ...probeSrc.map((s) => s.id)]);
      const clean = sanitize(draft, valid);
      const guide = Guide.parse({
        ...clean,
        name: resolved.name,
        vendorDomain: resolved.vendorDomain || clean.vendorDomain,
        slug: resolved.slug,
        kind: "generated",
        checkedAt: today(),
        sources: [...reg.sources, ...probeSrc],
        probes,
        composio: bundle.composio,
        run: {
          model: `${MODELS.research} + ${MODELS.write}`,
          seconds: Math.round((Date.now() - bundle.startedAt) / 1000),
          searches: bundle.tracks.reduce((n, t) => n + t.searches, 0),
          fetches: bundle.tracks.reduce((n, t) => n + t.fetches, 0),
          costUsd: Math.round((bundle.costUsd + costUsd) * 100) / 100,
        },
      });
      const cited = new Set([
        ...guide.steps.flatMap((s) => s.evidence),
        ...guide.gotchas.flatMap((g) => g.evidence),
        ...guide.paths.flatMap((p) => [...p.waitEvidence, ...p.costEvidence, ...p.untilApproved.flatMap((l) => l.evidence)]),
        ...guide.aiPolicy.evidence,
      ]);
      await saveGeneratedGuide(guide);
      send({
        type: "saved",
        slug: guide.slug,
        summary: summarize(guide),
        stats: { sources: guide.sources.length, cited: cited.size, probes: probes.length, seconds: guide.run?.seconds, writeSeconds: Math.round((Date.now() - started) / 1000), costUsd: guide.run?.costUsd },
      });
    } finally {
      await releaseLock(lockKey);
    }
  }, req.signal);
}
