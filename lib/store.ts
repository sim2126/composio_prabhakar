import { Redis } from "@upstash/redis";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// Upstash Redis when configured (Vercel's Upstash integration sets KV_REST_API_*),
// otherwise JSON files under .data/ for local development.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const redis = url && token ? new Redis({ url, token }) : null;

// Serverless deployments have a read-only project directory; /tmp is writable but per-instance.
const DIR = process.env.VERCEL ? path.join("/tmp", "preflight-data") : path.join(process.cwd(), ".data");
// Colons are not safe in Windows file names (NTFS treats them as alternate data streams).
const fileFor = (key: string) => path.join(DIR, key.replace(/[^a-z0-9_-]/gi, "_") + ".json");

export async function getJSON<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  try {
    return JSON.parse(await readFile(fileFor(key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function setJSON(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  if (redis) {
    if (ttlSeconds) await redis.set(key, value, { ex: ttlSeconds });
    else await redis.set(key, value);
    return;
  }
  await mkdir(DIR, { recursive: true });
  await writeFile(fileFor(key), JSON.stringify(value, null, 1));
}

// Set-if-absent with expiry; used as a per-app lock so duplicate submissions share one run.
const memLocks = new Map<string, number>();
export async function acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
  if (redis) return (await redis.set(key, "1", { nx: true, ex: ttlSeconds })) === "OK";
  const now = Date.now();
  const until = memLocks.get(key);
  if (until && until > now) return false;
  memLocks.set(key, now + ttlSeconds * 1000);
  return true;
}

export async function releaseLock(key: string): Promise<void> {
  if (redis) await redis.del(key);
  else memLocks.delete(key);
}
