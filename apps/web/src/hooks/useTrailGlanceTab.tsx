import { useCallback, useMemo, useState } from "react";
import type { GlanceTab } from "../components/leaderboard/LeaderboardGlance";
import { TrailGlanceList } from "../components/trail/TrailGlanceList";
import { listOpenTrailsForDisplay } from "../components/trail/trailGlance";
import type { TrailInstance } from "../lib/trail/repo/firestoreTrailInstance";

type Opts = {
  openTrails: { rows: TrailInstance[]; loading: boolean; error: string | null };
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  rideSessionActive: boolean;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
};

/**
 * 오른쪽 목록 자리를 순위·Trail 이 탭으로 나눠 쓴다(Chief 11-02).
 * 메뉴 패널의 「지금 달리는 Trail N개 ›」는 메뉴를 닫고 이 목록의 Trail 탭을 연다.
 */
export function useTrailGlanceTab({ openTrails, activeTrailId, currentTrail, rideSessionActive, onJoinTrail, setMenuOpen, setPanelOpen }: Opts) {
  const [tab, setTab] = useState<GlanceTab>("rank");
  const trails = useMemo(
    () => listOpenTrailsForDisplay(openTrails.rows, activeTrailId, currentTrail, rideSessionActive),
    [openTrails.rows, activeTrailId, currentTrail, rideSessionActive],
  );
  const showTrailList = useCallback(() => {
    setMenuOpen(false);
    setTab("trail");
    setPanelOpen(true);
  }, [setMenuOpen, setPanelOpen]);
  const glance = useMemo(
    () => ({
      tab,
      onTab: setTab,
      trail: {
        count: trails.length,
        list: (
          <TrailGlanceList trails={trails} activeTrailId={activeTrailId} rideSessionActive={rideSessionActive}
            loading={openTrails.loading} error={openTrails.error} onJoinTrail={onJoinTrail} />
        ),
      },
    }),
    [tab, trails, activeTrailId, rideSessionActive, openTrails.loading, openTrails.error, onJoinTrail],
  );
  return { glance, showTrailList };
}
