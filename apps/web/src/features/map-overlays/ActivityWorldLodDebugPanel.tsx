import type { MapDebugPhase } from "../../lib/mapDebugPhase";
import type { ActivityWorldLodDebug, ActivityWorldRawOverlay, ActivityWorldRenderOverlay } from "../../lib/activityWorldLod";

export type ActivityWorldLodDebugPanelProps = {
  activityWorldLodDebug: ActivityWorldLodDebug;
  mapLodZoom: number;
  mapZoom: number;
  mapViewportSpanKm: number | null;
  activityWorldRaw: ActivityWorldRawOverlay;
  activityWorldRender: ActivityWorldRenderOverlay;
  /** courseActivity catalog — 지도 merge 전 실데이터 */
  catalogPulseDots: number;
  catalogHeatDots: number;
  catalogPulseRoutes: number;
  mapDebugPhaseEnv: MapDebugPhase | null;
  mapDebugPhaseEffective: MapDebugPhase | null;
  publicationPresenceWorldMapEnabled: boolean;
  publicationActiveCount: number;
  publicationClosedCount: number;
  publicationGeometryReady: number;
  publicationAnchorMissing: number;
  publicationFetchRowCount?: number;
  publicationLastFetchError?: string | null;
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
  mapDebugPhase?: MapDebugPhase | null;
};

export function ActivityWorldLodDebugPanel(props: ActivityWorldLodDebugPanelProps) {
  const {
    activityWorldLodDebug,
    mapLodZoom,
    mapZoom,
    mapViewportSpanKm,
    activityWorldRaw,
    activityWorldRender,
    catalogPulseDots,
    catalogHeatDots,
    catalogPulseRoutes,
    mapDebugPhaseEnv,
    mapDebugPhaseEffective,
    publicationPresenceWorldMapEnabled,
    publicationActiveCount,
    publicationClosedCount,
    publicationGeometryReady,
    publicationAnchorMissing,
    publicationFetchRowCount = 0,
    publicationLastFetchError = null,
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

  const phaseLine =
    mapDebugPhaseEnv == null
      ? "Phase D (catalog)"
      : mapDebugPhaseEffective == null && (mapDebugPhaseEnv === "B" || mapDebugPhaseEnv === "C")
        ? `Phase env=${mapDebugPhaseEnv} → effective D (LOD E2E)`
        : `Phase ${mapDebugPhaseEffective ?? mapDebugPhaseEnv}`;

  return (
    <pre className="activity-world-lod-debug" aria-hidden>
      {`${phaseLine} | LOD ${activityWorldLodDebug.label} | z ${mapLodZoom.toFixed(1)} (HUD ${mapZoom.toFixed(1)}) span ${
        mapViewportSpanKm != null ? `${mapViewportSpanKm.toFixed(0)}km` : "—"
      }
catalog ${catalogPulseDots}+${catalogHeatDots} dot · ${catalogPulseRoutes} line (courseActivity)
map raw ${activityWorldRaw.pulseDots.length}+${activityWorldRaw.heatDots.length} → render ${
        activityWorldRender.pulseDots.length
      }+${activityWorldRender.heatDots.length} | lines ${activityWorldRaw.pulseRoutes.length} → ${
        activityWorldRender.pulseRoutes.length
      }
pulse ${catalogLiveCandidates} heat ${catalogHeatCandidates} (batch live/7d)
geom ${
        publicationPresenceWorldMapEnabled
          ? `${publicationGeometryReady}/${publicationActiveCount + publicationClosedCount}`
          : `${catalogGeometryReady}/${catalogActivityRows}`
      } anchorMiss ${
        publicationPresenceWorldMapEnabled ? publicationAnchorMissing : catalogAnchorMissing
      }
pubFetch ${publicationFetchRowCount}${
        publicationLastFetchError ? ` err ${publicationLastFetchError.slice(0, 40)}` : ""
      }
liveIds ${liveActivityCourseIdsCount} catalog ${catalogCourseIdsCount}
liveRides ${liveCourseRideCourses} rows ${liveCourseRideRows}→line ${liveCourseRideLines}`}
    </pre>
  );
}
