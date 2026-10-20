import { restoreRecentRoadDisplay } from "../lib/conquest/recentNewRoadDisplay";
import type { User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  loadConquestCellDays,
  loadConquestTraces,
  subscribeRecentNewRoad,
  subscribeConquestSummary,
  type ConquestSummary,
  type ConquestTrace,
  type RecentNewRoad,
} from "../lib/conquest/repo/firestoreConquest";

/**
 * Conquest(정복) 상태 — 요약(onSnapshot) + 내 도로 셀 + 「내 도로망」 궤적.
 * 셀·궤적은 totalMeters 변화(=CF 집계 완료)를 신호로 재로드한다.
 * 상태는 uid 와 짝지어 저장 — 로그아웃/계정 전환 시 이전 사용자 데이터가 새지 않는다.
 */
export function useConquest(
  user: User | null,
  configured: boolean,
): {
  summary: ConquestSummary | null;
  cellIds: string[] | null;
  traces: ConquestTrace[] | null;
  recentNewRoad: RecentNewRoad | null;
} {
  const uid = configured ? (user?.uid ?? null) : null;

  const [summaryState, setSummaryState] = useState<{
    uid: string;
    summary: ConquestSummary | null;
  } | null>(null);
  const [cellsState, setCellsState] = useState<{ uid: string; ids: string[] } | null>(null);
  const [tracesState, setTracesState] = useState<{
    uid: string;
    traces: ConquestTrace[];
  } | null>(null);
  const [restoredRecentState, setRestoredRecentState] = useState<{ uid: string; recent: RecentNewRoad | null } | null>(null);
  const [recentNewRoadState, setRecentNewRoadState] = useState<{
    uid: string;
    recent: RecentNewRoad | null;
  } | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeConquestSummary(uid, (summary) => setSummaryState({ uid, summary }));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeRecentNewRoad(uid, (recent) => setRecentNewRoadState({ uid, recent }));
  }, [uid]);

  const summary = summaryState?.uid === uid ? summaryState.summary : null;
  const totalMeters = summary?.totalMeters ?? 0;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void Promise.allSettled([loadConquestCellDays(uid), loadConquestTraces(uid)])
      .then(([cellsResult, tracesResult]) => {
        if (cancelled) return;
        if (cellsResult.status === "fulfilled") setCellsState({ uid, ids: [...cellsResult.value.keys()] });
        else setCellsState((prev) => (prev?.uid === uid ? prev : { uid, ids: [] }));
        if (tracesResult.status === "fulfilled") setTracesState({ uid, traces: tracesResult.value });
        else setTracesState((prev) => (prev?.uid === uid ? prev : { uid, traces: [] }));
        if (cellsResult.status === "fulfilled" && tracesResult.status === "fulfilled") {
          const restored = restoreRecentRoadDisplay(cellsResult.value, tracesResult.value);
          setRestoredRecentState({ uid, recent: restored ? { ...restored, newMeters: 0 } : null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid, totalMeters]);

  const persisted = recentNewRoadState?.uid === uid ? recentNewRoadState.recent : null;
  const restored = restoredRecentState?.uid === uid ? restoredRecentState.recent : null;

  const recentNewRoad = useMemo(() => {
    if (!persisted) return restored;
    if (!restored || persisted.day > restored.day) return persisted;
    if (restored.day > persisted.day) return restored;
    // The new server document may cover only rides after its deployment.
    return { ...persisted, geometry: [...restored.geometry, ...persisted.geometry] };
  }, [persisted, restored]);

  return {
    summary,
    cellIds: cellsState?.uid === uid ? cellsState.ids : null,
    traces: tracesState?.uid === uid ? tracesState.traces : null,
    recentNewRoad,
  };
}
