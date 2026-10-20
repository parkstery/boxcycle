import type { LineStringGeometry } from "../geo/geo";
import { buildConquestRoutePieces } from "./conquestTiles";
import { buildNewRoadGeometryFromRoute } from "./conquestNewRoadGeometry";

export type RecentRoadDisplay = { day: string; geometry: LineStringGeometry[] };
export function conquestDay(iso: string | number = Date.now()): string {
  return new Date(new Date(iso).getTime() + 9 * 3600000).toISOString().slice(0, 10);
}

/** Server acquisition dates are YYYY-MM-DD; accept compact legacy fixtures too. */
export function normalizeAcquisitionDay(day: string): string {
  const iso = /^\d{8}$/.test(day) ? `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}` : day;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const parsed = Date.parse(`${iso}T00:00:00Z`);
  return Number.isFinite(parsed) && new Date(parsed).toISOString().slice(0, 10) === iso ? iso : "";
}

/** Legacy records have acquisition dates per cell, but their traces include old roads too. */
export function restoreRecentRoadDisplay(
  cells: ReadonlyMap<string, string>,
  traces: readonly { day?: string; geometry: LineStringGeometry }[],
): RecentRoadDisplay | null {
  const day = [...cells.values()].map(normalizeAcquisitionDay).filter(Boolean).sort().at(-1);
  if (!day) return null;
  const geometry: LineStringGeometry[] = [];
  for (const trace of traces) {
    if (normalizeAcquisitionDay(trace.day ?? "") !== day) continue;
    let current: LineStringGeometry | null = null;
    for (const piece of buildConquestRoutePieces(trace.geometry, Infinity)) {
      if (normalizeAcquisitionDay(cells.get(piece.cellId) ?? "") !== day) { current = null; continue; }
      const last = current?.coordinates.at(-1);
      if (current && last && Math.abs(last[0] - piece.start[0]) < 1e-9 && Math.abs(last[1] - piece.start[1]) < 1e-9) {
        current.coordinates.push(piece.end);
      } else {
        current = { type: "LineString", coordinates: [piece.start, piece.end] };
        geometry.push(current);
      }
    }
  }
  return geometry.length ? { day, geometry } : null;
}

export type RecentRoadInput = {
  uid: string | null;
  active: boolean;
  persisted: RecentRoadDisplay | null;
  cellIds: readonly string[] | null;
  route: LineStringGeometry | null;
  traveled: number;
  from: number;
  ended: { recordId: string; endedAtIso: string; sessionPathLngLat?: [number, number][] | null } | null;
};

/** Session state survives meter reset and result sheet dismissal; each ride replaces its own entry. */
export class RecentRoadDisplaySession {
  private uid: string | null = null;
  private active = false;
  private owned: Set<string> | null = null;
  private candidate: LineStringGeometry[] = [];
  private endedCandidate: LineStringGeometry[] = [];
  private day = "";
  private recordId: string | null = null;
  private resolved = false;
  private base: RecentRoadDisplay | null = null;
  private confirmed = new Map<string, RecentRoadDisplay>();

  advance(input: RecentRoadInput): LineStringGeometry[] {
    if (input.uid !== this.uid) {
      this.uid = input.uid;
      this.active = false;
      this.candidate = [];
      this.endedCandidate = [];
      this.owned = null;
      this.recordId = null;
      this.resolved = false;
      this.base = null;
      this.confirmed.clear();
    }
    if (!input.uid) return [];
    const persistedDay = normalizeAcquisitionDay(input.persisted?.day ?? "");
    if (input.persisted && persistedDay && (!this.base || persistedDay >= this.base.day)) {
      this.base = { ...input.persisted, day: persistedDay };
    }
    if (input.active && !this.active) {
      this.owned = input.cellIds ? new Set(input.cellIds) : null;
      this.candidate = [];
      this.endedCandidate = [];
      this.recordId = null;
      this.resolved = false;
      this.day = conquestDay();
    }
    if (input.active) {
      this.owned ??= input.cellIds ? new Set(input.cellIds) : null;
      if (input.route && this.owned) this.candidate = buildNewRoadGeometryFromRoute({
        geometry: input.route, traveledMeters: input.traveled, fromMeters: input.from, ownedAtStart: this.owned,
      }).segments;
    } else if (input.ended && !this.resolved) {
      this.recordId = input.ended.recordId;
      this.day = conquestDay(input.ended.endedAtIso);
      const path = input.ended.sessionPathLngLat;
      // Ending resets live metrics before effects run. Use the frozen end-of-ride path.
      if (this.active && path && path.length >= 2 && this.owned) this.candidate = buildNewRoadGeometryFromRoute({
        geometry: { type: "LineString", coordinates: path }, ownedAtStart: this.owned,
      }).segments;
      if (this.active) this.endedCandidate = this.candidate;
    }
    this.active = input.active;
    return this.geometry();
  }

  result(recordId: string, result: { status: string; newMeters: number; day?: string; newGeometry?: LineStringGeometry[] }): LineStringGeometry[] {
    if (this.active || recordId !== this.recordId) return this.geometry();
    if (result.status === "positive") {
      let remaining = result.newMeters;
      const previous = this.confirmed.get(recordId)?.geometry ?? this.endedCandidate;
      const geometry = result.newGeometry ?? previous.flatMap((segment) => {
        const clipped = buildNewRoadGeometryFromRoute({ geometry: segment, ownedAtStart: new Set(), maxNewMeters: remaining });
        remaining -= clipped.meters;
        return clipped.segments;
      });
      this.confirmed.set(recordId, { day: normalizeAcquisitionDay(result.day ?? "") || this.day, geometry });
      this.candidate = [];
      this.resolved = true;
    } else if (result.status === "confirmed_zero" || result.status === "error") {
      this.confirmed.delete(recordId);
      this.candidate = [];
      this.resolved = true;
    }
    return this.geometry();
  }

  timeout(recordId: string): LineStringGeometry[] {
    if (!this.resolved && recordId === this.recordId) this.candidate = [];
    return this.geometry();
  }

  private geometry(): LineStringGeometry[] {
    const sources = [...this.confirmed.values()];
    if (this.base) sources.push(this.base);
    if (this.candidate.length) sources.push({ day: this.day, geometry: this.candidate });
    const day = sources.map((s) => s.day).sort().at(-1);
    return [...new Map(sources.filter((s) => s.day === day).flatMap((s) => s.geometry).map((g) => [JSON.stringify(g.coordinates), g])).values()];
  }
}
