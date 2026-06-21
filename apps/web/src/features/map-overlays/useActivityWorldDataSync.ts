import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useActivityWorldAdaptivePoll } from "../../hooks/useActivityWorldAdaptivePoll";
import {
  countRouteActivityLiveInBatch,
  resolveActivityWorldPollMode,
} from "../../lib/activityWorldPollPolicy";
import {
  getActivityWorldPollSignals,
  isPostRideActivityWatchActive,
  reportActivityWorldPollSignals,
} from "../../lib/activityWorldPollSignals";
import {
  fetchRouteActivitiesBatch,
  fetchLiveRouteActivityIds,
  invalidateRouteActivityCache,
  type RouteActivitySnapshot,
} from "../../lib/firestoreRouteActivity";
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
  publicationIds: readonly string[];
  excludePublicationId: string | null;
  refreshNonce?: number;
};

export type ActivityWorldDataSyncResult = {
  worldHighlightedPublicationIds: string[];
  liveActivityPublicationIds: string[];
  worldHudLines: string | null;
  activityByPublicationId: ReadonlyMap<string, RouteActivitySnapshot | null>;
  syncEpoch: number;
};

/**
 * WO-A: catalog + N×routeActivity batch를 단일 adaptive poll로 동기화(중복 fetch 방지).
 */
export function useActivityWorldDataSync(opts: UseActivityWorldDataSyncOpts): ActivityWorldDataSyncResult {
  const { enabled, selfRideActive, publicationIds, excludePublicationId, refreshNonce = 0 } = opts;

  const [worldHighlightedPublicationIds, setWorldHighlightedPublicationIds] = useState<string[]>([]);
  const [liveActivityPublicationIds, setLiveActivityPublicationIds] = useState<string[]>([]);
  const [worldHudLines, setWorldHudLines] = useState<string | null>(null);
  const [activityByPublicationId, setActivityByPublicationId] = useState<
    ReadonlyMap<string, RouteActivitySnapshot | null>
  >(() => new Map());
  const [syncEpoch, setSyncEpoch] = useState(0);

  const publicationIdsKey = useMemo(() => [...new Set(publicationIds)].sort().join(","), [publicationIds]);
  const publicationIdsRef = useRef(publicationIds);
  publicationIdsRef.current = publicationIds;
  const highlightedRef = useRef(worldHighlightedPublicationIds);
  highlightedRef.current = worldHighlightedPublicationIds;
  const liveIdsRef = useRef(liveActivityPublicationIds);
  liveIdsRef.current = liveActivityPublicationIds;

  const resolveFetchPublicationIds = useCallback((): string[] => {
    const merged = new Set<string>(publicationIdsRef.current);
    for (const id of highlightedRef.current) merged.add(id);
    for (const id of liveIdsRef.current) merged.add(id);
    return [...merged];
  }, []);
  const excludeRef = useRef(excludePublicationId);
  excludeRef.current = excludePublicationId;
  const selfRideRef = useRef(selfRideActive);
  selfRideRef.current = selfRideActive;

  const runFullSync = useCallback(async (refresh: boolean) => {
    const ids = resolveFetchPublicationIds();
    if (refresh && ids.length > 0) {
      invalidateRouteActivityCache([...ids]);
    }

    const [presence, worldActivity, liveIds, batchMap] = await Promise.all([
      fetchWorldPresenceSummary(),
      fetchWorldActivityGlobal(),
      fetchLiveRouteActivityIds(),
      ids.length > 0 ? fetchRouteActivitiesBatch(ids, { refresh }) : Promise.resolve(new Map()),
    ]);

    const worldLivePulseCount = worldActivity?.livePulseCount ?? 0;
    const lastBatchLiveCount = countRouteActivityLiveInBatch(batchMap, excludeRef.current);

    reportActivityWorldPollSignals({
      selfRideActive: selfRideRef.current,
      worldLivePulseCount,
      lastBatchLiveCount,
    });

    const highlighted = new Set<string>(worldActivity?.highlightedPublications ?? []);
    for (const id of liveIds) highlighted.add(id);

    startTransition(() => {
      setLiveActivityPublicationIds(liveIds);
      setWorldHighlightedPublicationIds([...highlighted]);
      setWorldHudLines(
        mergeWorldHudLines(
          formatWorldPresenceHudLine(presence.regions),
          formatWorldActivityHudLine(worldActivity),
        ),
      );
      setActivityByPublicationId(batchMap);
      setSyncEpoch((n) => n + 1);
    });
  }, [resolveFetchPublicationIds]);

  const runFullSyncRef = useRef(runFullSync);
  runFullSyncRef.current = runFullSync;

  useEffect(() => {
    if (!enabled) {
      setWorldHudLines(null);
      setWorldHighlightedPublicationIds([]);
      setLiveActivityPublicationIds([]);
      setActivityByPublicationId(new Map());
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
    onTick: () => runFullSyncRef.current(isPostRideActivityWatchActive()),
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

  void publicationIdsKey;

  return {
    worldHighlightedPublicationIds,
    liveActivityPublicationIds,
    worldHudLines,
    activityByPublicationId,
    syncEpoch,
  };
}
