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

/** cellIds 미도착 시 빈 스냅샷으로 넘어가기 전 대기 틱(250ms × 8 ≈ 2초) */
const OWNED_SNAPSHOT_WAIT_TICKS = 8;

/**
 * Conquest — 주행 중 실시간 「새 도로」 카운터(낙관).
 *
 * `liveNewMeters === null` → 아직 세션 미무장(HUD 숨김, 이전 잔여 비노출)
 * `liveNewMeters === 0` → 무장됨·신규 없음(이미 내 도로만) — HUD에 +0.00 표시
 * `liveNewMeters > 0` → 신규 구간
 */
export function useLiveConquestPaint(opts: {
  riding: boolean;
  routeGeometry: LineStringGeometry | null;
  traveledMeters: number;
  fromMeters?: number;
  serverCellIds: readonly string[] | null;
}): {
  liveNewCells: number;
  /** null = 미무장(비표시). 0 이상 = 무장·표시 */
  liveNewMeters: number | null;
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
    let waitTicks = 0;

    const tick = () => {
      if (ownedAtStart === null) {
        const cellsNow = serverRef.current;
        if (cellsNow == null) {
          waitTicks += 1;
          if (waitTicks < OWNED_SNAPSHOT_WAIT_TICKS) return;
          ownedAtStart = new Set();
        } else {
          ownedAtStart = new Set(cellsNow);
        }
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

    const boot = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => {
      clearTimeout(boot);
      clearInterval(timer);
    };
  }, [riding]);

  if (!riding || !sessionArmed) {
    return { liveNewCells: 0, liveNewMeters: null };
  }
  return { liveNewCells, liveNewMeters };
}
