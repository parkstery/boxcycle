import type { LngLat } from "../lib/geo";
import { getDistanceMeters } from "../lib/geo";

const GRAPH_IMAGES = "https://graph.mapillary.com/images";

const FIELDS =
  "id,geometry,compass_angle,computed_compass_angle,sequence,is_pano,width,height";

export const MAPILLARY_QUERY_PATH_INTERVAL_M = 12;

/** 경로 전방 샘플 거리(m) — 이른 히트 우선·옆도로 완화 */
export const MAPILLARY_STREET_LOOKAHEAD_SAMPLES_M: readonly number[] = [
  0, 10, 20, 32, 44, 56, 72, 88, 104, 128, 152, 180, 210, 240, 280, 300,
];

const MAX_HEADING_DIFF_DEG = 45;

export type MapillaryStreetCandidate = {
  id: string;
  lat: number;
  lng: number;
  compassAngle: number | null;
  sequenceId: string | null;
  isPano: boolean;
};

export type MapillaryStreetPick = MapillaryStreetCandidate & { sampleM: number };

export type MapillaryStreetSampleRow = { sampleM: number; pick: MapillaryStreetPick | null };

export function mapillaryStreetSearchRadiusM(speedKmh: number): number {
  const base = 16 + (Math.min(95, Math.max(0, speedKmh)) / 25) * 12;
  return Math.min(50, Math.max(10, base));
}

function parseSequenceId(seq: unknown): string | null {
  if (seq == null) return null;
  if (typeof seq === "string") return seq;
  if (typeof seq === "object" && "id" in seq && typeof (seq as { id: unknown }).id === "string") {
    return (seq as { id: string }).id;
  }
  return null;
}

function parseImageRow(row: unknown): MapillaryStreetCandidate | null {
  if (!row || typeof row !== "object") return null;
  const o = row as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  if (!id) return null;
  const geom = o.geometry as { type?: string; coordinates?: unknown } | undefined;
  if (!geom || geom.type !== "Point" || !Array.isArray(geom.coordinates)) return null;
  const c = geom.coordinates as number[];
  if (c.length < 2 || Number.isNaN(c[0]) || Number.isNaN(c[1])) return null;
  const lng = c[0];
  const lat = c[1];
  const comp = o.computed_compass_angle;
  const rawCompass = o.compass_angle;
  let compassAngle: number | null = null;
  if (typeof comp === "number" && Number.isFinite(comp)) compassAngle = comp;
  else if (typeof rawCompass === "number" && Number.isFinite(rawCompass)) compassAngle = rawCompass;
  const isPano = o.is_pano === true;
  return {
    id,
    lat,
    lng,
    compassAngle,
    sequenceId: parseSequenceId(o.sequence),
    isPano,
  };
}

export async function fetchMapillaryStreetCandidates(
  accessToken: string,
  lat: number,
  lng: number,
  radiusM: number,
  opts?: { signal?: AbortSignal; limit?: number },
): Promise<MapillaryStreetCandidate[]> {
  const limit = opts?.limit ?? 12;
  const u = new URL(GRAPH_IMAGES);
  u.searchParams.set("access_token", accessToken);
  u.searchParams.set("fields", FIELDS);
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lng", String(lng));
  u.searchParams.set("radius", String(Math.round(radiusM)));
  u.searchParams.set("limit", String(limit));
  const res = await fetch(u.toString(), { signal: opts?.signal });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: unknown[] };
  const rows = Array.isArray(json.data) ? json.data : [];
  const out: MapillaryStreetCandidate[] = [];
  for (const row of rows) {
    const p = parseImageRow(row);
    if (p) out.push(p);
  }
  return out;
}

