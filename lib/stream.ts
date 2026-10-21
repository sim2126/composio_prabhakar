// Newline-delimited JSON over a streaming response: one event per line.
export function ndjson(run: (send: (event: Record<string, unknown>) => void, signal: AbortSignal) => Promise<void>, requestSignal: AbortSignal): Response {
  const encoder = new TextEncoder();
  const controller = new AbortController();
  requestSignal.addEventListener("abort", () => controller.abort(), { once: true });
  const body = new ReadableStream<Uint8Array>({
    async start(c) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          c.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };
      // A heartbeat keeps proxies from closing a quiet connection during long model calls.
      const beat = setInterval(() => send({ type: "ping" }), 10_000);
      try {
        await run(send, controller.signal);
      } catch (err) {
        console.error("[generate]", err);
        send({ type: "error", code: "failed", message: friendlyError(err) });
      } finally {
        clearInterval(beat);
        open = false;
        try {
          c.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

export function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/rate|429|overloaded|529/i.test(msg)) return "The model is busy right now. Try again in a minute.";
  if (/abort/i.test(msg)) return "The run was stopped.";
  if (/timeout|timed out/i.test(msg)) return "The run took too long and was stopped. Try again; partial research is not saved.";
  return "Something went wrong while generating this guide. Try again.";
}
