import { useCallback, useEffect, useMemo, useRef } from "react";
import type { User } from "firebase/auth";
import { useCourseActivity } from "../../hooks/useCourseActivity";
import { useCourseActivityMapOverlay } from "../../hooks/useCourseActivityMapOverlay";
import { usePublishedCoursesActivityMapOverlay } from "../../hooks/usePublishedCoursesActivityMapOverlay";
import { useTrailLiveCourseRideSpectatorOverlay } from "../../hooks/useTrailLiveCourseRideSpectatorOverlay";
import { useWorldPublicationPresenceOverlay } from "../../hooks/useWorldPublicationPresenceOverlay";
import {
  formatActivityWorldPinPopup,
  type CourseActivitySnapshot,
} from "../../lib/firestoreCourseActivity";
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
import { debugTrailLiveCourseRidesSubscriptionCount } from "../../lib/liveCourseRidesSubscriptionHub";
import type { LineStringGeometry } from "../../lib/geo";
import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";
import { runPublicationPresenceParseChecks } from "../../lib/firestorePublicationPresence";
import { resolveWorldMapOverlay, runWorldMapOverlayMergeChecks } from "./worldMapOverlayCore";
import { useActivityWorldDataSync } from "./useActivityWorldDataSync";
import { useWorldLiveCourseRideMapOverlay } from "./useWorldLiveCourseRideMapOverlay";
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
  trackedCourseId: string | null;
  publishedPublicCourses: readonly PublishedPublicCourseSummary[];
  /** Trailhead 공개 Trail 목록 — 라이브 코스 ID 카탈로그 보강 */
  openTrails: readonly TrailInstance[];
  trailRoomLabel: string;
  activityMapRefreshNonce: number;
  /** WO-260528: A/B/C 디버그 분리 시 기존 overlay 체인 완전 비활성화 */
  debugIsolation?: boolean;
};

