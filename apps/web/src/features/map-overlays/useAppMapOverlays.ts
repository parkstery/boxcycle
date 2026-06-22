import { useCallback, useEffect, useMemo, useRef } from "react";
import type { User } from "firebase/auth";
import { useRouteActivity } from "../../hooks/useRouteActivity";
import { useRouteActivityMapOverlay } from "../../hooks/useRouteActivityMapOverlay";
import { usePublishedCoursesActivityMapOverlay } from "../../hooks/usePublishedCoursesActivityMapOverlay";
import { useTrailLivePublicationRideSpectatorOverlay } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import { useWorldPublicationPresenceOverlay } from "../../hooks/useWorldPublicationPresenceOverlay";
import {
  formatActivityWorldPinPopup,
  type RouteActivitySnapshot,
} from "../../lib/firestoreRouteActivity";
import { formatPublicationPresencePinPopup } from "../../lib/firestorePublicationPresence";
import {
  resolveActivityWorldLodDebug,
  resolveActivityWorldRender,
  runActivityWorldLodP0Checks,
} from "../../lib/activityWorldLod";
import { runActivityWorldPollPolicyChecks } from "../../lib/activityWorldPollPolicy";
import { BASIC_SHARED_HUB_IDS } from "../../lib/firestoreCourses";
import type { PublishedPublicCourseSummary } from "../../lib/firestoreCourses";
import type { TrailInstance } from "../../lib/firestoreTrailInstance";
import { sanitizeTrailId } from "../../lib/firestoreTrail";
import { debugTrailLivePublicationRidesSubscriptionCount } from "../../lib/livePublicationRidesSubscriptionHub";
import type { LineStringGeometry } from "../../lib/geo";
import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";
import { runPublicationPresenceParseChecks } from "../../lib/firestorePublicationPresence";
import { resolveWorldMapOverlay, runWorldMapOverlayMergeChecks } from "./worldMapOverlayCore";
import { useActivityWorldDataSync } from "./useActivityWorldDataSync";
import { useWorldLivePublicationRideMapOverlay } from "./useWorldLivePublicationRideMapOverlay";
import { EMPTY_PEER_HUD_IDS, peerHudIdsKey } from "../../lib/peerHud";
import {
  mergePublicationWorldPulseDots,
  runWorldPublicationMapDotsChecks,
} from "./worldPublicationMapDots";
import {
  getEffectiveMapDebugPhase,
  getMapDebugPhase,
  isActivityLodDebugPanelEnabled,
  isMapDebugPhaseRecovery,
  shouldDisablePublicationOverlayHooks,
  shouldSkipLiveOverlaysOnMap,
} from "../../lib/mapDebugPhase";

export type UseAppMapOverlaysOpts = {
  configured: boolean;
  user: User | null;
  pageVisible: boolean;
  trailId: string;
  sanitizedTrailId: string;
  currentTrailMeta: TrailInstance | null;
  trailheadSessionActive: boolean;
  rideStatus: "idle" | "running" | "paused" | "ended";
  mapZoom: number;
  mapLodZoom: number;
  mapViewportSpanKm: number | null;
  mapLodSpanKm: number | null;
  routeGeometry: LineStringGeometry | null;
  trackedPublicationId: string | null;
  publishedPublicCourses: readonly PublishedPublicCourseSummary[];
  /** Trailhead 공개 Trail 목록 — 라이브 코스 ID 카탈로그 보강 */
  openTrails: readonly TrailInstance[];
  trailLabel: string;
  /** 동행 peer uid — spectator dot 라벨과 DOM/GLB 마커 중복 방지 */
  coursePeerHudIds?: readonly string[];
  activityMapRefreshNonce: number;
  /** WO-260528: A/B/C 디버그 분리 시 기존 overlay 체인 완전 비활성화 */
  debugIsolation?: boolean;
};

