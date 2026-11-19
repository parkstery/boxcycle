import type { LineStringGeometry } from "../geo/geo";

export type RoadSyncToken = { schema: 1; epoch: string; version: number };
export type RoadChunk = { id: string; cells: Record<string, string> };
export type RoadTrace = { id: string; geometry: LineStringGeometry; newMeters: number; day?: string };
export type RoadData = { chunks: RoadChunk[]; traces: RoadTrace[] };
export type RoadCache = RoadData & { uid: string; token: RoadSyncToken };

export function parseRoadSyncToken(value: unknown): RoadSyncToken | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<RoadSyncToken>;
  return v.schema === 1 && typeof v.epoch === "string" && v.epoch.length > 0 &&
    Number.isSafeInteger(v.version) && (v.version ?? 0) >= 1
    ? { schema: 1, epoch: v.epoch, version: v.version! } : null;
}

/** An older writer changes the parent timestamp without updating roadSync.
 * Such a mixed deployment is not a valid incremental baseline, even if its
 * epoch/version happen to match a cached one. */
export function parseRoadSummaryToken(data: Record<string, unknown> | undefined): RoadSyncToken | null {
  const token = parseRoadSyncToken(data?.roadSync);
  const sync = data?.roadSync as Record<string, unknown> | undefined;
  const parentTime = data?.updatedAt as { seconds?: unknown; nanoseconds?: unknown } | undefined;
  const syncTime = sync?.updatedAt as typeof parentTime;
  return token && parentTime && syncTime && Number.isSafeInteger(parentTime.seconds) &&
    Number.isSafeInteger(parentTime.nanoseconds) && parentTime.seconds === syncTime.seconds &&
    parentTime.nanoseconds === syncTime.nanoseconds ? token : null;
}

export function roadSyncKey(token: RoadSyncToken | null): string {
  return token ? JSON.stringify([token.epoch, token.version]) : "legacy";
}

/** Fixed-width version within an epoch: one automatically indexed range field. */
export function roadSyncCursor(token: RoadSyncToken, version = token.version): string {
  return `${token.epoch}:${String(version).padStart(16, "0")}`;
}

export function validRoadCache(value: unknown, uid: string): value is RoadCache {
  if (!value || typeof value !== "object") return false;
  const v = value as RoadCache;
  return v.uid === uid && parseRoadSyncToken(v.token) !== null &&
    Array.isArray(v.chunks) && v.chunks.every(c => c && typeof c.id === "string" && c.cells &&
      typeof c.cells === "object" && !Array.isArray(c.cells) && Object.values(c.cells).every(day => typeof day === "string")) &&
    Array.isArray(v.traces) && v.traces.every(t => t && typeof t.id === "string" &&
      Number.isFinite(t.newMeters) && (t.day === undefined || typeof t.day === "string") &&
      t.geometry?.type === "LineString" && Array.isArray(t.geometry.coordinates) &&
      t.geometry.coordinates.length >= 2 && t.geometry.coordinates.every(p =>
        Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)));
}

function replaceById<T extends { id: string }>(previous: T[], changed: T[]): T[] {
  const rows = new Map(previous.map(row => [row.id, row]));
  for (const row of changed) rows.set(row.id, row);
  return [...rows.values()];
}

type RoadSyncPorts = {
  readCache: () => Promise<unknown>;
  writeCache: (value: RoadCache) => Promise<void>;
  dropCache: () => Promise<void>;
  readRemote: (sinceVersion: number | null, token: RoadSyncToken | null) => Promise<RoadData>;
  readToken: () => Promise<RoadSyncToken | null>;
};

/** Only publish a cache when the parent still identifies the version we read.
 * Deletes/corrections must rotate epoch; normal writes update documents and parent
 * version in one transaction. A changed epoch always replaces the whole cache. */
export async function syncConquestRoadData(uid: string, initialToken: RoadSyncToken | null, ports: RoadSyncPorts): Promise<RoadData> {
  const stored = await ports.readCache();
  const cached = validRoadCache(stored, uid) ? stored : null;
  if (!initialToken) {
    await ports.dropCache();
    return ports.readRemote(null, null); // old server / missing parent: never trust an old cache
  }
  let token = initialToken;
  for (let attempt = 0; attempt < 3; attempt++) {
    const sameEpoch = cached?.token.epoch === token.epoch;
    if (sameEpoch && cached.token.version === token.version) return cached;
    const incremental = sameEpoch && cached.token.version < token.version;
    const remote = await ports.readRemote(incremental ? cached.token.version : null, token);
    const confirmed = await ports.readToken();
    if (!confirmed) {
      await ports.dropCache();
      // A reset may have deleted the parent while data was being read. Do not
      // restore any pre-reset records into a newer session.
      throw new Error("conquest/summary-changed");
    }
    if (roadSyncKey(confirmed) !== roadSyncKey(token)) { token = confirmed; continue; }
    const next: RoadCache = {
      uid, token,
      chunks: incremental ? replaceById(cached.chunks, remote.chunks) : remote.chunks,
      traces: incremental ? replaceById(cached.traces, remote.traces) : remote.traces,
    };
    await ports.writeCache(next);
    return next;
  }
  throw new Error("conquest/summary-changing: retry after the next summary update");
}
