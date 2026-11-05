import { useCallback, useMemo, useState } from "react";
import type { GlanceTab } from "../components/leaderboard/LeaderboardGlance";
import { TrailGlanceList } from "../components/trail/TrailGlanceList";
import { listOpenTrailsForDisplay } from "../components/trail/trailGlance";
import { TrailFinderSheet } from "../components/trail/TrailFinderSheet";
import { homeCountryLabel } from "../lib/identity/homeCountry";
import type { TrailInstance } from "../lib/trail/repo/firestoreTrailInstance";
import type { RecentTrailEntry } from "../lib/trail/recentTrails";

type Opts = {
  openTrails: { rows: TrailInstance[]; loading: boolean; error: string | null };
  activeTrailId: string;
  currentTrail: TrailInstance | null;
  rideSessionActive: boolean;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  setMenuOpen: (open: boolean) => void;
  setPanelOpen: (open: boolean) => void;
  /** 「최근 내가 달린 Trail」(10분) */
  recent?: ReadonlyArray<RecentTrailEntry & { remainingMs: number }>;
  /** 대표 국가 — 오른쪽 목록 기본 범위(F1)·Trail 찾기 처음 범위 */
  homeCountry?: string | null;
  /** 내 평균 속도(km/h) — Trail 찾기 예상 시간 */
  avgKmh?: number;
};

/**
 * 오른쪽 목록 자리를 순위·Trail 이 탭으로 나눠 쓴다(Chief 11-02).
 * 메뉴 패널의 「지금 달리는 Trail N개 ›」는 메뉴를 닫고 이 목록의 Trail 탭을 연다.
 */
export function useTrailGlanceTab({ openTrails, activeTrailId, currentTrail, rideSessionActive, onJoinTrail, setMenuOpen, setPanelOpen, recent, homeCountry = null, avgKmh = 20 }: Opts) {
  const [tab, setTab] = useState<GlanceTab>("rank");
  const [finderOpen, setFinderOpen] = useState(false);
  const trails = useMemo(
    () => listOpenTrailsForDisplay(openTrails.rows, activeTrailId, currentTrail, rideSessionActive),
    [openTrails.rows, activeTrailId, currentTrail, rideSessionActive],
  );
  /**
   * F1(2026-11-05 Chief): 대기 중엔 내 대표 국가 Trail 을 사람 많은 순으로 — 없으면 전 세계.
   * 주행 중엔 종전 순서(내 Trail 맨 위) 그대로.
   */
  const shown = useMemo(() => {
    if (rideSessionActive) return { rows: trails, scopeLabel: null as string | null };
    const byRiders = (a: TrailInstance, b: TrailInstance) => (b.liveRiderCount ?? 0) - (a.liveRiderCount ?? 0);
    const mine = homeCountry ? trails.filter((t) => t.geoCountry === homeCountry) : [];
    if (mine.length) return { rows: [...mine].sort(byRiders), scopeLabel: homeCountryLabel(homeCountry!) };
    return { rows: [...trails].sort(byRiders), scopeLabel: "전 세계" };
  }, [trails, rideSessionActive, homeCountry]);
  const joinFromFinder = useCallback(
    (trailId: string, publicationId?: string | null) => {
      setFinderOpen(false);
      onJoinTrail(trailId, publicationId);
    },
    [onJoinTrail],
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
          <TrailGlanceList trails={shown.rows} activeTrailId={activeTrailId} rideSessionActive={rideSessionActive}
            loading={openTrails.loading} error={openTrails.error} onJoinTrail={onJoinTrail} recent={recent}
            scopeLabel={shown.scopeLabel} onOpenFinder={() => setFinderOpen(true)} />
        ),
      },
    }),
    [tab, trails.length, shown, activeTrailId, rideSessionActive, openTrails.loading, openTrails.error, onJoinTrail, recent],
  );
  const finderSheet = finderOpen ? (
    <TrailFinderSheet onClose={() => setFinderOpen(false)} homeCountry={homeCountry} avgKmh={avgKmh}
      onJoinTrail={joinFromFinder} rideSessionActive={rideSessionActive} />
  ) : null;
  return { glance, showTrailList, finderSheet };
}
