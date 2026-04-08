export interface VersionCache {
  latest: string;
  checked_at: number;
}

export function getCachePath(): string {
  return "";
}

export function readVersionCache(_cachePath?: string): VersionCache | null {
  return undefined as any;
}

export function writeVersionCache(_latest: string, _cachePath?: string): void {
  // stub
}

export function isCacheStale(_cache: VersionCache | null): boolean {
  return undefined as any;
}

export function spawnBackgroundRefresh(_cachePath?: string): void {
  // stub
}

export function getUpdateNotification(_cache: VersionCache | null): string | null {
  return undefined as any;
}
