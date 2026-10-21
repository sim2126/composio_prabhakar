import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./store";

// Live generation costs real money, so it is rate limited per visitor and globally.
// A demo key (DEMO_KEY) gets its own, larger bucket so reviewers are never locked out.
const LIMITS = {
  perHour: Number(process.env.RATE_PER_HOUR || 4),
  perDay: Number(process.env.RATE_PER_DAY || 12),
  globalPerDay: Number(process.env.RATE_GLOBAL_PER_DAY || 80),
  demoPerDay: Number(process.env.RATE_DEMO_PER_DAY || 60),
};

type Check = { ok: true } | { ok: false; message: string };

const upstash = redis
  ? {
      hour: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.perHour, "1 h"), prefix: "rl:h" }),
      day: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(LIMITS.perDay, "1 d"), prefix: "rl:d" }),
      global: new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(LIMITS.globalPerDay, "1 d"), prefix: "rl:g" }),
      demo: new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(LIMITS.demoPerDay, "1 d"), prefix: "rl:demo" }),
    }
  : null;

// In-memory fallback for local development (per server instance).
const mem = new Map<string, number[]>();
function memHit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const hits = (mem.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    mem.set(key, hits);
    return false;
  }
  hits.push(now);
  mem.set(key, hits);
  return true;
}

export function isDemoKey(key: string | null): boolean {
  return Boolean(process.env.DEMO_KEY && key && key === process.env.DEMO_KEY);
}

export async function checkRate(ip: string, demo: boolean): Promise<Check> {
  const busy = { ok: false as const, message: "Too many guides generated right now. Try again later, or open one from the library." };
  if (demo) {
    const ok = upstash ? (await upstash.demo.limit("demo")).success : memHit("demo", LIMITS.demoPerDay, 86_400_000);
    return ok ? { ok: true } : busy;
  }
  if (upstash) {
    const [h, d] = await Promise.all([upstash.hour.limit(ip), upstash.day.limit(ip)]);
    if (!h.success || !d.success) return { ok: false, message: `You can generate ${LIMITS.perHour} guides an hour and ${LIMITS.perDay} a day. Try again later.` };
    const g = await upstash.global.limit("all");
    return g.success ? { ok: true } : busy;
  }
  if (!memHit(`h:${ip}`, LIMITS.perHour, 3_600_000) || !memHit(`d:${ip}`, LIMITS.perDay, 86_400_000)) {
    return { ok: false, message: `You can generate ${LIMITS.perHour} guides an hour and ${LIMITS.perDay} a day. Try again later.` };
  }
  return memHit("global", LIMITS.globalPerDay, 86_400_000) ? { ok: true } : busy;
}