export type AppMapOverlaysResult = {
  activityWorldRaw: ReturnType<typeof resolveWorldMapOverlay>;
  activityWorldRender: ReturnType<typeof resolveActivityWorldRender>;
  activityWorldLodDebug: ReturnType<typeof resolveActivityWorldLodDebug>;
  getActivityWorldPinLabel: (courseId: string, kind: "pulse" | "heat") => string | null;
  trailSpectatorDots: ReturnType<typeof useTrailLiveCourseRideSpectatorOverlay>["spectatorDots"];
  trailSpectatorRoutes: ReturnType<typeof useTrailLiveCourseRideSpectatorOverlay>["spectatorRouteGeometries"];
  courseActivity: CourseActivitySnapshot | null;
  reloadCourseActivity: ReturnType<typeof useCourseActivity>["reload"];
  applyRideCompletedOptimistic: ReturnType<typeof useCourseActivity>["applyRideCompletedOptimistic"];
  courseActivityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null>;
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
    trackedCourseId,
    publishedPublicCourses,
    openTrails,
    trailRoomLabel,
    activityMapRefreshNonce,
    debugIsolation = false,
  } = opts;
  void currentTrailMeta;

  const coursePeerIdsForTrailSpectator = useMemo(() => new Set<string>(), []);

  const isRideSessionActive = rideStatus === "running" || rideStatus === "paused";
  const courseActivityEnabled = Boolean(configured && user && trackedCourseId && pageVisible);

  const {
    activity: courseActivity,
    reload: reloadCourseActivity,
    applyRideCompletedOptimistic,
  } = useCourseActivity({
    configured,
    user,
    courseId: trackedCourseId,
    enabled: courseActivityEnabled,
    selfRideActive: isRideSessionActive,
  });

  const activeOverlay = useCourseActivityMapOverlay({
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

  const { spectatorDots, spectatorRouteGeometries, liveCourseIds: trailLiveCourseIds } =
    useTrailLiveCourseRideSpectatorOverlay({
      user,
      trailId,
      trailRoomLabel,
      enabled: trailSpectatorOverlayEnabled,
      mapZoom,
      excludePeerIds: coursePeerIdsForTrailSpectator,
    });

  const openTrailCourseIds = useMemo(
    () =>
      openTrails
        .map((t) => t.courseId?.trim() ?? "")
        .filter(Boolean),
    [openTrails],
  );

  const baseCatalogCourseIds = useMemo(() => {
    const ids = new Set<string>(BASIC_SHARED_HUB_IDS as readonly string[]);
    for (const c of publishedPublicCourses) ids.add(c.id);
    for (const id of openTrailCourseIds) ids.add(id);
    for (const id of trailLiveCourseIds) ids.add(id);
    return [...ids];
  }, [publishedPublicCourses, openTrailCourseIds, trailLiveCourseIds]);

  const worldMapActivityEnabled = Boolean(configured && user && pageVisible);

  void shouldDisablePublicationOverlayHooks;
  const publicationPresenceWorldMapEnabled = false;

  const activityWorldSyncEnabled = Boolean(
    !debugIsolationOn &&
      worldMapActivityEnabled &&
      !publicationPresenceWorldMapEnabled &&
      baseCatalogCourseIds.length > 0,
  );

  const activityWorldSync = useActivityWorldDataSync({
    enabled: activityWorldSyncEnabled,
    selfRideActive: isRideSessionActive,
    courseIds: baseCatalogCourseIds,
    excludeCourseId: isRideSessionActive ? trackedCourseId : null,
    refreshNonce: activityMapRefreshNonce,
  });

  const { worldHighlightedCourseIds, liveActivityCourseIds, worldHudLines } = activityWorldSync;

  const catalogCourseIds = useMemo(() => {
    const ids = new Set<string>(baseCatalogCourseIds);
    for (const id of worldHighlightedCourseIds) ids.add(id);
    for (const id of liveActivityCourseIds) ids.add(id);
    return [...ids];
  }, [baseCatalogCourseIds, worldHighlightedCourseIds, liveActivityCourseIds]);

  const catalogActivityEnabled = Boolean(
    worldMapActivityEnabled && catalogCourseIds.length > 0,
  );

  /** publication 모드: courseActivity N×getDoc·geometry OFF — 패널·HUD는 publication·worldActivityCatalog */
  const catalogOverlayEnabled =
    !debugIsolationOn && catalogActivityEnabled && !publicationPresenceWorldMapEnabled;

  const publicationOverlay = useWorldPublicationPresenceOverlay({
    enabled: debugIsolationOn ? false : publicationPresenceWorldMapEnabled || isPhaseB || isPhaseC,
    mapZoom,
    excludePublicationRoutesId: isRideSessionActive ? trackedCourseId : null,
    refreshNonce: activityMapRefreshNonce,
  });

  const catalogOverlay = usePublishedCoursesActivityMapOverlay({
    courseIds: catalogCourseIds,
    excludeCourseId: isRideSessionActive ? trackedCourseId : null,
    mapZoom,
    enabled: catalogOverlayEnabled,
    worldMapRenderEnabled: catalogOverlayEnabled,
    refreshNonce: activityMapRefreshNonce,
    externalSync: activityWorldSyncEnabled
      ? {
          activityByCourseId: activityWorldSync.activityByCourseId,
          syncEpoch: activityWorldSync.syncEpoch,
        }
      : undefined,
  });

  const worldLiveCourseRideOverlayEnabled =
    !debugIsolationOn && Boolean(configured && user && pageVisible) && !publicationPresenceWorldMapEnabled;

  const liveCourseRideOverlay = useWorldLiveCourseRideMapOverlay({
    enabled: worldLiveCourseRideOverlayEnabled,
    mapZoom,
    myUid: user?.uid ?? null,
    excludeCourseId: isRideSessionActive ? trackedCourseId : null,
    trailIds: liveRideTrailIds,
  });

  const publicationWorldDots = useMemo(
    () =>
      mergePublicationWorldPulseDots({
        serverPulseDots: publicationOverlay.pulseDots,
        serverHeatDots: publicationOverlay.heatDots,
        publicationWorldMapEnabled: publicationPresenceWorldMapEnabled,
        isRideSessionActive,
        trackedCourseId,
        routeGeometry,
      }),
    [
      publicationOverlay.pulseDots,
      publicationOverlay.heatDots,
      publicationPresenceWorldMapEnabled,
      isRideSessionActive,
      trackedCourseId,
      routeGeometry,
    ],
  );

  const mapSessionActive = worldMapActivityEnabled;
  const phaseBFallbackDot = useMemo(
    () => ({
      courseId: "debug-phase-b-fallback",
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
      trackedCourseId,
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
      liveCourseRides: {
        pulseRoutes: liveCourseRideOverlay.pulseRoutes,
        heatRoutes: liveCourseRideOverlay.heatRoutes,
        pulseDots: liveCourseRideOverlay.pulseDots,
        heatDots: liveCourseRideOverlay.heatDots,
      },
      publicationPresenceWorldMapEnabled,
    });
    return merged;
  }, [
    mapDebugPhase,
    isPhaseA,
    isPhaseB,
    isPhaseC,
    trackedCourseId,
    activeOverlay,
    catalogOverlay,
    publicationOverlay,
    publicationWorldDots,
    liveCourseRideOverlay,
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
    (courseId: string, kind: "pulse" | "heat") => {
      const id = courseId.trim();
      if (publicationPresenceWorldMapEnabled && id) {
        const presenceLabel = formatPublicationPresencePinPopup(
          publicationOverlay.presenceByPublicationId.get(id),
          kind,
        );
        if (presenceLabel) return presenceLabel;
      }
      const row =
        id && id === trackedCourseId?.trim()
          ? courseActivity
          : catalogOverlay.activityByCourseId.get(id) ?? null;
      return formatActivityWorldPinPopup(row, kind);
    },
    [
      publicationPresenceWorldMapEnabled,
      publicationOverlay.presenceByPublicationId,
      trackedCourseId,
      courseActivity,
      catalogOverlay.activityByCourseId,
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
      liveCourseRideLines: liveCourseRideOverlay.pulseRoutes.length,
      liveCourseRideCourses: liveCourseRideOverlay.liveCourseCount,
      liveCourseRideRows: liveCourseRideOverlay.liveRideRowCount,
      liveCourseRidesHubSubs: debugTrailLiveCourseRidesSubscriptionCount(),
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
        activityWorldRaw.pulseDots[0]?.courseId === "debug-phase-b-fallback" &&
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
    liveCourseRideOverlay.pulseRoutes.length,
    liveCourseRideOverlay.liveCourseCount,
    liveCourseRideOverlay.liveRideRowCount,
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
          liveCourseRideLines: liveCourseRideOverlay.pulseRoutes.length,
          liveCourseRideCourses: liveCourseRideOverlay.liveCourseCount,
          liveCourseRideRows: liveCourseRideOverlay.liveRideRowCount,
          liveActivityCourseIdsCount: liveActivityCourseIds.length,
          catalogCourseIdsCount: catalogCourseIds.length,
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
    courseActivityByCourseId: catalogOverlay.activityByCourseId,
    worldHudLines,
    publicationPresenceWorldMapEnabled,
    lodDebugPanelProps,
  };
}
