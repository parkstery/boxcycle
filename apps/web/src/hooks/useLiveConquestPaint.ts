import { useEffect, useRef, useState } from "react";
import { CONQUEST_CELL_APPROX_METERS, conquestCellIdAt } from "../lib/conquestTiles";
import { getPointOnRouteByDistance, type LineStringGeometry } from "../lib/geo";

/**
 * Conquest — 주행 중 실시간 「새 도로」 카운터(낙관).
 * 라이더가 새 도로 셀(세션 시작 시점 미보유)에 진입하는 순간을 감지한다.
 * 서버(CF)는 주행 종료 후 한도 적용해 정산 — 이 값은 UI 즉시 피드백 전용.
 *
 * 감지·리셋은 전부 500ms 인터벌 콜백에서 수행(외부 시스템 구독 패턴).
 */
export function useLiveConquestPaint(opts: {
  riding: boolean;
  routeGeometry: LineStringGeometry | null;
  traveledMeters: number;
  /** 서버 확정 내 도로 셀(세션 시작 스냅샷용) */
  serverCellIds: readonly string[] | null;
}): {
  /** 이번 세션에서 새로 밟은 도로 셀 수 */
  liveNewCells: number;
  /** 근사 신규 도로 미터(셀 수 × 셀 크기) — 라이브 표시용 */
  liveNewMeters: number;
} {
  const { riding, routeGeometry, traveledMeters, serverCellIds } = opts;

  const routeRef = useRef(routeGeometry);
  const traveledRef = useRef(traveledMeters);
  const serverRef = useRef(serverCellIds);
  useEffect(() => {
    routeRef.current = routeGeometry;
  }, [routeGeometry]);
  useEffect(() => {
    traveledRef.current = traveledMeters;
  }, [traveledMeters]);
  useEffect(() => {
    serverRef.current = serverCellIds;
  }, [serverCellIds]);

  const [liveNewCells, setLiveNewCells] = useState(0);

  useEffect(() => {
    if (!riding) return;
    let ownedAtStart: ReadonlySet<string> | null = null;
    const visited = new Set<string>();

    const tick = () => {
      if (ownedAtStart === null) {
        // 세션 초기화 — 시작 시점 보유 셀 스냅샷 + 이전 세션 잔여 클리어
        ownedAtStart = new Set(serverRef.current ?? []);
        setLiveNewCells(0);
      }
      const geometry = routeRef.current;
      if (!geometry) return;
      const p = getPointOnRouteByDistance(geometry, traveledRef.current);
      if (!p) return;
      const id = conquestCellIdAt(p);
      if (visited.has(id)) return;
      visited.add(id);
      if (ownedAtStart.has(id)) return; // 이미 내 도로 — 신규 아님
      setLiveNewCells((prev) => prev + 1);
    };

    // 첫 감지는 첫 인터벌 틱(500ms)에서 — effect 본문 동기 setState 회피
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [riding]);

  return {
    liveNewCells,
    liveNewMeters: liveNewCells * CONQUEST_CELL_APPROX_METERS,
  };
}
