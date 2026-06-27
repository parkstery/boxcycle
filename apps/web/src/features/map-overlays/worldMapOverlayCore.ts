import {
  mergeActivityWorldDots,
  type ActivityWorldRawOverlay,
} from "../../lib/activityWorldLod";
import type { RouteActivityMapOverlay } from "../../hooks/useRouteActivityMapOverlay";

export type WorldMapOverlaySlice = RouteActivityMapOverlay;

/** catalog·publication 에 pulse line 이 없을 때 livePublicationRides route 로 gap-fill (dot 없음) */
function mergeLivePublicationRideGapFill(
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
    ...base.pulseDots.map((d) => d.publicationId),
    ...base.pulseRoutes.map((r) => r.publicationId),
  ]);
  const heatIds = new Set([
    ...base.heatDots.map((d) => d.publicationId),
    ...base.heatRoutes.map((r) => r.publicationId),
  ]);

  return {
    pulseDots: mergeActivityWorldDots(
      base.pulseDots,
      live.pulseDots.filter((d) => !pulseIds.has(d.publicationId)),
    ),
    pulseRoutes: [
      ...base.pulseRoutes,
      ...live.pulseRoutes.filter((r) => !pulseIds.has(r.publicationId)),
    ],
    heatDots: mergeActivityWorldDots(
      base.heatDots,
      live.heatDots.filter((d) => !heatIds.has(d.publicationId)),
    ),
    heatRoutes: [
      ...base.heatRoutes,
      ...live.heatRoutes.filter((r) => !heatIds.has(r.publicationId)),
    ],
  };
}

export type ResolveWorldMapOverlayInput = {
  /** 추적 중인 publication — active 오버레이가 heat/catalog 중복 제거에 사용 */
  trackedPublicationId: string | null;
  active: WorldMapOverlaySlice;
  catalog: WorldMapOverlaySlice;
  publication: WorldMapOverlaySlice;
  /** `livePublicationRides` 직접 합성 — routeActivity 지연 시 **line** gap-fill (dot 은 global livePresence) */
  livePublicationRides?: WorldMapOverlaySlice;
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
    heatRoutes: slice.heatRoutes.filter((r) => r.publicationId !== tracked),
    heatDots: slice.heatDots.filter((d) => d.publicationId !== tracked),
  };
}

/**
 * Activity World 지도 raw overlay — 단일 merge 진실.
 * publication 모드: L1/L2 = publicationPresence only (dot·line, catalog gap-fill 없음).
 */
export function resolveWorldMapOverlay(input: ResolveWorldMapOverlayInput): ActivityWorldRawOverlay {
  const {
    trackedPublicationId,
    active,
    catalog,
    publication,
    livePublicationRides = {
      pulseRoutes: [],
      heatRoutes: [],
      pulseDots: [],
      heatDots: [],
    },
    publicationPresenceWorldMapEnabled,
  } = input;

  const tracked = trackedPublicationId?.trim() ?? "";
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
    : mergeLivePublicationRideGapFill(baseSlice, livePublicationRides);

  /** publication 모드: 월드 = L1/L2 only — routeActivity live dot/line 은 코스 뷰·L3 */
  const activeWorld = publicationPresenceWorldMapEnabled
    ? { pulseRoutes: [], heatRoutes: [], pulseDots: [], heatDots: [] }
    : active;

  return {
    pulseRoutes: [...activeWorld.pulseRoutes, ...worldSlice.pulseRoutes],
    heatRoutes: [...activeWorld.heatRoutes, ...worldSlice.heatRoutes],
    pulseDots: mergeActivityWorldDots(activeWorld.pulseDots, worldSlice.pulseDots),
    heatDots: mergeActivityWorldDots(activeWorld.heatDots, worldSlice.heatDots),
  };
}

/** DEV 회귀 — publication 모드 dot/catalog·livePublicationRides 격리 */
export function runWorldMapOverlayMergeChecks(): void {
  const catalog: WorldMapOverlaySlice = {
    pulseDots: [{ publicationId: "c1", lngLat: [0, 0], pulseLevel: 1, kind: "pulse", traceStrength: 1 }],
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
    trackedPublicationId: null,
    active: emptyPub,
    catalog,
    publication: emptyPub,
    publicationPresenceWorldMapEnabled: true,
  });
  if (mergedEmptyPub.pulseDots.length !== 0) {
    throw new Error("publication mode: catalog dots must not merge when publication empty");
  }

  const pubWithDot: WorldMapOverlaySlice = {
    pulseDots: [{ publicationId: "c1", lngLat: [1, 1], pulseLevel: 2, kind: "pulse", traceStrength: 1 }],
    pulseRoutes: [],
    heatDots: [],
    heatRoutes: [],
  };
  const mergedWithPub = resolveWorldMapOverlay({
    trackedPublicationId: null,
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
        publicationId: "c1",
        geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] },
        kind: "pulse",
        traceStrength: 1,
      },
    ],
    heatDots: [],
    heatRoutes: [],
  };
  const mergedRoutes = resolveWorldMapOverlay({
    trackedPublicationId: null,
    active: emptyPub,
    catalog: catalogWithRoute,
    publication: emptyPub,
    publicationPresenceWorldMapEnabled: true,
  });
  if (mergedRoutes.pulseRoutes.length !== 0) {
    throw new Error("publication mode: catalog routes must not gap-fill");
  }
}
