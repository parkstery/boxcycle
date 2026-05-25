import type { ActivityWorldLodDebug, ActivityWorldRawOverlay, ActivityWorldRenderOverlay } from "../../lib/activityWorldLod";

export type ActivityWorldLodDebugPanelProps = {
  activityWorldLodDebug: ActivityWorldLodDebug;
  mapLodZoom: number;
  mapZoom: number;
  mapViewportSpanKm: number | null;
  activityWorldRaw: ActivityWorldRawOverlay;
  activityWorldRender: ActivityWorldRenderOverlay;
  publicationPresenceWorldMapEnabled: boolean;
  publicationActiveCount: number;
  publicationClosedCount: number;
  publicationGeometryReady: number;
  publicationAnchorMissing: number;
  catalogLiveCandidates: number;
  catalogHeatCandidates: number;
  catalogGeometryReady: number;
  catalogActivityRows: number;
  catalogAnchorMissing: number;
  liveCourseRideLines: number;
  liveCourseRideCourses: number;
  liveCourseRideRows: number;
  liveActivityCourseIdsCount: number;
  catalogCourseIdsCount: number;
};

export function ActivityWorldLodDebugPanel(props: ActivityWorldLodDebugPanelProps) {
  const {
    activityWorldLodDebug,
    mapLodZoom,
    mapZoom,
    mapViewportSpanKm,
    activityWorldRaw,
    activityWorldRender,
    publicationPresenceWorldMapEnabled,
    publicationActiveCount,
    publicationClosedCount,
    publicationGeometryReady,
    publicationAnchorMissing,
    catalogLiveCandidates,
    catalogHeatCandidates,
    catalogGeometryReady,
    catalogActivityRows,
    catalogAnchorMissing,
    liveCourseRideLines,
    liveCourseRideCourses,
    liveCourseRideRows,
    liveActivityCourseIdsCount,
    catalogCourseIdsCount,
  } = props;

  return (
    <pre className="activity-world-lod-debug" aria-hidden>
      {`LOD ${activityWorldLodDebug.label} | z ${mapLodZoom.toFixed(1)} (HUD ${mapZoom.toFixed(1)}) span ${
        mapViewportSpanKm != null ? `${mapViewportSpanKm.toFixed(0)}km` : "—"
      }
dots ${activityWorldRaw.pulseDots.length}+${activityWorldRaw.heatDots.length} → ${
        activityWorldRender.pulseDots.length
      } | lines ${activityWorldRaw.pulseRoutes.length} → ${activityWorldRender.pulseRoutes.length}
heat ${
        publicationPresenceWorldMapEnabled ? publicationActiveCount : catalogLiveCandidates
      } live ${
        publicationPresenceWorldMapEnabled ? publicationClosedCount : catalogHeatCandidates
      }
geom ${
        publicationPresenceWorldMapEnabled
          ? `${publicationGeometryReady}/${publicationActiveCount + publicationClosedCount}`
          : `${catalogGeometryReady}/${catalogActivityRows}`
      } anchorMiss ${
        publicationPresenceWorldMapEnabled ? publicationAnchorMissing : catalogAnchorMissing
      }
liveIds ${liveActivityCourseIdsCount} catalog ${catalogCourseIdsCount}
liveRides ${liveCourseRideCourses} rows ${liveCourseRideRows}→line ${liveCourseRideLines}`}
    </pre>
  );
}
