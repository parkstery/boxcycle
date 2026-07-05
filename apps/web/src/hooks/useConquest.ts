import type { User } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  loadConquestCellIds,
  loadConquestTraces,
  subscribeConquestSummary,
  type ConquestSummary,
  type ConquestTrace,
} from "../lib/firestoreConquest";

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

  useEffect(() => {
    if (!uid) return;
    return subscribeConquestSummary(uid, (summary) => setSummaryState({ uid, summary }));
  }, [uid]);

  const summary = summaryState?.uid === uid ? summaryState.summary : null;
  const totalMeters = summary?.totalMeters ?? 0;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void loadConquestCellIds(uid)
      .then((ids) => {
        if (!cancelled) setCellsState({ uid, ids });
      })
      .catch(() => {
        if (!cancelled) {
          setCellsState((prev) => (prev?.uid === uid ? prev : { uid, ids: [] }));
        }
      });
    void loadConquestTraces(uid)
      .then((traces) => {
        if (!cancelled) setTracesState({ uid, traces });
      })
      .catch(() => {
        if (!cancelled) {
          setTracesState((prev) => (prev?.uid === uid ? prev : { uid, traces: [] }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid, totalMeters]);

  return {
    summary,
    cellIds: cellsState?.uid === uid ? cellsState.ids : null,
    traces: tracesState?.uid === uid ? tracesState.traces : null,
  };
}
