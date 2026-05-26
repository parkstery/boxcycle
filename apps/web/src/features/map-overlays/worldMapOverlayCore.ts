import {
  mergeActivityWorldDots,
  type ActivityWorldRawOverlay,
} from "../../lib/activityWorldLod";
import type { CourseActivityMapOverlay } from "../../hooks/useCourseActivityMapOverlay";

export type WorldMapOverlaySlice = CourseActivityMapOverlay;

/** catalog·publication 에 pulse line 이 없을 때 liveCourseRides route 로 gap-fill (dot 없음) */
function mergeLiveCourseRideGapFill(
  base: WorldMapOverlaySlice,
  live: WorldMapOverlaySlice,
): WorldMapOverlaySlice {
  if (
    live.pulseDots.length === 0 &&
    live.pulseRoutes.length === 0 &&
    live.heatDots.length === 0 &&
    live.heatRoutes.length === 0
  ) {
    return base;
  }

  const pulseIds = new Set([
    ...base.pulseDots.map((d) => d.courseId),
    ...base.pulseRoutes.map((r) => r.courseId),
  ]);
  const heatIds = new Set([
    ...base.heatDots.map((d) => d.courseId),
    ...base.heatRoutes.map((r) => r.courseId),
  ]);

  return {
    pulseDots: mergeActivityWorldDots(
      base.pulseDots,
      live.pulseDots.filter((d) => !pulseIds.has(d.courseId)),
    ),
    pulseRoutes: [
      ...base.pulseRoutes,
      ...live.pulseRoutes.filter((r) => !pulseIds.has(r.courseId)),
    ],
    heatDots: mergeActivityWorldDots(
      base.heatDots,
      live.heatDots.filter((d) => !heatIds.has(d.courseId)),
    ),
    heatRoutes: [
      ...base.heatRoutes,
      ...live.heatRoutes.filter((r) => !heatIds.has(r.courseId)),
    ],
  };
}

export type ResolveWorldMapOverlayInput = {
  /** 추적 중인 코스 — active 오버레이가 heat/catalog 중복 제거에 사용 */
  trackedCourseId: string | null;
  active: WorldMapOverlaySlice;
  catalog: WorldMapOverlaySlice;
  publication: WorldMapOverlaySlice;
  /** `liveCourseRides` 직접 합성 — courseActivity 지연 시 **line** gap-fill (dot 은 global livePresence) */
  liveCourseRides?: WorldMapOverlaySlice;
  /** true면 publication 우선 + catalog gap-fill (전면 0 덮어쓰기 금지) */
  publicationPresenceWorldMapEnabled: boolean;
};

function filterHeatByTracked(
  slice: WorldMapOverlaySlice,
  tracked: string,
  activeCoversTracked: boolean,
): Pick<WorldMapOverlaySlice, "heatRoutes" | "heatDots"> {
  if (!activeCoversTracked) {
    return { heatRoutes: slice.heatRoutes, heatDots: slice.heatDots };
  }
  return {
    heatRoutes: slice.heatRoutes.filter((r) => r.courseId !== tracked),
    heatDots: slice.heatDots.filter((d) => d.courseId !== tracked),
  };
}

/**
 * Activity World 지도 raw overlay — 단일 merge 진실.
 * publication 모드: L1/L2 = publicationPresence only (dot·line, catalog gap-fill 없음).
 */
export function resolveWorldMapOverlay(input: ResolveWorldMapOverlayInput): ActivityWorldRawOverlay {
  const {
    trackedCourseId,
    active,
    catalog,
    publication,
    liveCourseRides = {
      pulseRoutes: [],
      heatRoutes: [],
      pulseDots: [],
      heatDots: [],
    },
    publicationPresenceWorldMapEnabled,
  } = input;

  const tracked = trackedCourseId?.trim() ?? "";
  const activeCoversTracked =
    Boolean(tracked) &&
    (active.heatDots.length > 0 ||
      active.heatRoutes.length > 0 ||
      active.pulseDots.length > 0 ||
      active.pulseRoutes.length > 0);

  const catalogHeat = filterHeatByTracked(catalog, tracked, activeCoversTracked);

  const baseSlice = publicationPresenceWorldMapEnabled
    ? {
        pulseDots: publication.pulseDots,
        pulseRoutes: publication.pulseRoutes,
        heatDots: publication.heatDots,
        heatRoutes: publication.heatRoutes,
      }
    : {
        pulseRoutes: catalog.pulseRoutes,
        heatRoutes: catalogHeat.heatRoutes,
        pulseDots: catalog.pulseDots,
        heatDots: catalogHeat.heatDots,
      };

  const worldSlice = publicationPresenceWorldMapEnabled
    ? baseSlice
    : mergeLiveCourseRideGapFill(baseSlice, liveCourseRides);

  return {
    pulseRoutes: [...active.pulseRoutes, ...worldSlice.pulseRoutes],
    heatRoutes: [...active.heatRoutes, ...worldSlice.heatRoutes],
    pulseDots: mergeActivityWorldDots(active.pulseDots, worldSlice.pulseDots),
    heatDots: mergeActivityWorldDots(active.heatDots, worldSlice.heatDots),
  };
}

/** DEV 회귀 — publication 모드 dot/catalog·liveCourseRides 격리 */
export function runWorldMapOverlayMergeChecks(): void {
  const catalog: WorldMapOverlaySlice = {
    pulseDots: [{ courseId: "c1", lngLat: [0, 0], pulseLevel: 1, kind: "pulse", traceStrength: 1 }],
    pulseRoutes: [],
    heatDots: [],
    heatRoutes: [],
  };
  const emptyPub: WorldMapOverlaySlice = {
    pulseDots: [],
    pulseRoutes: [],
    heatDots: [],
    heatRoutes: [],
  };
  const mergedEmptyPub = resolveWorldMapOverlay({
    trackedCourseId: null,
    active: emptyPub,
    catalog,
    publication: emptyPub,
    publicationPresenceWorldMapEnabled: true,
  });
  if (mergedEmptyPub.pulseDots.length !== 0) {
    throw new Error("publication mode: catalog dots must not merge when publication empty");
  }

  const pubWithDot: WorldMapOverlaySlice = {
    pulseDots: [{ courseId: "c1", lngLat: [1, 1], pulseLevel: 2, kind: "pulse", traceStrength: 1 }],
    pulseRoutes: [],
    heatDots: [],
    heatRoutes: [],
  };
  const mergedWithPub = resolveWorldMapOverlay({
    trackedCourseId: null,
    active: emptyPub,
    catalog,
    publication: pubWithDot,
    publicationPresenceWorldMapEnabled: true,
  });
  if (mergedWithPub.pulseDots.length !== 1) {
    throw new Error("publication mode: single publication dot expected");
  }
  if (mergedWithPub.pulseDots[0]!.lngLat[0] !== 1) {
    throw new Error("publication mode: catalog dot must not override publication");
  }

  const catalogWithRoute: WorldMapOverlaySlice = {
    pulseDots: [],
    pulseRoutes: [
      {
        courseId: "c1",
        geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
        kind: "pulse",
        traceStrength: 1,
      },
    ],
    heatDots: [],
    heatRoutes: [],
  };
  const mergedRoutes = resolveWorldMapOverlay({
    trackedCourseId: null,
    active: emptyPub,
    catalog: catalogWithRoute,
    publication: emptyPub,
    publicationPresenceWorldMapEnabled: true,
  });
  if (mergedRoutes.pulseRoutes.length !== 0) {
    throw new Error("publication mode: catalog routes must not gap-fill");
  }
}
