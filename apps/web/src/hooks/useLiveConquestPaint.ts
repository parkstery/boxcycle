import { useEffect, useRef, useState } from "react";
import { buildConquestCellsFromRoute } from "../lib/conquestTiles";
import type { LineStringGeometry } from "../lib/geo";

/**
 * 세션 구간 셀 중 시작 시점 미보유 셀의 실제 경로 미터 합.
 * 서버 `conquestOnRideCreated` 와 같은 `buildConquestCellsFromRoute` 미터를 써서
 * 「처음 달리는 도로」에서 HUD 거리와 새 도로가 어긋나지 않게 한다.
 * (구: 셀 수 × 30m 근사 — 실제 80m 주행에 +150m 로 보이던 원인)
 */
export function computeLiveNewRoadFromRoute(opts: {
  geometry: LineStringGeometry;
  traveledMeters: number;
  /** 재개 offset — 이번 세션 실주행 구간만 (Claim 페이로드와 동일) */
  fromMeters?: number;
  ownedAtStart: ReadonlySet<string>;
}): { liveNewCells: number; liveNewMeters: number } {
  const from = Math.max(0, opts.fromMeters ?? 0);
  const cells = buildConquestCellsFromRoute(opts.geometry, opts.traveledMeters, from);
  let liveNewCells = 0;
  let liveNewMeters = 0;
  for (const c of cells) {
    if (opts.ownedAtStart.has(c.id)) continue;
    liveNewCells += 1;
    liveNewMeters += c.m;
  }
  return { liveNewCells, liveNewMeters };
}

/**
 * Conquest — 주행 중 실시간 「새 도로」 카운터(낙관).
 * 서버(CF)는 주행 종료 후 한도 적용해 정산 — 이 값은 UI 즉시 피드백 전용.
 *
 * 감지·리셋은 전부 500ms 인터벌 콜백에서 수행(외부 시스템 구독 패턴).
 */
export function useLiveConquestPaint(opts: {
  riding: boolean;
  routeGeometry: LineStringGeometry | null;
  traveledMeters: number;
  /** 세션 시작 offset(m). 재개 시 이전 구간을 새 도로에 넣지 않는다. */
  fromMeters?: number;
  /** 서버 확정 내 도로 셀(세션 시작 스냅샷용) */
  serverCellIds: readonly string[] | null;
}): {
  /** 이번 세션에서 새로 밟은 도로 셀 수 */
  liveNewCells: number;
  /** 신규 도로 미터(경로 실측, 미보유 셀만) — 라이브 표시용 */
  liveNewMeters: number;
} {
  const { riding, routeGeometry, traveledMeters, fromMeters = 0, serverCellIds } = opts;

  const routeRef = useRef(routeGeometry);
  const traveledRef = useRef(traveledMeters);
  const fromRef = useRef(fromMeters);
  const serverRef = useRef(serverCellIds);
  useEffect(() => {
    routeRef.current = routeGeometry;
  }, [routeGeometry]);
  useEffect(() => {
    traveledRef.current = traveledMeters;
  }, [traveledMeters]);
  useEffect(() => {
    fromRef.current = fromMeters;
  }, [fromMeters]);
  useEffect(() => {
    serverRef.current = serverCellIds;
  }, [serverCellIds]);

  const [liveNewCells, setLiveNewCells] = useState(0);
  const [liveNewMeters, setLiveNewMeters] = useState(0);

  useEffect(() => {
    if (!riding) return;
    let ownedAtStart: ReadonlySet<string> | null = null;

    const tick = () => {
      if (ownedAtStart === null) {
        ownedAtStart = new Set(serverRef.current ?? []);
        setLiveNewCells(0);
        setLiveNewMeters(0);
      }
      const geometry = routeRef.current;
      if (!geometry) return;
      const { liveNewCells: cells, liveNewMeters: meters } = computeLiveNewRoadFromRoute({
        geometry,
        traveledMeters: traveledRef.current,
        fromMeters: fromRef.current,
        ownedAtStart,
      });
      setLiveNewCells(cells);
      setLiveNewMeters(meters);
    };

    // 시작 직후 1회 — setInterval만 쓰면 첫 표시가 최대 500ms 늦음
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [riding]);

  return {
    liveNewCells,
    liveNewMeters,
  };
}
