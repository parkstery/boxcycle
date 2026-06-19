import { useEffect, useRef, useState } from "react";
import { fetchLiveRouteActivityIds } from "../../lib/firestoreRouteActivity";
import { fetchWorldPresenceSummary, formatWorldPresenceHudLine } from "../../lib/firestoreWorldPresence";
import {
  fetchWorldActivityGlobal,
  formatWorldActivityHudLine,
  mergeWorldHudLines,
} from "../../lib/firestoreWorldActivity";
import { useActivityWorldAdaptivePoll } from "../../hooks/useActivityWorldAdaptivePoll";
import { resolveActivityWorldPollMode } from "../../lib/activityWorldPollPolicy";
import { getActivityWorldPollSignals } from "../../lib/activityWorldPollSignals";

/**
 * @deprecated `useActivityWorldDataSync` 사용. 디버그·레거시 호출만 유지.
 * 카탈로그·Activity World overlay 후보 코스 ID + HUD 라인
 */
export function useWorldActivityCatalog(opts: {
  configured: boolean;
  user: unknown;
  pageVisible: boolean;
  selfRideActive?: boolean;
}): {
  worldHighlightedCourseIds: string[];
  liveActivityCourseIds: string[];
  worldHudLines: string | null;
} {
  const { configured, user, pageVisible, selfRideActive = false } = opts;
  const [worldHighlightedCourseIds, setWorldHighlightedCourseIds] = useState<string[]>([]);
  const [liveActivityCourseIds, setLiveActivityCourseIds] = useState<string[]>([]);
  const [worldHudLines, setWorldHudLines] = useState<string | null>(null);

  const loadRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    loadRef.current = async () => {
      const [presence, worldActivity, liveIds] = await Promise.all([
        fetchWorldPresenceSummary(),
        fetchWorldActivityGlobal(),
        fetchLiveRouteActivityIds(),
      ]);
      setLiveActivityCourseIds(liveIds);
      const highlighted = new Set<string>(worldActivity?.highlightedPublications ?? []);
      for (const id of liveIds) highlighted.add(id);
      setWorldHighlightedCourseIds([...highlighted]);
      setWorldHudLines(
        mergeWorldHudLines(
          formatWorldPresenceHudLine(presence.regions),
          formatWorldActivityHudLine(worldActivity),
        ),
      );
    };
  });

  const enabled = Boolean(configured && user && pageVisible);

  useActivityWorldAdaptivePoll({
    enabled,
    selfRideActive,
    onTick: () => loadRef.current(),
    resolveModeAfterTick: () =>
      resolveActivityWorldPollMode({
        ...getActivityWorldPollSignals(),
        selfRideActive,
      }),
  });

  useEffect(() => {
    if (!enabled) {
      setWorldHudLines(null);
      setWorldHighlightedCourseIds([]);
      setLiveActivityCourseIds([]);
    }
  }, [enabled]);

  return { worldHighlightedCourseIds, liveActivityCourseIds, worldHudLines };
}
