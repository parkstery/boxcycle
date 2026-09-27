import { useCallback, useEffect, useMemo } from "react";
import type { User } from "firebase/auth";
import { useRouteActivity } from "../../hooks/useRouteActivity";
import { useRouteActivityMapOverlay } from "../../hooks/useRouteActivityMapOverlay";
import { usePublishedCoursesActivityMapOverlay } from "../../hooks/usePublishedCoursesActivityMapOverlay";
import { useTrailLivePublicationRideSpectatorOverlay } from "../../hooks/useTrailLivePublicationRideSpectatorOverlay";
import { useWorldPublicationPresenceOverlay } from "../../hooks/useWorldPublicationPresenceOverlay";
import {
  formatActivityWorldPinPopup,
  type RouteActivitySnapshot,
} from "../../lib/activity/repo/firestoreRouteActivity";
import { formatPublicationPresencePinPopup } from "../../lib/ride/repo/firestorePublicationPresence";
import {
  resolveActivityWorldLodDebug,
  resolveActivityWorldRender,
  runActivityWorldLodP0Checks,
} from "../../lib/activity/activityWorldLod";
import { runActivityWorldPollPolicyChecks } from "../../lib/activity/activityWorldPollPolicy";
import { BASIC_SHARED_HUB_IDS } from "../../lib/route/repo/firestoreCourses";
import type { PublishedPublicCourseSummary } from "../../lib/route/repo/firestoreCourses";
import type { TrailInstance } from "../../lib/trail/repo/firestoreTrailInstance";
import { sanitizeTrailId, DEFAULT_TRAIL_ID } from "../../lib/trail/repo/firestoreTrail";
import { useActiveLiveRideTrailIds } from "../../hooks/useActiveLiveRideTrailIds";
import { debugTrailLivePublicationRidesSubscriptionCount } from "../../lib/trail/repo/livePublicationRidesSubscriptionHub";
import type { LineStringGeometry } from "../../lib/geo/geo";
import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";
import { runPublicationPresenceParseChecks } from "../../lib/ride/repo/firestorePublicationPresence";
import { resolveWorldMapOverlay, runWorldMapOverlayMergeChecks } from "./worldMapOverlayCore";
import { useActivityWorldDataSync } from "./useActivityWorldDataSync";
import { useWorldLivePublicationRideMapOverlay } from "./useWorldLivePublicationRideMapOverlay";
import { EMPTY_PEER_HUD_IDS, peerHudIdsKey } from "../../lib/peerMotion/peerHud";
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
} from "../../lib/debug/mapDebugPhase";

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
  /** 현재 라이브 중인 peer publication — 이탈(완주) 감지용 */
  trailLivePublicationIds: ReturnType<typeof useTrailLivePublicationRideSpectatorOverlay>["livePublicationIds"];
  courseActivity: RouteActivitySnapshot | null;
  reloadCourseActivity: ReturnType<typeof useRouteActivity>["reload"];
  applyRideCompletedOptimistic: ReturnType<typeof useRouteActivity>["applyRideCompletedOptimistic"];
  publicationActivityByPublicationId: ReadonlyMap<string, RouteActivitySnapshot | null>;
  worldHudLines: string | null;
  publicationPresenceWorldMapEnabled: boolean;
  lodDebugPanelProps: ActivityWorldLodDebugPanelProps | null;
};

