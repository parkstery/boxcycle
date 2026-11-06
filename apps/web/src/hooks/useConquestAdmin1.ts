import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase/app";
import { loadConquestAdmin1, type ConquestRegionTotal } from "../lib/conquest/repo/firestoreConquest";
import { admin1Label, loadAdmin1Names, type Admin1Names } from "../lib/geo/admin1Names";

type Admin1State = { country: string | null; admin1s: ConquestRegionTotal[]; names: Admin1Names };

/**
 * 고른 국가의 행정구역 누적과 이름 — 국가를 고를 때만 읽고, 같은 계정·같은 국가에서 도로망 합계가 그대로면 다시 읽지 않는다.
 * 이름 표는 정적 파일(국가별 한 번)이라 Firestore 읽기가 아니다. 국가가 없으면(세계) 아무것도 읽지 않는다.
 */
export function useConquestAdmin1(
  userId: string | null,
  country: string | null,
  totalMeters: number | null,
): { admin1s: ConquestRegionTotal[]; label: (code: string) => string } {
  const [state, setState] = useState<Admin1State>({ country: null, admin1s: [], names: {} });
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || !country || totalMeters == null || !isFirebaseConfigured()) return;
    const stamp = `${userId}:${country}:${Math.round(totalMeters)}`;
    if (loadedFor.current === stamp) return;
    let alive = true;
    void Promise.all([loadConquestAdmin1(userId, country), loadAdmin1Names(country)]).then(([admin1s, names]) => {
      if (!alive) return;
      loadedFor.current = stamp;
      setState({ country, admin1s, names });
    });
    return () => {
      alive = false;
    };
  }, [userId, country, totalMeters]);
  // 국가를 바꾼 직후 이전 국가의 목록이 잠깐 보이지 않게 한다
  const admin1s = state.country === country ? state.admin1s : [];
  return { admin1s, label: (code: string) => admin1Label(code, state.names) };
}
