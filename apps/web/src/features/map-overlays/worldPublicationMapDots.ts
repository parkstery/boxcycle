import type { ActivityWorldMapDot } from "../../lib/activityWorldLod";
import { mergeActivityWorldDots } from "../../lib/activityWorldLod";
import { ACTIVITY_TRACE_LIVE_STRENGTH } from "../../lib/activityWorldTraceStyle";
import { BASIC_SHARED_HUB_IDS, getBasicHubCoursePayload } from "../../lib/firestoreCourses";
import type { LineStringGeometry } from "../../lib/geo";
import { distanceMidpointLngLat } from "../../lib/routeGeometryMidpoint";

/** 입문 허브 — `publicationPresence` 미동기화·CF 미배포 시에도 월드 geography 앵커 */
export function buildBasicHubWorldPulseDots(): ActivityWorldMapDot[] {
  const out: ActivityWorldMapDot[] = [];
  for (const id of BASIC_SHARED_HUB_IDS) {
    const coords = getBasicHubCoursePayload(id).geometry?.coordinates;
    if (!coords?.length) continue;
    const lngLat = distanceMidpointLngLat(coords);
    if (!lngLat) continue;
    out.push({
      courseId: id,
      lngLat,
      pulseLevel: 1,
      kind: "pulse",
      traceStrength: ACTIVITY_TRACE_LIVE_STRENGTH,
    });
  }
  return out;
}

/** 주행 중 — 서버 문서 전 `publicationPresence` 와 무관하게 L2 midpoint 1개 보장 */
export function buildLocalRidePublicationPulseDot(
  publicationId: string | null | undefined,
  routeGeometry: LineStringGeometry | null | undefined,
): ActivityWorldMapDot | null {
  const id = publicationId?.trim() ?? "";
  if (!id || !routeGeometry?.coordinates?.length) return null;
  const lngLat = distanceMidpointLngLat(routeGeometry.coordinates);
  if (!lngLat) return null;
  return {
    courseId: id,
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
  trackedCourseId: string | null;
  routeGeometry: LineStringGeometry | null;
}): { pulseDots: ActivityWorldMapDot[]; heatDots: ActivityWorldMapDot[] } {
  const {
    serverPulseDots,
    serverHeatDots,
    publicationWorldMapEnabled,
    isRideSessionActive,
    trackedCourseId,
    routeGeometry,
  } = input;

  if (!publicationWorldMapEnabled) {
    return { pulseDots: [...serverPulseDots], heatDots: [...serverHeatDots] };
  }

  let pulse = mergeActivityWorldDots([], serverPulseDots);

  if (isRideSessionActive) {
    const local = buildLocalRidePublicationPulseDot(trackedCourseId, routeGeometry);
    if (local) pulse = mergeActivityWorldDots(pulse, [local]);
  }

  if (pulse.length === 0) {
    pulse = mergeActivityWorldDots(pulse, buildBasicHubWorldPulseDots());
  }

  return { pulseDots: pulse, heatDots: [...serverHeatDots] };
}

export function runWorldPublicationMapDotsChecks(): void {
  if (buildBasicHubWorldPulseDots().length < 1) {
    throw new Error("basic hub fallback must produce at least one dot");
  }
  const merged = mergePublicationWorldPulseDots({
    serverPulseDots: [],
    serverHeatDots: [],
    publicationWorldMapEnabled: true,
    isRideSessionActive: false,
    trackedCourseId: null,
    routeGeometry: null,
  });
  if (merged.pulseDots.length < 1) {
    throw new Error("publication world merge must yield pulse dots");
  }
}
