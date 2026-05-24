import {
  mergeActivityWorldDots,
  type ActivityWorldRawOverlay,
} from "../../lib/activityWorldLod";
import type { CourseActivityMapOverlay } from "../../hooks/useCourseActivityMapOverlay";

export type WorldMapOverlaySlice = CourseActivityMapOverlay;

/** catalog·publication 에 pulse 가 없을 때 liveCourseRides 로 gap-fill */
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
  /** `liveCourseRides` 직접 합성 — courseActivity 지연 시 gap-fill */
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

/** publication·catalog 중 publication에 없는 courseId 만 catalog 에서 보충 */
function mergePublicationWithCatalogFallback(
  publication: WorldMapOverlaySlice,
  catalog: WorldMapOverlaySlice,
): WorldMapOverlaySlice {
  const pubPulseIds = new Set([
    ...publication.pulseDots.map((d) => d.courseId),
    ...publication.pulseRoutes.map((r) => r.courseId),
  ]);
  const pubHeatIds = new Set([
    ...publication.heatDots.map((d) => d.courseId),
    ...publication.heatRoutes.map((r) => r.courseId),
  ]);

  return {
    pulseDots: mergeActivityWorldDots(
      publication.pulseDots,
      catalog.pulseDots.filter((d) => !pubPulseIds.has(d.courseId)),
    ),
    pulseRoutes: [
      ...publication.pulseRoutes,
      ...catalog.pulseRoutes.filter((r) => !pubPulseIds.has(r.courseId)),
    ],
    heatDots: mergeActivityWorldDots(
      publication.heatDots,
      catalog.heatDots.filter((d) => !pubHeatIds.has(d.courseId)),
    ),
    heatRoutes: [
      ...publication.heatRoutes,
      ...catalog.heatRoutes.filter((r) => !pubHeatIds.has(r.courseId)),
    ],
  };
}

/**
 * Activity World 지도 raw overlay — 단일 merge 진실.
 * publication 모드에서도 catalog 를 gap-fill (dot 전체 소실 방지).
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

  const worldSlice = mergeLiveCourseRideGapFill(
    publicationPresenceWorldMapEnabled
      ? mergePublicationWithCatalogFallback(publication, {
          ...catalog,
          heatRoutes: catalogHeat.heatRoutes,
          heatDots: catalogHeat.heatDots,
        })
      : {
          pulseRoutes: catalog.pulseRoutes,
          heatRoutes: catalogHeat.heatRoutes,
          pulseDots: catalog.pulseDots,
          heatDots: catalogHeat.heatDots,
        },
    liveCourseRides,
  );

  return {
    pulseRoutes: [...active.pulseRoutes, ...worldSlice.pulseRoutes],
    heatRoutes: [...active.heatRoutes, ...worldSlice.heatRoutes],
    pulseDots: mergeActivityWorldDots(active.pulseDots, worldSlice.pulseDots),
    heatDots: mergeActivityWorldDots(active.heatDots, worldSlice.heatDots),
  };
}

/** DEV 회귀 — publication gap-fill */
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
  const merged = resolveWorldMapOverlay({
    trackedCourseId: null,
    active: emptyPub,
    catalog,
    publication: emptyPub,
    publicationPresenceWorldMapEnabled: true,
  });
  if (merged.pulseDots.length !== 1) {
    throw new Error("publication mode: catalog gap-fill when publication empty");
  }
}
