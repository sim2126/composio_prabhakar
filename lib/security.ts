import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import net from "node:net";

// ---- Input ----------------------------------------------------------------------

export type CleanInput = { ok: true; value: string; host: string | null } | { ok: false; error: string };

export function cleanAppInput(raw: unknown): CleanInput {
  if (typeof raw !== "string") return { ok: false, error: "Enter an app name or URL." };
  // Strip control characters and collapse whitespace; keep it short.
  const value = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (value.length < 2) return { ok: false, error: "Enter an app name or URL." };
  if (value.length > 100) return { ok: false, error: "That is longer than an app name. Try just the name or its website." };
  if (/^(javascript|data|file|vbscript|about|blob|chrome|ftp|mailto|tel|ssh|ws|wss):/i.test(value)) return { ok: false, error: "Enter an app name or its website." };
  if (/(^|\/\/|@)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1?\])(:\d+)?(\/|$)/i.test(value)) return { ok: false, error: "That address is not a public website." };
  let host: string | null = null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+(\/|$)/.test(value)) {
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
      if (!["http:", "https:"].includes(u.protocol)) return { ok: false, error: "Only web addresses (http or https) are supported." };
      host = u.hostname.toLowerCase().replace(/^www\./, "");
      if (isPrivateHost(host)) return { ok: false, error: "That address is not a public website." };
    } catch {
      host = null;
    }
  }
  return { ok: true, value, host };
}

// ---- Outbound requests from probes ---------------------------------------------------

function isPrivateHost(host: string): boolean {
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (!host.includes(".")) return true;
  return net.isIP(host) !== 0 && isPrivateIp(host);
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:127.") || v.startsWith("::ffff:10.") || v.startsWith("::ffff:192.168.");
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export type SafeResponse = { status: number; contentType: string; body: string; location: string | null };

// HTTPS only, public addresses only, no redirects followed, 5 s timeout, 64 KB cap.
export async function safeFetch(url: string, init: RequestInit = {}): Promise<SafeResponse> {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("only https is allowed");
  const host = u.hostname.toLowerCase();
  if (net.isIP(host) !== 0 || isPrivateHost(host)) throw new Error("host not allowed");
  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new Error("host resolves to a private address");
  const res = await fetch(u, { ...init, redirect: "manual", signal: AbortSignal.timeout(5000), headers: { "user-agent": "PreflightProbe/1.0", ...(init.headers || {}) } });
  const reader = res.body?.getReader();
  let body = "";
  if (reader) {
    const decoder = new TextDecoder();
    let total = 0;
    while (total < 65536) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      body += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => undefined);
  }
  return { status: res.status, contentType: res.headers.get("content-type") ?? "", body: body.slice(0, 65536), location: res.headers.get("location") };
}

// ---- Signing the research bundle between stages -------------------------------------

function secret(): string {
  const s = process.env.PREFLIGHT_SECRET || process.env.ANTHROPIC_API_KEY;
  if (!s) throw new Error("PREFLIGHT_SECRET is not set");
  return createHash("sha256").update("preflight:" + s).digest("hex");
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function verify(payload: string, signature: unknown): boolean {
  if (typeof signature !== "string" || signature.length !== 64) return false;
  const expected = Buffer.from(sign(payload), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || req.headers.get("x-real-ip") || "local").trim();
}
