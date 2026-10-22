import { useEffect, useRef } from "react";

/**
 * 주행 중 화면 꺼짐 방지(Screen Wake Lock, 2026-10-23 Chief).
 *
 * 폰을 거치대에 두고 달리면 몇 분 뒤 화면이 꺼진다. 브라우저는 탭이 가려지면 잠금을
 * 스스로 풀기 때문에, 다시 보일 때 다시 건다. API 가 없거나(구형 브라우저) 거절되면
 * (배터리 절약 모드 등) 조용히 아무것도 하지 않는다 — 주행은 그대로 된다.
 */
type WakeLockSentinelLike = {
  release(): Promise<void>;
  addEventListener?(type: "release", listener: () => void): void;
};

type WakeLockNavigator = {
  wakeLock?: { request(type: "screen"): Promise<WakeLockSentinelLike> };
};

type VisibilityDocument = {
  visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

export function createScreenWakeLock(nav: WakeLockNavigator, doc: VisibilityDocument) {
  let wanted = false;
  let sentinel: WakeLockSentinelLike | null = null;
  let pending = false;

  const releaseHeld = () => {
    const held = sentinel;
    sentinel = null;
    if (held) void held.release().catch(() => {});
  };

  const acquire = async () => {
    if (!wanted || sentinel || pending || !nav.wakeLock || doc.visibilityState !== "visible") return;
    pending = true;
    try {
      const next = await nav.wakeLock.request("screen");
      if (!wanted) {
        // 요청이 도는 사이 주행이 끝났다
        void next.release().catch(() => {});
        return;
      }
      sentinel = next;
      next.addEventListener?.("release", () => {
        if (sentinel === next) sentinel = null;
      });
    } catch {
      /* 거절(배터리 절약·권한) — 다음 visibilitychange 때 다시 시도한다 */
    } finally {
      pending = false;
    }
  };

  const onVisibilityChange = () => {
    if (doc.visibilityState === "visible") void acquire();
  };
  doc.addEventListener("visibilitychange", onVisibilityChange);

  return {
    setActive(active: boolean) {
      wanted = active;
      if (active) void acquire();
      else releaseHeld();
    },
    dispose() {
      wanted = false;
      doc.removeEventListener("visibilitychange", onVisibilityChange);
      releaseHeld();
    },
    isHeld: () => sentinel !== null,
  };
}

/** `active` 인 동안 화면이 꺼지지 않게 한다. */
export function useScreenWakeLock(active: boolean): void {
  const controllerRef = useRef<ReturnType<typeof createScreenWakeLock> | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof document === "undefined") return;
    const controller = createScreenWakeLock(navigator as WakeLockNavigator, document);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setActive(active);
  }, [active]);
}