export type AppMapOverlaysResult = {
  activityWorldRaw: ReturnType<typeof resolveWorldMapOverlay>;
  activityWorldRender: ReturnType<typeof resolveActivityWorldRender>;
  activityWorldLodDebug: ReturnType<typeof resolveActivityWorldLodDebug>;
  getActivityWorldPinLabel: (publicationId: string, kind: "pulse" | "heat") => string | null;
  trailSpectatorDots: ReturnType<typeof useTrailLivePublicationRideSpectatorOverlay>["spectatorDots"];
  trailSpectatorRoutes: ReturnType<typeof useTrailLivePublicationRideSpectatorOverlay>["spectatorRouteGeometries"];
  courseActivity: RouteActivitySnapshot | null;
  reloadCourseActivity: ReturnType<typeof useRouteActivity>["reload"];
  applyRideCompletedOptimistic: ReturnType<typeof useRouteActivity>["applyRideCompletedOptimistic"];
  publicationActivityByPublicationId: ReadonlyMap<string, RouteActivitySnapshot | null>;
  worldHudLines: string | null;
  publicationPresenceWorldMapEnabled: boolean;
  lodDebugPanelProps: ActivityWorldLodDebugPanelProps | null;
};

export function useAppMapOverlays(opts: UseAppMapOverlaysOpts): AppMapOverlaysResult {
  const {
    configured,
    user,
    pageVisible,
    trailId,
    sanitizedTrailId,
    currentTrailMeta,
    trailheadSessionActive,
    rideStatus,
    mapZoom,
    mapLodZoom,
    mapViewportSpanKm,
    mapLodSpanKm,
    routeGeometry,
    trackedPublicationId,
    publishedPublicCourses,
    openTrails,
    trailLabel,
    coursePeerHudIds = EMPTY_PEER_HUD_IDS,
    activityMapRefreshNonce,
    debugIsolation = false,
  } = opts;
  void currentTrailMeta;

  const coursePeerIdsKey = peerHudIdsKey(coursePeerHudIds);
  const coursePeerIdsForTrailSpectator = useMemo(
    () => new Set(coursePeerHudIds),
    [coursePeerIdsKey],
  );

  const isRideSessionActive = rideStatus === "running" || rideStatus === "paused";
  const courseActivityEnabled = Boolean(configured && user && trackedPublicationId && pageVisible);

  const {
    activity: courseActivity,
    reload: reloadCourseActivity,
    applyRideCompletedOptimistic,
  } = useRouteActivity({
    configured,
    user,
    publicationId: trackedPublicationId,
    enabled: courseActivityEnabled,
    selfRideActive: isRideSessionActive,
  });

  const activeOverlay = useRouteActivityMapOverlay({
    activity: courseActivity,
    routeGeometry,
    mapZoom,
  });

  const liveRideTrailIds = useMemo(() => {
    const ids = new Set<string>([sanitizedTrailId]);
    for (const t of openTrails) {
      if (t.id?.trim()) ids.add(sanitizeTrailId(t.id));
    }
    return [...ids];
  }, [sanitizedTrailId, openTrails]);

  /** AC-7: Trailhead idle = publication만 — L3 spectator는 주행·일시정지(관전 세션)에서만 */
  const mapDebugPhaseEnv = getMapDebugPhase();
  const mapDebugPhase = getEffectiveMapDebugPhase();
  const isPhaseA = mapDebugPhase === "A";
  const isPhaseB = mapDebugPhase === "B";
  const isPhaseC = mapDebugPhase === "C";
  const forceDebugBypass = isMapDebugPhaseRecovery();
  const debugIsolationOn = debugIsolation && (isPhaseA || isPhaseB || isPhaseC);

  const trailSpectatorOverlayEnabled =
    !debugIsolationOn &&
    !shouldSkipLiveOverlaysOnMap() &&
    Boolean(
      trailheadSessionActive &&
        (rideStatus === "running" || rideStatus === "paused") &&
        pageVisible,
    );

  const { spectatorDots, spectatorRouteGeometries, livePublicationIds: trailLivePublicationIds } =
    useTrailLivePublicationRideSpectatorOverlay({
      user,
      trailId,
      trailLabel,
      enabled: trailSpectatorOverlayEnabled,
      mapZoom,
      excludePeerIds: coursePeerIdsForTrailSpectator,
    });

  const openTrailPublicationIds = useMemo(
    () =>
      openTrails
        .map((t) => t.publicationId?.trim() ?? "")
        .filter(Boolean),
    [openTrails],
  );

  const baseCatalogPublicationIds = useMemo(() => {
    const ids = new Set<string>(BASIC_SHARED_HUB_IDS as readonly string[]);
    for (const c of publishedPublicCourses) ids.add(c.id);
    for (const id of openTrailPublicationIds) ids.add(id);
    for (const id of trailLivePublicationIds) ids.add(id);
    return [...ids];
  }, [publishedPublicCourses, openTrailPublicationIds, trailLivePublicationIds]);

  const worldMapActivityEnabled = Boolean(configured && user && pageVisible);

  void shouldDisablePublicationOverlayHooks;
  const publicationPresenceWorldMapEnabled = false;

  const activityWorldSyncEnabled = Boolean(
    !debugIsolationOn &&
      worldMapActivityEnabled &&
      !publicationPresenceWorldMapEnabled &&
      baseCatalogPublicationIds.length > 0,
  );

  const activityWorldSync = useActivityWorldDataSync({
    enabled: activityWorldSyncEnabled,
    selfRideActive: isRideSessionActive,
    publicationIds: baseCatalogPublicationIds,
    excludePublicationId: isRideSessionActive ? trackedPublicationId : null,
    refreshNonce: activityMapRefreshNonce,
  });

  const {
    worldHighlightedPublicationIds,
    liveActivityPublicationIds,
    worldHudLines,
  } = activityWorldSync;

  const catalogPublicationIds = useMemo(() => {
    const ids = new Set<string>(baseCatalogPublicationIds);
    for (const id of worldHighlightedPublicationIds) ids.add(id);
    for (const id of liveActivityPublicationIds) ids.add(id);
    return [...ids];
  }, [baseCatalogPublicationIds, worldHighlightedPublicationIds, liveActivityPublicationIds]);

  const catalogActivityEnabled = Boolean(
    worldMapActivityEnabled && catalogPublicationIds.length > 0,
  );

  /** publication 모드: courseActivity N×getDoc·geometry OFF — 패널·HUD는 publication·worldActivityCatalog */
  const catalogOverlayEnabled =
    !debugIsolationOn && catalogActivityEnabled && !publicationPresenceWorldMapEnabled;

  const publicationOverlay = useWorldPublicationPresenceOverlay({
    enabled: debugIsolationOn ? false : publicationPresenceWorldMapEnabled || isPhaseB || isPhaseC,
    mapZoom,
    excludePublicationRoutesId: isRideSessionActive ? trackedPublicationId : null,
    refreshNonce: activityMapRefreshNonce,
  });

  const catalogOverlay = usePublishedCoursesActivityMapOverlay({
    publicationIds: catalogPublicationIds,
    excludePublicationId: isRideSessionActive ? trackedPublicationId : null,
    mapZoom,
    enabled: catalogOverlayEnabled,
    worldMapRenderEnabled: catalogOverlayEnabled,
    refreshNonce: activityMapRefreshNonce,
    externalSync: activityWorldSyncEnabled
      ? {
          activityByPublicationId: activityWorldSync.activityByPublicationId,
          syncEpoch: activityWorldSync.syncEpoch,
        }
      : undefined,
  });

  const worldLivePublicationRideOverlayEnabled =
    !debugIsolationOn && Boolean(configured && user && pageVisible) && !publicationPresenceWorldMapEnabled;

  const livePublicationRideOverlay = useWorldLivePublicationRideMapOverlay({
    enabled: worldLivePublicationRideOverlayEnabled,
    mapZoom,
    myUid: user?.uid ?? null,
    excludePublicationId: isRideSessionActive ? trackedPublicationId : null,
    trailIds: liveRideTrailIds,
  });

  const publicationWorldDots = useMemo(
    () =>
      mergePublicationWorldPulseDots({
        serverPulseDots: publicationOverlay.pulseDots,
        serverHeatDots: publicationOverlay.heatDots,
        publicationWorldMapEnabled: publicationPresenceWorldMapEnabled,
        isRideSessionActive,
        trackedPublicationId,
        routeGeometry,
      }),
    [
      publicationOverlay.pulseDots,
      publicationOverlay.heatDots,
      publicationPresenceWorldMapEnabled,
      isRideSessionActive,
      trackedPublicationId,
      routeGeometry,
    ],
  );

  const mapSessionActive = worldMapActivityEnabled;
  const phaseBFallbackDot = useMemo(
    () => ({
      publicationId: "debug-phase-b-fallback",
      lngLat: [8.04, 46.63] as [number, number],
      pulseLevel: 1,
      kind: "pulse" as const,
      traceStrength: 1,
    }),
    [],
  );

  const activityWorldRaw = useMemo(() => {
    if (debugIsolationOn) {
      return { pulseRoutes: [], heatRoutes: [], pulseDots: [], heatDots: [] };
    }
    if (isPhaseA) {
      return {
        pulseRoutes: [],
        heatRoutes: [],
        pulseDots: [],
        heatDots: [],
      };
    }
    if (isPhaseB || isPhaseC) {
      const firstPulse = publicationOverlay.pulseDots[0];
      const firstHeat = publicationOverlay.heatDots[0];
      const useFallback = !firstPulse && !firstHeat;
      const selectedPulse = firstPulse ?? (useFallback ? phaseBFallbackDot : null);
      return {
        pulseRoutes: [],
        heatRoutes: [],
        pulseDots: selectedPulse ? [selectedPulse] : [],
        heatDots: selectedPulse ? [] : firstHeat ? [firstHeat] : [],
      };
    }
    if (publicationPresenceWorldMapEnabled) {
      return {
        pulseRoutes: [...publicationOverlay.pulseRoutes],
        heatRoutes: [...publicationOverlay.heatRoutes],
        pulseDots: [...publicationWorldDots.pulseDots],
        heatDots: [...publicationWorldDots.heatDots],
      };
    }
    const merged = resolveWorldMapOverlay({
      trackedPublicationId,
      active: activeOverlay,
      catalog: {
        pulseRoutes: catalogOverlay.pulseRoutes,
        heatRoutes: catalogOverlay.heatRoutes,
        pulseDots: catalogOverlay.pulseDots,
        heatDots: catalogOverlay.heatDots,
      },
      publication: {
        pulseRoutes: publicationOverlay.pulseRoutes,
        heatRoutes: publicationOverlay.heatRoutes,
        pulseDots: publicationWorldDots.pulseDots,
        heatDots: publicationWorldDots.heatDots,
      },
      livePublicationRides: {
        pulseRoutes: livePublicationRideOverlay.pulseRoutes,
        heatRoutes: livePublicationRideOverlay.heatRoutes,
        pulseDots: livePublicationRideOverlay.pulseDots,
        heatDots: livePublicationRideOverlay.heatDots,
      },
      publicationPresenceWorldMapEnabled,
    });
    return merged;
  }, [
    mapDebugPhase,
    isPhaseA,
    isPhaseB,
    isPhaseC,
    trackedPublicationId,
    activeOverlay,
    catalogOverlay,
    publicationOverlay,
    publicationWorldDots,
    livePublicationRideOverlay,
    publicationPresenceWorldMapEnabled,
    mapSessionActive,
    isRideSessionActive,
    routeGeometry,
    phaseBFallbackDot,
    debugIsolationOn,
  ]);

  const phaseDSourceLogKeyRef = useRef("");
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (isPhaseA || isPhaseB || isPhaseC) return;
    const key = `${publicationPresenceWorldMapEnabled}|${activityWorldRaw.pulseDots.length}|${activityWorldRaw.heatDots.length}`;
    if (phaseDSourceLogKeyRef.current === key) return;
    phaseDSourceLogKeyRef.current = key;
    console.log("[PhaseD] source", {
      publicationPresenceWorldMapEnabled,
      rawPulse: activityWorldRaw.pulseDots.length,
      rawHeat: activityWorldRaw.heatDots.length,
    });
  }, [
    isPhaseA,
    isPhaseB,
    isPhaseC,
    publicationPresenceWorldMapEnabled,
    activityWorldRaw.pulseDots.length,
    activityWorldRaw.heatDots.length,
  ]);

  const activityWorldRender = useMemo(
    () => resolveActivityWorldRender(mapLodZoom, activityWorldRaw),
    [mapLodZoom, activityWorldRaw],
  );

  const activityWorldLodDebug = useMemo(
    () => resolveActivityWorldLodDebug(mapLodZoom, activityWorldRaw, activityWorldRender),
    [mapLodZoom, activityWorldRaw, activityWorldRender],
  );

  const getActivityWorldPinLabel = useCallback(
    (publicationId: string, kind: "pulse" | "heat") => {
      const id = publicationId.trim();
      if (publicationPresenceWorldMapEnabled && id) {
        const presenceLabel = formatPublicationPresencePinPopup(
          publicationOverlay.presenceByPublicationId.get(id),
          kind,
        );
        if (presenceLabel) return presenceLabel;
      }
      const row =
        id && id === trackedPublicationId?.trim()
          ? courseActivity
          : catalogOverlay.activityByPublicationId.get(id) ?? null;
      return formatActivityWorldPinPopup(row, kind);
    },
    [
      publicationPresenceWorldMapEnabled,
      publicationOverlay.presenceByPublicationId,
      trackedPublicationId,
      courseActivity,
      catalogOverlay.activityByPublicationId,
    ],
  );

  useEffect(() => {
    if (debugIsolationOn) return;
    if (!import.meta.env.DEV) return;
    try {
      runActivityWorldLodP0Checks();
      runActivityWorldPollPolicyChecks();
      runWorldMapOverlayMergeChecks();
      runPublicationPresenceParseChecks();
      runWorldPublicationMapDotsChecks();
    } catch (e) {
      console.error("[ActivityWorld] P0 LOD checks failed", e);
    }
    console.debug("[ActivityWorld]", {
      zoom: mapZoom,
      lodZoom: mapLodZoom,
      spanKm: mapViewportSpanKm,
      lodSpanKm: mapLodSpanKm,
      activityLod: activityWorldLodDebug,
      raw: {
        pulseDots: activityWorldRaw.pulseDots.length,
        heatDots: activityWorldRaw.heatDots.length,
        pulseLines: activityWorldRaw.pulseRoutes.length,
        heatLines: activityWorldRaw.heatRoutes.length,
      },
      heatPool: {
        live: catalogOverlay.overlayStats.liveCandidates,
        heat: catalogOverlay.overlayStats.heatCandidates,
      },
      render: activityWorldRender,
      catalog: catalogOverlay.overlayStats,
      catalogEnabled: catalogActivityEnabled,
      livePublicationRideLines: livePublicationRideOverlay.pulseRoutes.length,
      livePublicationRidePublications: livePublicationRideOverlay.livePublicationCount,
      livePublicationRideRows: livePublicationRideOverlay.liveRideRowCount,
      livePublicationRidesHubSubs: debugTrailLivePublicationRidesSubscriptionCount(),
      publicationPresence: publicationOverlay.overlayStats,
      publicationPresenceEnabled: publicationPresenceWorldMapEnabled,
      publicationRawDots: {
        pulse: publicationOverlay.pulseDots.length,
        heat: publicationOverlay.heatDots.length,
      },
      publicationMergedRawDots: {
        pulse: activityWorldRaw.pulseDots.length,
        heat: activityWorldRaw.heatDots.length,
      },
      publicationRenderDots: {
        pulse: activityWorldRender.pulseDots.length,
        heat: activityWorldRender.heatDots.length,
      },
      publicationWorldMapEnabled: publicationPresenceWorldMapEnabled,
      mapSessionActive,
    });
    if (
      !forceDebugBypass &&
      activityWorldRaw.pulseDots.length === 0 &&
      activityWorldRaw.heatDots.length === 0
    ) {
      console.warn("[ActivityWorld] raw overlay still zero after minimum-dot guard", {
        publicationPresenceWorldMapEnabled,
        mapSessionActive,
        configured,
        hasUser: Boolean(user),
        pageVisible,
        mapDebugPhase: getMapDebugPhase(),
      });
    } else if (forceDebugBypass && import.meta.env.DEV) {
      const isB = getMapDebugPhase() === "B";
      const usedBFallback =
        isB &&
        activityWorldRaw.pulseDots[0]?.publicationId === "debug-phase-b-fallback" &&
        activityWorldRaw.pulseDots.length > 0;
      console.info("[MapDebug] overlay hooks bypassed — WORLD_LIGHT는 MapView Phase에서만 그림", {
        mapDebugPhase: getMapDebugPhase(),
        publicationPresenceWorldMapEnabled,
        note: "publicationPresenceWorldMapEnabled=false 는 Phase A–C 에서 정상",
        phaseBUsedFallback: usedBFallback,
        phaseBFallbackLngLat: usedBFallback ? [8.04, 46.63] : null,
      });
    }
  }, [
    mapZoom,
    mapLodZoom,
    mapViewportSpanKm,
    mapLodSpanKm,
    activityWorldLodDebug,
    activityWorldRaw,
    activityWorldRender,
    catalogOverlay.overlayStats,
    catalogActivityEnabled,
    livePublicationRideOverlay.pulseRoutes.length,
    livePublicationRideOverlay.livePublicationCount,
    livePublicationRideOverlay.liveRideRowCount,
    publicationOverlay.overlayStats,
    publicationOverlay.pulseDots.length,
    publicationOverlay.heatDots.length,
    publicationPresenceWorldMapEnabled,
    activityWorldRender.pulseDots.length,
    activityWorldRender.heatDots.length,
    forceDebugBypass,
    debugIsolationOn,
  ]);

  const lodDebugPanelProps: ActivityWorldLodDebugPanelProps | null =
    isActivityLodDebugPanelEnabled()
      ? {
          activityWorldLodDebug,
          mapLodZoom,
          mapZoom,
          mapViewportSpanKm,
          activityWorldRaw,
          activityWorldRender,
          catalogPulseDots: catalogOverlay.pulseDots.length,
          catalogHeatDots: catalogOverlay.heatDots.length,
          catalogPulseRoutes: catalogOverlay.pulseRoutes.length,
          mapDebugPhaseEnv,
          mapDebugPhaseEffective: mapDebugPhase,
          publicationPresenceWorldMapEnabled,
          publicationActiveCount: publicationOverlay.overlayStats.activeCount,
          publicationClosedCount: publicationOverlay.overlayStats.closedCount,
          publicationGeometryReady: publicationOverlay.overlayStats.geometryReady,
          publicationAnchorMissing: publicationOverlay.overlayStats.anchorMissing,
          publicationFetchRowCount: publicationOverlay.overlayStats.fetchRowCount,
          publicationLastFetchError: publicationOverlay.overlayStats.lastFetchError,
          catalogLiveCandidates: catalogOverlay.overlayStats.liveCandidates,
          catalogHeatCandidates: catalogOverlay.overlayStats.heatCandidates,
          catalogGeometryReady: catalogOverlay.overlayStats.geometryReady,
          catalogActivityRows: catalogOverlay.overlayStats.activityRows,
          catalogAnchorMissing: catalogOverlay.overlayStats.anchorMissing,
          livePublicationRideLines: livePublicationRideOverlay.pulseRoutes.length,
          livePublicationRidePublications: livePublicationRideOverlay.livePublicationCount,
          livePublicationRideRows: livePublicationRideOverlay.liveRideRowCount,
          liveActivityPublicationIdsCount: liveActivityPublicationIds.length,
          catalogPublicationIdsCount: catalogPublicationIds.length,
          mapDebugPhase: mapDebugPhase,
        }
      : null;

  return {
    activityWorldRaw,
    activityWorldRender,
    activityWorldLodDebug,
    getActivityWorldPinLabel,
    trailSpectatorDots: spectatorDots,
    trailSpectatorRoutes: spectatorRouteGeometries,
    courseActivity,
    reloadCourseActivity,
    applyRideCompletedOptimistic,
    publicationActivityByPublicationId: catalogOverlay.activityByPublicationId,
    worldHudLines,
    publicationPresenceWorldMapEnabled,
    lodDebugPanelProps,
  };
}
