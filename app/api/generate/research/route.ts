import { composioFor, composioLine, endpointsFor } from "@/lib/agent/context";
import { resolveApp } from "@/lib/agent/resolve";
import { runTrack, type AppContext, type TrackName } from "@/lib/agent/research";
import { getGuide, matchApp } from "@/lib/data";
import { checkRate, isDemoKey } from "@/lib/ratelimit";
import { cleanAppInput, clientIp, sign } from "@/lib/security";
import { acquireLock, releaseLock } from "@/lib/store";
import { ndjson } from "@/lib/stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FRESH_DAYS = 14;
const isFresh = (checkedAt: string) => Date.now() - new Date(checkedAt).getTime() < FRESH_DAYS * 86_400_000;

// Stage 1 of a live guide: identify the app, then run three research agents in parallel.
// Ends with a signed research bundle that stage 2 (/api/generate/write) turns into a guide.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { q?: unknown; refresh?: unknown } | null;
  const input = cleanAppInput(body?.q);
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const refresh = body?.refresh === true;
  const demo = isDemoKey(req.headers.get("x-demo-key"));

  return ndjson(async (send, signal) => {
    const started = Date.now();

    // Known apps with a guide are answered from the library, without spending anything.
    const hint = matchApp(input.value);
    if (hint && !refresh) {
      const existing = await getGuide(hint.unit);
      if (existing && (existing.kind === "verified" || isFresh(existing.checkedAt))) {
        send({ type: "exists", slug: hint.unit, kind: existing.kind, name: existing.name });
        return;
      }
    }

    const rate = await checkRate(clientIp(req), demo);
    if (!rate.ok) {
      send({ type: "error", code: "rate", message: rate.message });
      return;
    }

    send({ type: "stage", stage: "identify" });
    const { resolved, costUsd: resolveCost } = await resolveApp(input.value, input.host, signal);
    if (!resolved.isSoftwareProduct) {
      send({ type: "error", code: "not_found", message: `Couldn't find a software product called “${input.value}”. Try its website, for example acme.com.` });
      return;
    }
    const composio = composioFor(resolved.name, resolved.unit);
    send({ type: "identified", name: resolved.name, domain: resolved.vendorDomain, slug: resolved.slug, ambiguous: resolved.ambiguous, composio: composioLine(composio) });

    if (!refresh) {
      const existing = await getGuide(resolved.slug);
      if (existing && (existing.kind === "verified" || isFresh(existing.checkedAt))) {
        send({ type: "exists", slug: resolved.slug, kind: existing.kind, name: existing.name });
        return;
      }
    }

    const lockKey = `lock:gen:${resolved.slug}`;
    if (!(await acquireLock(lockKey, 420))) {
      send({ type: "error", code: "busy", message: `A guide for ${resolved.name} is being generated right now. Open the library in a few minutes.` });
      return;
    }

    try {
      const known = endpointsFor(resolved.name, resolved.vendorDomain);
      const ctx: AppContext = {
        input: input.value,
        name: resolved.name,
        vendorDomain: resolved.vendorDomain,
        docsUrl: resolved.docsUrl,
        composio: composioLine(composio),
        endpoints: known ? `Known endpoints (from a public catalog, may be outdated): authorize ${known.authURL ?? "unknown"}, token ${known.tokenURL ?? "unknown"}.` : "",
      };

      send({ type: "stage", stage: "research" });
      const tracks: TrackName[] = ["setup", "review", "terms", "reports"];
      const outputs = await Promise.all(
        tracks.map(async (t) => {
          const out = await runTrack(t, ctx, (e) => send(e), signal);
          send({ type: "track_done", track: t, searches: out.searches, fetches: out.fetches, sources: out.sources.length, error: out.error ? "failed" : null });
          return out;
        }),
      );

      // The visitor left: nobody will run the write stage, so free the app for others.
      if (signal.aborted) {
        await releaseLock(lockKey);
        return;
      }
      if (!outputs.some((o) => o.notes.length > 40)) {
        await releaseLock(lockKey);
        send({ type: "error", code: "empty", message: "The research agents found nothing usable. Try the app's website instead of its name." });
        return;
      }

      const bundle = JSON.stringify({
        v: 1,
        createdAt: Date.now(),
        startedAt: started,
        input: input.value,
        resolved,
        ctx,
        composio: { toolkits: composio.toolkits, defaultRedirect: composio.defaultRedirect },
        tracks: outputs,
        costUsd: resolveCost + outputs.reduce((n, o) => n + o.costUsd, 0),
      });
      send({ type: "research_done", bundle, sig: sign(bundle) });
    } catch (err) {
      await releaseLock(lockKey);
      throw err;
    }
  }, req.signal);
}
