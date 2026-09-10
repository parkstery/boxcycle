import { useEffect, useRef, useState } from "react";
import { buildConquestCellsFromRoute } from "../lib/conquestTiles";
import type { LineStringGeometry } from "../lib/geo";

/**
 * 세션 구간 셀 중 시작 시점 미보유 셀의 실제 경로 미터 합.
 * 서버 `conquestOnRideCreated` 와 같은 `buildConquestCellsFromRoute` 미터를 쓴다.
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
 *
 * HUD 깜빡임 방지: `sessionArmed` 전에는 meters를 0으로 노출한다.
 * (이전 세션 state가 남아 시작 순간 잠깐 보이다 사라지는 현상)
 */
export function useLiveConquestPaint(opts: {
  riding: boolean;
  routeGeometry: LineStringGeometry | null;
  traveledMeters: number;
  fromMeters?: number;
  serverCellIds: readonly string[] | null;
}): {
  liveNewCells: number;
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
  /** 이번 주행에서 소유 스냅샷+1회 계산이 끝난 뒤에만 HUD에 실값 노출 */
  const [sessionArmed, setSessionArmed] = useState(false);

  useEffect(() => {
    if (!riding) {
      const clearTimer = setTimeout(() => {
        setLiveNewCells(0);
        setLiveNewMeters(0);
        setSessionArmed(false);
      }, 0);
      return () => clearTimeout(clearTimer);
    }

    let ownedAtStart: ReadonlySet<string> | null = null;

    const tick = () => {
      const cellsNow = serverRef.current;
      // 소유 맵 도착 전엔 armed 하지 않음 — 빈 스냅샷 과대/깜빡임 방지
      if (cellsNow == null) return;

      if (ownedAtStart === null) {
        ownedAtStart = new Set(cellsNow);
      }
      const geometry = routeRef.current;
      if (!geometry) {
        setLiveNewCells(0);
        setLiveNewMeters(0);
        setSessionArmed(true);
        return;
      }
      const next = computeLiveNewRoadFromRoute({
        geometry,
        traveledMeters: traveledRef.current,
        fromMeters: fromRef.current,
        ownedAtStart,
      });
      setLiveNewCells(next.liveNewCells);
      setLiveNewMeters(next.liveNewMeters);
      setSessionArmed(true);
    };

    // 외부 타이머 콜백에서 setState (effect 본문 동기 setState 회피)
    const boot = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => {
      clearTimeout(boot);
      clearInterval(timer);
    };
  }, [riding]);

  if (!riding || !sessionArmed) {
    return { liveNewCells: 0, liveNewMeters: 0 };
  }
  return { liveNewCells, liveNewMeters };
}
