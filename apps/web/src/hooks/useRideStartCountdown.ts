import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { scheduleRideStartCountdown } from "../lib/ride/startCountdown";
import type { LineStringGeometry } from "../lib/geo/geo";

export function useRideStartCountdown(route: LineStringGeometry | null, userId: string | undefined) {
  const [value, setValue] = useState<number | null>(null);
  const [staging, setStaging] = useState(false);
  const routeKey = useMemo(() => JSON.stringify(route?.coordinates ?? null), [route]);
  const context = useMemo(() => ({ routeKey, userId }), [routeKey, userId]);
  const contextRef = useRef<object | null>(null);
  const pendingRef = useRef<{ cancel: () => void; activate: () => void } | null>(null);
  useEffect(() => {
    contextRef.current = context;
    return () => {
      contextRef.current = null;
      pendingRef.current?.cancel();
      pendingRef.current = null;
    };
  }, [context]);
  const start = useCallback((): Promise<boolean> => {
    if (contextRef.current !== context) return Promise.resolve(false);
    pendingRef.current?.cancel();
    setStaging(true);
    return new Promise<boolean>((resolve, reject) => {
      let timer: ReturnType<typeof scheduleRideStartCountdown> | null = null;
      let preparationTimer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;
      const finish = (ready: boolean, error?: Error) => {
        if (settled) return;
        settled = true;
        if (preparationTimer) clearTimeout(preparationTimer);
        timer?.cancel();
        setValue(null);
        setStaging(false);
        pendingRef.current = null;
        if (error) reject(error);
        else resolve(ready && contextRef.current === context);
      };
      preparationTimer = setTimeout(() => finish(false, new Error("출발 화면을 준비하지 못했어요. 다시 출발을 눌러 주세요.")), 20000);
      pendingRef.current = {
        cancel: () => finish(false),
        activate: () => {
          if (timer || settled) return;
          if (contextRef.current !== context) { finish(false); return; }
          if (preparationTimer) clearTimeout(preparationTimer);
          timer = scheduleRideStartCountdown(setValue);
          void timer.promise.then(finish);
        },
      };
    });
  }, [context]);
  const viewReady = useCallback(() => pendingRef.current?.activate(), []);
  return { value, staging, start, viewReady };
}
