import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scheduleRideStartCountdown } from "../lib/ride/startCountdown";
import type { LineStringGeometry } from "../lib/geo/geo";

export function useRideStartCountdown(route: LineStringGeometry | null, userId: string | undefined) {
  const [value, setValue] = useState<number | null>(null);
  // Trail 메타 수신으로 같은 좌표의 새 객체를 받아도 준비를 취소하지 않는다.
  const routeKey = useMemo(() => JSON.stringify(route?.coordinates ?? null), [route]);
  const context = useMemo(() => ({ routeKey, userId }), [routeKey, userId]);
  const contextRef = useRef<object | null>(null);
  const pendingRef = useRef<ReturnType<typeof scheduleRideStartCountdown> | null>(null);
  useEffect(() => {
    contextRef.current = context;
    return () => {
      contextRef.current = null;
      pendingRef.current?.cancel();
      pendingRef.current = null;
    };
  }, [context]);
  const start = useCallback(async () => {
    // 네트워크 준비 중 경로·계정이 바뀐 이전 요청도 시작하지 않는다.
    if (contextRef.current !== context) return false;
    pendingRef.current?.cancel();
    const pending = scheduleRideStartCountdown(setValue);
    pendingRef.current = pending;
    const ready = await pending.promise;
    if (pendingRef.current === pending) pendingRef.current = null;
    return ready && contextRef.current === context;
  }, [context]);
  return { value, start };
}
