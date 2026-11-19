import { restoreRecentRoadDisplay } from "../lib/conquest/recentNewRoadDisplay";
import type { User } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  loadConquestRoadData,
  subscribeRecentNewRoad,
  subscribeConquestSummary,
  type ConquestSummary,
  type ConquestTrace,
  type RecentNewRoad,
} from "../lib/conquest/repo/firestoreConquest";
import { roadSyncKey, type RoadSyncToken } from "../lib/conquest/conquestRoadSync";

function loadRoadData(uid: string, token: RoadSyncToken | null) {
  const data = loadConquestRoadData(uid, token);
  return Promise.allSettled([data.then(s => s.cellDays), data.then(s => s.traces)]);
}

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
  const loadingRef = useRef<{
    uid: string;
    totalMeters: number;
    syncKey: string;
    promise: ReturnType<typeof loadRoadData>;
  } | null>(null);

  const [summaryState, setSummaryState] = useState<{
    uid: string;
    summary: ConquestSummary | null;
    ready: boolean;
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
    return subscribeConquestSummary(uid, (summary, fromCache = false) =>
      setSummaryState({ uid, summary, ready: summary !== null || !fromCache }));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeRecentNewRoad(uid, (recent) => setRecentNewRoadState({ uid, recent }));
  }, [uid]);

  const summary = summaryState?.uid === uid ? summaryState.summary : null;
  // null summary after a response (new Guest / legacy orphan) is different from
  // not having received this uid's summary yet. Do not load first with a fake 0.
  const summaryReady = uid !== null && summaryState?.uid === uid && summaryState.ready;
  const totalMeters = summary?.totalMeters ?? 0;
  const syncEpoch = summary?.roadSync?.epoch ?? null;
  const syncVersion = summary?.roadSync?.version ?? 0;
  const syncToken = useMemo<RoadSyncToken | null>(() =>
    syncEpoch === null ? null : { schema: 1, epoch: syncEpoch, version: syncVersion }, [syncEpoch, syncVersion]);

  useEffect(() => {
    if (!uid || !summaryReady) return;
    let cancelled = false;
    const syncKey = roadSyncKey(syncToken);
    const current = loadingRef.current;
    const promise = current?.uid === uid && current.totalMeters === totalMeters && current.syncKey === syncKey
      ? current.promise
      : loadRoadData(uid, syncToken);
    loadingRef.current = { uid, totalMeters, syncKey, promise };
    void promise
      .then(([cellsResult, tracesResult]) => {
        if (loadingRef.current?.promise === promise) loadingRef.current = null;
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
  }, [uid, summaryReady, totalMeters, syncToken]);

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
