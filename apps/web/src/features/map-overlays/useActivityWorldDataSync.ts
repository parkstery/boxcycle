import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActivityWorldAdaptivePoll } from "../../hooks/useActivityWorldAdaptivePoll";
import {
  countCourseActivityLiveInBatch,
  resolveActivityWorldPollMode,
} from "../../lib/activityWorldPollPolicy";
import {
  getActivityWorldPollSignals,
  reportActivityWorldPollSignals,
} from "../../lib/activityWorldPollSignals";
import {
  fetchCourseActivitiesBatch,
  fetchLiveCourseActivityIds,
  invalidateCourseActivityCache,
  type CourseActivitySnapshot,
} from "../../lib/firestoreCourseActivity";
import { fetchWorldPresenceSummary, formatWorldPresenceHudLine } from "../../lib/firestoreWorldPresence";
import {
  fetchWorldActivityGlobal,
  formatWorldActivityHudLine,
  mergeWorldHudLines,
} from "../../lib/firestoreWorldActivity";
import { isActivityLodDebugPanelEnabled } from "../../lib/mapDebugPhase";

export type UseActivityWorldDataSyncOpts = {
  enabled: boolean;
  selfRideActive: boolean;
  courseIds: readonly string[];
  excludeCourseId: string | null;
  refreshNonce?: number;
};

export type ActivityWorldDataSyncResult = {
  worldHighlightedCourseIds: string[];
  liveActivityCourseIds: string[];
  worldHudLines: string | null;
  activityByCourseId: ReadonlyMap<string, CourseActivitySnapshot | null>;
  syncEpoch: number;
};

/**
 * WO-A: catalog + N×courseActivity batch를 단일 adaptive poll로 동기화(중복 fetch 방지).
 */
export function useActivityWorldDataSync(opts: UseActivityWorldDataSyncOpts): ActivityWorldDataSyncResult {
  const { enabled, selfRideActive, courseIds, excludeCourseId, refreshNonce = 0 } = opts;

  const [worldHighlightedCourseIds, setWorldHighlightedCourseIds] = useState<string[]>([]);
  const [liveActivityCourseIds, setLiveActivityCourseIds] = useState<string[]>([]);
  const [worldHudLines, setWorldHudLines] = useState<string | null>(null);
  const [activityByCourseId, setActivityByCourseId] = useState<
    ReadonlyMap<string, CourseActivitySnapshot | null>
  >(() => new Map());
  const [syncEpoch, setSyncEpoch] = useState(0);

  const courseIdsKey = useMemo(() => [...new Set(courseIds)].sort().join(","), [courseIds]);
  const courseIdsRef = useRef(courseIds);
  courseIdsRef.current = courseIds;
  const highlightedRef = useRef(worldHighlightedCourseIds);
  highlightedRef.current = worldHighlightedCourseIds;
  const liveIdsRef = useRef(liveActivityCourseIds);
  liveIdsRef.current = liveActivityCourseIds;

  const resolveFetchCourseIds = useCallback((): string[] => {
    const merged = new Set<string>(courseIdsRef.current);
    for (const id of highlightedRef.current) merged.add(id);
    for (const id of liveIdsRef.current) merged.add(id);
    return [...merged];
  }, []);
  const excludeRef = useRef(excludeCourseId);
  excludeRef.current = excludeCourseId;
  const selfRideRef = useRef(selfRideActive);
  selfRideRef.current = selfRideActive;

  const runFullSync = useCallback(async (refresh: boolean) => {
    const ids = resolveFetchCourseIds();
    if (refresh && ids.length > 0) {
      invalidateCourseActivityCache([...ids]);
    }

    const [presence, worldActivity, liveIds, batchMap] = await Promise.all([
      fetchWorldPresenceSummary(),
      fetchWorldActivityGlobal(),
      fetchLiveCourseActivityIds(),
      ids.length > 0 ? fetchCourseActivitiesBatch(ids, { refresh }) : Promise.resolve(new Map()),
    ]);

    const worldLivePulseCount = worldActivity?.livePulseCount ?? 0;
    const lastBatchLiveCount = countCourseActivityLiveInBatch(batchMap, excludeRef.current);

    reportActivityWorldPollSignals({
      selfRideActive: selfRideRef.current,
      worldLivePulseCount,
      lastBatchLiveCount,
    });

    const highlighted = new Set<string>(worldActivity?.highlightedCourses ?? []);
    for (const id of liveIds) highlighted.add(id);

    startTransition(() => {
      setLiveActivityCourseIds(liveIds);
      setWorldHighlightedCourseIds([...highlighted]);
      setWorldHudLines(
        mergeWorldHudLines(
          formatWorldPresenceHudLine(presence.regions),
          formatWorldActivityHudLine(worldActivity),
        ),
      );
      setActivityByCourseId(batchMap);
      setSyncEpoch((n) => n + 1);
    });
  }, [resolveFetchCourseIds]);

  const runFullSyncRef = useRef(runFullSync);
  runFullSyncRef.current = runFullSync;

  useEffect(() => {
    if (!enabled) {
      setWorldHudLines(null);
      setWorldHighlightedCourseIds([]);
      setLiveActivityCourseIds([]);
      setActivityByCourseId(new Map());
      reportActivityWorldPollSignals({
        selfRideActive: false,
        worldLivePulseCount: 0,
        lastBatchLiveCount: 0,
      });
    }
  }, [enabled]);

  useActivityWorldAdaptivePoll({
    enabled,
    selfRideActive,
    onTick: () => runFullSyncRef.current(false),
    resolveModeAfterTick: () =>
      isActivityLodDebugPanelEnabled()
        ? "active"
        : resolveActivityWorldPollMode({
            ...getActivityWorldPollSignals(),
            selfRideActive: selfRideRef.current,
          }),
  });

  useEffect(() => {
    if (!enabled || refreshNonce === 0) return;
    void runFullSyncRef.current(true);
  }, [enabled, refreshNonce]);

  void courseIdsKey;

  return {
    worldHighlightedCourseIds,
    liveActivityCourseIds,
    worldHudLines,
    activityByCourseId,
    syncEpoch,
  };
}
