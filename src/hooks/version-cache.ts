import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";
import { compareSemver } from "./version-check.ts";
import { createRequire } from "node:module";

export interface VersionCache {
  latest: string;
  checked_at: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REGISTRY_URL = "https://registry.npmjs.org/@kosoukhov/cht-cli/latest";

export function getCachePath(): string {
  const cacheHome = process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(cacheHome, "cht-cli", "version-check.json");
}

export function readVersionCache(cachePath?: string): VersionCache | null {
  try {
    const data = JSON.parse(readFileSync(cachePath ?? getCachePath(), "utf-8")) as VersionCache;
    if (!data.latest || !data.checked_at) return null;
    return data;
  } catch {
    return null; // D-22: silently skip missing or corrupt cache
  }
}

export function writeVersionCache(latest: string, cachePath?: string): void {
  const target = cachePath ?? getCachePath();
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify({ latest, checked_at: Date.now() }));
}

export function isCacheStale(cache: VersionCache | null): boolean {
  if (!cache) return true;
  return Date.now() - cache.checked_at > CACHE_TTL_MS;
}

export function spawnBackgroundRefresh(cachePath?: string): void {
  const target = cachePath ?? getCachePath();
  const script = [
    `const target = process.argv[2];`,
    `const r = await fetch("${REGISTRY_URL}", { signal: AbortSignal.timeout(5000) });`,
    `if (r.ok) {`,
    `  const d = await r.json();`,
    `  const fs = await import("node:fs");`,
    `  const path = await import("node:path");`,
    `  fs.mkdirSync(path.dirname(target), { recursive: true });`,
    `  fs.writeFileSync(target, JSON.stringify({ latest: d.version, checked_at: Date.now() }));`,
    `}`,
  ].join("\n");

  const child = spawn(process.execPath, ["--input-type=module", "-e", script, target], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function loadPackageVersion(): string {
  const req = createRequire(import.meta.url);
  try {
    return (req("../package.json") as { version: string }).version;
  } catch {
    return (req("../../package.json") as { version: string }).version;
  }
}

export function getUpdateNotification(cache: VersionCache | null): string | null {
  if (!cache) return null;
  const current = loadPackageVersion();
  if (compareSemver(current, cache.latest) >= 0) return null;
  return `${current} \u2192 ${cache.latest}`;
}
