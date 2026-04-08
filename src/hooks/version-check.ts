import { createRequire } from "node:module";

const REGISTRY_URL = "https://registry.npmjs.org/@kosoukhov/cht-cli/latest";
const TIMEOUT_MS = 5000;

export interface VersionInfo {
  current: string;
  latest: string;
  upToDate: boolean;
}

function loadPackageVersion(): string {
  const req = createRequire(import.meta.url);
  // From dist/cht.js (tsup bundle): "../package.json" resolves to project root
  // From src/hooks/version-check.ts (dev/test): need "../../package.json"
  try {
    return (req("../package.json") as { version: string }).version;
  } catch {
    return (req("../../package.json") as { version: string }).version;
  }
}

/**
 * Fetch latest version from npm registry and compare with installed version.
 * Throws on network error or timeout (single attempt, no retry).
 */
export async function checkLatestVersion(): Promise<VersionInfo> {
  const current = loadPackageVersion();

  const res = await fetch(REGISTRY_URL, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as { version: string };
  if (typeof data.version !== "string" || !data.version) {
    throw new Error("Invalid registry response: missing version field");
  }
  const latest = data.version;

  return {
    current,
    latest,
    upToDate: compareSemver(current, latest) >= 0,
  };
}

/** Compare two semver strings (major.minor.patch only). Returns 1, 0, or -1. */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) =>
    v.split("-")[0].split(".").map((s) => {
      const n = Number(s);
      return Number.isNaN(n) ? 0 : n;
    });
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}
