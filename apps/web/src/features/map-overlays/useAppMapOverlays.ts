import { useCallback, useEffect, useMemo } from "react";
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
import { BASIC_SHARED_HUB_IDS } from "../../lib/firestoreCourses";
import type { PublishedPublicCourseSummary } from "../../lib/firestoreCourses";
import type { TrailInstance } from "../../lib/firestoreTrailInstance";
import { resolveTrailDisplayLabel } from "../../lib/trailDisplayNumber";
import type { LineStringGeometry } from "../../lib/geo";
import type { MapPeerMarker } from "../../components/MapView";
import type { ActivityWorldLodDebugPanelProps } from "./ActivityWorldLodDebugPanel";
import { resolveWorldMapOverlay, runWorldMapOverlayMergeChecks } from "./worldMapOverlayCore";
import { useWorldActivityCatalog } from "./useWorldActivityCatalog";

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
  coursePeerMarkers: MapPeerMarker[];
  activityMapRefreshNonce: number;
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
    coursePeerMarkers,
    activityMapRefreshNonce,
  } = opts;

  const { worldHighlightedCourseIds, liveActivityCourseIds, worldHudLines } = useWorldActivityCatalog({
    configured,
    user,
    pageVisible,
  });

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
  });

  const activeOverlay = useCourseActivityMapOverlay({
    activity: courseActivity,
    routeGeometry,
    mapZoom,
  });

  const trailDisplayLabels = useMemo(
    () => resolveTrailDisplayLabel(sanitizedTrailId, currentTrailMeta),
    [sanitizedTrailId, currentTrailMeta],
  );

  const coursePeerIdsForTrailSpectator = useMemo(
    () => new Set(coursePeerMarkers.map((p) => p.id)),
    [coursePeerMarkers],
  );

  const trailSpectatorOverlayEnabled = Boolean(
    trailheadSessionActive &&
      (rideStatus === "idle" || rideStatus === "running" || rideStatus === "paused") &&
      pageVisible,
  );

  const {
    spectatorDots,
    spectatorRouteGeometries,
    liveCourseIds: trailLiveCourseIds,
  } = useTrailLiveCourseRideSpectatorOverlay({
    user,
    trailId,
    trailRoomLabel: trailDisplayLabels.room,
    enabled: trailSpectatorOverlayEnabled,
    mapZoom,
    excludePeerIds: coursePeerIdsForTrailSpectator,
  });

  const catalogCourseIds = useMemo(() => {
    const ids = new Set<string>(BASIC_SHARED_HUB_IDS as readonly string[]);
    for (const c of publishedPublicCourses) ids.add(c.id);
    for (const id of worldHighlightedCourseIds) ids.add(id);
    for (const id of trailLiveCourseIds) ids.add(id);
    for (const id of liveActivityCourseIds) ids.add(id);
    return [...ids];
  }, [publishedPublicCourses, worldHighlightedCourseIds, trailLiveCourseIds, liveActivityCourseIds]);

  const catalogActivityEnabled = Boolean(
    configured && user && pageVisible && catalogCourseIds.length > 0,
  );

  const publicationPresenceWorldMapEnabled =
    catalogActivityEnabled && import.meta.env.VITE_USE_PUBLICATION_PRESENCE !== "false";

  const publicationOverlay = useWorldPublicationPresenceOverlay({
    enabled: publicationPresenceWorldMapEnabled,
    mapZoom,
    excludePublicationId: isRideSessionActive ? trackedCourseId : null,
    refreshNonce: activityMapRefreshNonce,
  });

  const catalogOverlay = usePublishedCoursesActivityMapOverlay({
    courseIds: catalogCourseIds,
    excludeCourseId: isRideSessionActive ? trackedCourseId : null,
    mapZoom,
    enabled: catalogActivityEnabled,
    /** publication 모드에서도 aggregate·bounds 로드 — gap-fill 에 사용 */
    worldMapRenderEnabled: true,
    refreshNonce: activityMapRefreshNonce,
  });

  const activityWorldRaw = useMemo(
    () =>
      resolveWorldMapOverlay({
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
          pulseDots: publicationOverlay.pulseDots,
          heatDots: publicationOverlay.heatDots,
        },
        publicationPresenceWorldMapEnabled,
      }),
    [
      trackedCourseId,
      activeOverlay,
      catalogOverlay,
      publicationOverlay,
      publicationPresenceWorldMapEnabled,
    ],
  );

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
    if (!import.meta.env.DEV) return;
    try {
      runActivityWorldLodP0Checks();
      runWorldMapOverlayMergeChecks();
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
      publicationPresence: publicationOverlay.overlayStats,
      publicationPresenceEnabled: publicationPresenceWorldMapEnabled,
    });
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
    publicationOverlay.overlayStats,
    publicationPresenceWorldMapEnabled,
  ]);

  const lodDebugPanelProps: ActivityWorldLodDebugPanelProps | null =
    import.meta.env.DEV && import.meta.env.VITE_SHOW_ACTIVITY_LOD_DEBUG === "true"
      ? {
          activityWorldLodDebug,
          mapLodZoom,
          mapZoom,
          mapViewportSpanKm,
          activityWorldRaw,
          activityWorldRender,
          publicationPresenceWorldMapEnabled,
          publicationActiveCount: publicationOverlay.overlayStats.activeCount,
          publicationClosedCount: publicationOverlay.overlayStats.closedCount,
          publicationGeometryReady: publicationOverlay.overlayStats.geometryReady,
          publicationAnchorMissing: publicationOverlay.overlayStats.anchorMissing,
          catalogLiveCandidates: catalogOverlay.overlayStats.liveCandidates,
          catalogHeatCandidates: catalogOverlay.overlayStats.heatCandidates,
          catalogGeometryReady: catalogOverlay.overlayStats.geometryReady,
          catalogActivityRows: catalogOverlay.overlayStats.activityRows,
          catalogAnchorMissing: catalogOverlay.overlayStats.anchorMissing,
          liveActivityCourseIdsCount: liveActivityCourseIds.length,
          catalogCourseIdsCount: catalogCourseIds.length,
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