function headingDiffDeg(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function pickMapillaryStreetCandidate(
  candidates: MapillaryStreetCandidate[],
  queryLngLat: LngLat,
  driveHeadingDeg: number | null,
): MapillaryStreetCandidate | null {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  const [qLng, qLat] = queryLngLat;

  if (driveHeadingDeg == null) {
    let best = candidates[0];
    let bestD = Infinity;
    for (const c of candidates) {
      const d = getDistanceMeters([qLng, qLat], [c.lng, c.lat]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  const aligned = candidates.filter(
    (c) =>
      c.compassAngle != null && headingDiffDeg(c.compassAngle, driveHeadingDeg) <= MAX_HEADING_DIFF_DEG,
  );
  const pool = aligned.length ? aligned : candidates;

  let best = pool[0];
  let bestScore = Infinity;
  for (const c of pool) {
    const dist = getDistanceMeters([qLng, qLat], [c.lng, c.lat]);
    let score = dist;
    if (c.compassAngle != null) {
      score += headingDiffDeg(c.compassAngle, driveHeadingDeg) * 0.35;
    } else {
      score += 12;
    }
    if (score < bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

export async function queryMapillaryAlongPathSamples(
  accessToken: string,
  sampleLngLats: { sampleM: number; lngLat: LngLat }[],
  opts: { signal?: AbortSignal; speedKmH: number; driveHeadingDeg: number | null },
): Promise<MapillaryStreetSampleRow[]> {
  const radius = mapillaryStreetSearchRadiusM(opts.speedKmH);
  const rows = await Promise.all(
    sampleLngLats.map(async ({ sampleM, lngLat }) => {
      const cands = await fetchMapillaryStreetCandidates(
        accessToken,
        lngLat[1],
        lngLat[0],
        radius,
        { signal: opts.signal },
      );
      const pickRaw = pickMapillaryStreetCandidate(cands, lngLat, opts.driveHeadingDeg);
      const pick = pickRaw ? { ...pickRaw, sampleM } : null;
      return { sampleM, pick };
    }),
  );
  return rows;
}

export type ChooseAlongPathInput = {
  rows: MapillaryStreetSampleRow[];
  dismissedId: string | null;
  prevPick: MapillaryStreetPick | null;
  riderLngLat: LngLat;
  maxGpsJumpM?: number;
  stalePrevRiderDistM?: number;
};

export function chooseMapillaryPickAlongPath(input: ChooseAlongPathInput): MapillaryStreetPick | null {
  const { rows, dismissedId, prevPick, riderLngLat } = input;
  const maxGpsJumpM = input.maxGpsJumpM ?? 58;
  const stalePrevRiderDistM = input.stalePrevRiderDistM ?? 70;
  const hits = rows.filter((r): r is MapillaryStreetSampleRow & { pick: MapillaryStreetPick } => r.pick != null);
  if (!hits.length) return null;

  const minSample = Math.min(...hits.map((h) => h.sampleM));
  const envelope = minSample + 48;

  const inEnvelope = hits.filter((h) => h.sampleM <= envelope);
  const pool = inEnvelope.length ? inEnvelope : hits;

  let prevEffective = prevPick;
  if (prevPick) {
    const dRider = getDistanceMeters(riderLngLat, [prevPick.lng, prevPick.lat]);
    if (dRider >= stalePrevRiderDistM) prevEffective = null;
  }

  let best: MapillaryStreetPick | null = null;
  let bestScore = Infinity;

  for (const { pick } of pool) {
    if (!pick || pick.id === dismissedId) continue;
    let score = pick.sampleM * 0.85;

    const distRider = getDistanceMeters(riderLngLat, [pick.lng, pick.lat]);
    score += Math.min(maxGpsJumpM, distRider) * 0.12;

    if (prevEffective) {
      const seqBonus = pick.sequenceId && pick.sequenceId === prevEffective.sequenceId ? -18 : 0;
      const sameId = pick.id === prevEffective.id ? -25 : 0;
      const jump = getDistanceMeters([pick.lng, pick.lat], [prevEffective.lng, prevEffective.lat]);
      score += Math.min(120, jump) * 0.08 + seqBonus + sameId;
    }

    if (score < bestScore) {
      bestScore = score;
      best = pick;
    }
  }
  return best;
}
