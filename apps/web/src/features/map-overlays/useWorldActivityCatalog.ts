import { useEffect, useState } from "react";
import { fetchLiveCourseActivityIds } from "../../lib/firestoreCourseActivity";
import { fetchWorldPresenceSummary, formatWorldPresenceHudLine } from "../../lib/firestoreWorldPresence";
import {
  fetchWorldActivityGlobal,
  formatWorldActivityHudLine,
  mergeWorldHudLines,
} from "../../lib/firestoreWorldActivity";
import { WORLD_PRESENCE_POLL_MS } from "../../lib/rideSyncPolicy";

/** 카탈로그·Activity World overlay 후보 코스 ID + HUD 라인 */
export function useWorldActivityCatalog(opts: {
  configured: boolean;
  user: unknown;
  pageVisible: boolean;
}): {
  worldHighlightedCourseIds: string[];
  liveActivityCourseIds: string[];
  worldHudLines: string | null;
} {
  const { configured, user, pageVisible } = opts;
  const [worldHighlightedCourseIds, setWorldHighlightedCourseIds] = useState<string[]>([]);
  const [liveActivityCourseIds, setLiveActivityCourseIds] = useState<string[]>([]);
  const [worldHudLines, setWorldHudLines] = useState<string | null>(null);

  useEffect(() => {
    if (!configured || !user || !pageVisible) {
      setWorldHudLines(null);
      setWorldHighlightedCourseIds([]);
      setLiveActivityCourseIds([]);
      return;
    }
    let cancelled = false;
    const load = () => {
      void (async () => {
        const [presence, worldActivity, liveIds] = await Promise.all([
          fetchWorldPresenceSummary(),
          fetchWorldActivityGlobal(),
          fetchLiveCourseActivityIds(),
        ]);
        if (cancelled) return;
        setLiveActivityCourseIds(liveIds);
        const highlighted = new Set<string>(worldActivity?.highlightedCourses ?? []);
        for (const id of liveIds) highlighted.add(id);
        setWorldHighlightedCourseIds([...highlighted]);
        setWorldHudLines(
          mergeWorldHudLines(
            formatWorldPresenceHudLine(presence.regions),
            formatWorldActivityHudLine(worldActivity),
          ),
        );
      })();
    };
    load();
    const id = window.setInterval(load, WORLD_PRESENCE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [configured, user, pageVisible]);

  return { worldHighlightedCourseIds, liveActivityCourseIds, worldHudLines };
}