/**
 * DEV 계측 로그를 **2초에 한 번**으로 제한한다.
 *
 * 왜 (2026-09-27) — 아래 블록은 지도가 움직일 때마다 다시 돈다. 주행 중에는 시야가
 * 계속 바뀌므로 사실상 매 프레임이다. 그때마다 P0 점검 5종 + 큰 객체 `console.debug` +
 * `console.warn` 이 돌았고, `console.warn` 은 React DEV 에서 **컴포넌트 스택 전체**를
 * 함께 찍는다. 실측 콘솔에 남은 값:
 *
 *     [Violation] 'message' handler took 1496ms
 *     [Violation] 'requestAnimationFrame' handler took <N>ms   ×30
 *
 * 1.5초 멈추면 동행 보간이 그동안 갱신되지 못하고, 풀리는 순간 **한꺼번에 따라잡는다**
 * — 화면에는 「툭툭 튀는」 것으로 보인다. 즉 이 로그가 진단하려던 증상을 스스로 만들었다.
 *
 * ⚠️ 프로덕션에는 없던 문제다(`import.meta.env.DEV` 가드). 그러나 chief 가 실제 시험을
 * DEV 서버(5000)에서 하므로, **여기를 고쳐야 다른 계측을 믿을 수 있다.**
 */
const ACTIVITY_WORLD_DEBUG_MIN_INTERVAL_MS = 2_000;
let lastActivityWorldDebugAtMs = 0;

function shouldEmitActivityWorldDebug(nowMs: number = Date.now()): boolean {
  if (nowMs - lastActivityWorldDebugAtMs < ACTIVITY_WORLD_DEBUG_MIN_INTERVAL_MS) return false;
  lastActivityWorldDebugAtMs = nowMs;
  return true;
}

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

  const atTrailheadIdle = sanitizedTrailId === DEFAULT_TRAIL_ID && !isRideSessionActive;

  const activeLiveRideTrailIdsQuery = useActiveLiveRideTrailIds({
    enabled: Boolean(configured && user && pageVisible && trailheadSessionActive),
  });

  const liveRideTrailIds = useMemo(() => {
    const ids = new Set<string>();
    if (sanitizedTrailId !== DEFAULT_TRAIL_ID) {
      ids.add(sanitizeTrailId(sanitizedTrailId));
    }
    for (const t of openTrails) {
      const tid = sanitizeTrailId(t.id);
      if (tid !== DEFAULT_TRAIL_ID) ids.add(tid);
    }
    for (const id of activeLiveRideTrailIdsQuery.trailIds) {
      const tid = sanitizeTrailId(id);
      if (tid !== DEFAULT_TRAIL_ID) ids.add(tid);
    }
    return [...ids];
  }, [sanitizedTrailId, openTrails, activeLiveRideTrailIdsQuery.trailIds]);

  /** AC-7: Trailhead idle = publication + 주행 Trail 관전 라인 — L3 동행 spectator 는 주행·일시정지에서만 */
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
    if (!shouldEmitActivityWorldDebug()) return;
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

  const mapTrailSpectatorDots = useMemo(() => {
    if (spectatorDots.length > 0) return spectatorDots;
    if (atTrailheadIdle) return livePublicationRideOverlay.trailheadSpectatorDots;
    return spectatorDots;
  }, [spectatorDots, atTrailheadIdle, livePublicationRideOverlay.trailheadSpectatorDots]);

  const mapTrailSpectatorRoutes = useMemo(() => {
    if (spectatorRouteGeometries.length > 0) return spectatorRouteGeometries;
    if (atTrailheadIdle) return livePublicationRideOverlay.trailheadSpectatorRoutes;
    return spectatorRouteGeometries;
  }, [
    spectatorRouteGeometries,
    atTrailheadIdle,
    livePublicationRideOverlay.trailheadSpectatorRoutes,
  ]);

  return {
    activityWorldRaw,
    activityWorldRender,
    activityWorldLodDebug,
    getActivityWorldPinLabel,
    trailSpectatorDots: mapTrailSpectatorDots,
    trailSpectatorRoutes: mapTrailSpectatorRoutes,
    trailLivePublicationIds,
    courseActivity,
    reloadCourseActivity,
    applyRideCompletedOptimistic,
    publicationActivityByPublicationId: catalogOverlay.activityByPublicationId,
    worldHudLines,
    publicationPresenceWorldMapEnabled,
    lodDebugPanelProps,
  };
}
