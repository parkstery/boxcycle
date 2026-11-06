import { useCallback, useMemo, useState } from "react";
import type { GlanceTab } from "../components/leaderboard/LeaderboardGlance";
import { TrailGlanceList } from "../components/trail/TrailGlanceList";
import { listOpenTrailsForDisplay } from "../components/trail/trailGlance";
import type { TrailInstance } from "../lib/trail/repo/firestoreTrailInstance";
import { ListRegionChip } from "../components/ui/ListRegionChip";
import { useListRegion } from "./useListRegion";
import { filterByRegion, regionLabel, WORLD_REGION } from "../lib/geo/listRegionFilter";

type Opts = {
  openTrails: { rows: TrailInstance[]; loading: boolean; error: string | null };
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  rideSessionActive: boolean;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  /** 내 국가 — 지역 칩 메뉴의 「내 국가」 */
  homeCountry?: string | null;
};

/**
 * 오른쪽 목록 자리를 순위·Trail 이 탭으로 나눠 쓴다(Chief 11-02).
 * 메뉴 패널의 「지금 달리는 Trail N개 ›」는 메뉴를 닫고 이 목록의 Trail 탭을 연다.
 */
export function useTrailGlanceTab({ openTrails, activeTrailId, currentTrail, rideSessionActive, onJoinTrail, setMenuOpen, setPanelOpen, homeCountry = null }: Opts) {
  const [tab, setTab] = useState<GlanceTab>("rank");
  const trails = useMemo(
    () => listOpenTrailsForDisplay(openTrails.rows, activeTrailId, currentTrail, rideSessionActive),
    [openTrails.rows, activeTrailId, currentTrail, rideSessionActive],
  );
  /*
   * 지역 칩(Chief 11-06 A안): 실시간 목록(최대 40개)에서 이미 받은 행을 클라이언트에서 거를 뿐, 새 읽기는 없다.
   * 탭의 개수와 메뉴의 「지금 달리는 Trail N개」는 지역과 무관한 전체 수를 그대로 쓴다.
   */
  const { region, recents, pick } = useListRegion("trail");
  const shownTrails = useMemo(
    () => filterByRegion(trails, region, (t) => t),
    [trails, region],
  );
  const [pulse, setPulse] = useState(0);
  const showTrailList = useCallback(() => {
    setPulse((n) => n + 1);
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
        pulse,
        headTool: (
          <ListRegionChip region={region} recents={recents} geos={trails} homeCountry={homeCountry}
            onPick={pick} variant="glance" />
        ),
        list: (
          <TrailGlanceList trails={shownTrails} activeTrailId={activeTrailId} rideSessionActive={rideSessionActive}
            loading={openTrails.loading} error={openTrails.error} onJoinTrail={onJoinTrail}
            emptyRegionLabel={trails.length > 0 && shownTrails.length === 0 ? regionLabel(region) : null}
            onWiden={() => pick(WORLD_REGION)} />
        ),
      },
    }),
    [tab, pulse, trails, shownTrails, region, recents, pick, homeCountry, activeTrailId, rideSessionActive, openTrails.loading, openTrails.error, onJoinTrail],
  );
  return { glance, showTrailList };
}
