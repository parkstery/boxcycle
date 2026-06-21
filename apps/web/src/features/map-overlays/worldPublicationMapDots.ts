import type { ActivityWorldMapDot, ActivityWorldRawOverlay } from "../../lib/activityWorldLod";
import { mergeActivityWorldDots } from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "../../lib/activityWorldTraceStyle";
import type { LineStringGeometry } from "../../lib/geo";
import { distanceMidpointLngLat } from "../../lib/routeGeometryMidpoint";

/** @deprecated publication world mode 전용 — catalog 모드에서는 사용 안 함 */
export function buildBasicHubWorldPulseDots(): ActivityWorldMapDot[] {
  return [];
}

/** 주행 중 publication world mode — 로컬 midpoint 1개 */
export function buildLocalRidePublicationPulseDot(
  publicationId: string | null | undefined,
  routeGeometry: LineStringGeometry | null | undefined,
): ActivityWorldMapDot | null {
  const id = publicationId?.trim() ?? "";
  if (!id || !routeGeometry?.coordinates?.length) return null;
  const lngLat = distanceMidpointLngLat(routeGeometry.coordinates);
  if (!lngLat) return null;
  return {
    publicationId: id,
    lngLat,
    pulseLevel: 1,
    kind: "pulse",
    traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
  };
}

export function mergePublicationWorldPulseDots(input: {
  serverPulseDots: readonly ActivityWorldMapDot[];
  serverHeatDots: readonly ActivityWorldMapDot[];
  publicationWorldMapEnabled: boolean;
  isRideSessionActive: boolean;
  trackedPublicationId: string | null;
  routeGeometry: LineStringGeometry | null;
}): { pulseDots: ActivityWorldMapDot[]; heatDots: ActivityWorldMapDot[] } {
  const {
    serverPulseDots,
    serverHeatDots,
    publicationWorldMapEnabled,
    isRideSessionActive,
    trackedPublicationId,
    routeGeometry,
  } = input;

  if (!publicationWorldMapEnabled) {
    return { pulseDots: [...serverPulseDots], heatDots: [...serverHeatDots] };
  }

  let pulse = mergeActivityWorldDots([], serverPulseDots);

  if (isRideSessionActive) {
    const local = buildLocalRidePublicationPulseDot(trackedPublicationId, routeGeometry);
    if (local) pulse = mergeActivityWorldDots(pulse, [local]);
  }

  return { pulseDots: pulse, heatDots: [...serverHeatDots] };
}

/** MapView 전달 직전 — fallback dot 없음 activity 없으면 빈 overlay */
export function ensureWorldActivityMinimumDots(
  raw: ActivityWorldRawOverlay,
  _opts: {
    mapSessionActive: boolean;
    isRideSessionActive: boolean;
    trackedPublicationId: string | null;
    routeGeometry: LineStringGeometry | null;
  },
): ActivityWorldRawOverlay {
  return raw;
}

export function runWorldPublicationMapDotsChecks(): void {
  const merged = mergePublicationWorldPulseDots({
    serverPulseDots: [],
    serverHeatDots: [],
    publicationWorldMapEnabled: false,
    isRideSessionActive: false,
    trackedPublicationId: null,
    routeGeometry: null,
  });
  if (merged.pulseDots.length !== 0 || merged.heatDots.length !== 0) {
    throw new Error("catalog mode merge must pass through server dots only");
  }
  const guarded = ensureWorldActivityMinimumDots(
    { pulseRoutes: [], heatRoutes: [], pulseDots: [], heatDots: [] },
    { mapSessionActive: true, isRideSessionActive: false, trackedPublicationId: null, routeGeometry: null },
  );
  if (guarded.pulseDots.length !== 0) {
    throw new Error("ensureWorldActivityMinimumDots must not inject fallback dots");
  }
}
