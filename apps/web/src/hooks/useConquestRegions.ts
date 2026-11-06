import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase/app";
import { loadConquestRegions, type ConquestRegionTotal } from "../lib/conquest/repo/firestoreConquest";

/**
 * 내 도로망 국가별 누적 — 창이 열릴 때 읽되, **같은 계정에서 도로망 합계가 그대로면 다시 읽지 않는다**
 * (창을 여닫을 때마다 읽기가 반복되는 것을 막는다). 구독 없음. 새 주행으로 합계가 바뀌면 다음에 열 때 한 번 더 읽는다.
 */
export function useConquestRegions(userId: string | null, open: boolean, totalMeters: number | null): ConquestRegionTotal[] {
  const [regions, setRegions] = useState<ConquestRegionTotal[]>([]);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !userId || totalMeters == null || !isFirebaseConfigured()) return;
    const stamp = `${userId}:${Math.round(totalMeters)}`;
    if (loadedFor.current === stamp) return;
    let alive = true;
    void loadConquestRegions(userId).then((r) => {
      if (!alive) return;
      loadedFor.current = stamp;
      setRegions(r);
    });
    return () => {
      alive = false;
    };
  }, [open, userId, totalMeters]);
  return regions;
}
