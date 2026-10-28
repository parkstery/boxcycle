import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHECKING_SNAPSHOT,
  IDLE_SNAPSHOT,
  createEntryLocationSession,
  readBrowserEntryLocationEnv,
  type EntryLocationSession,
  type EntryLocationSnapshot,
  type EntryLocationTarget,
} from "../lib/geo/entryLocation";
import { MAP_FALLBACK_CENTER, MAP_FALLBACK_ZOOM } from "../lib/map/mapBootCenter";

export type {
  EntryLocationPermission,
  EntryLocationPhase,
  EntryLocationSnapshot,
  EntryLocationTarget,
} from "../lib/geo/entryLocation";

/** 위치를 고르지 않을 때의 지도 목적지. 콜로세움·줌은 mapBootCenter 와 같다. */
export const ENTRY_LOCATION_FALLBACK_TARGET = {
  center: [MAP_FALLBACK_CENTER[0], MAP_FALLBACK_CENTER[1]] as [number, number],
  zoom: MAP_FALLBACK_ZOOM,
};

export type EntryLocationState = EntryLocationSnapshot & {
  chooseRome: () => void;
  chooseCurrent: () => void;
  acceptPosition: (lng: number, lat: number) => void;
};

/**
 * 진입 위치. 이전 주행 목적지가 있으면 권한 조회 없이 사용한다.
 * 없으면 enabled 가 true 일 때만 권한 조회를 시작한다.
 * false·cleanup 에서는 지리 API 를 부르지 않고, 이미 보낸 요청의 늦은 콜백은 버린다.
 */
export function useEntryLocation(enabled: boolean, lastRideTarget: EntryLocationTarget | null = null): EntryLocationState {
  const [trackedEnabled, setTrackedEnabled] = useState(enabled);
  const [snap, setSnap] = useState<EntryLocationSnapshot>(() =>
    enabled ? CHECKING_SNAPSHOT : IDLE_SNAPSHOT,
  );
  const tokenRef = useRef(0);
  const sessionRef = useRef<EntryLocationSession | null>(null);
  const lastRideTargetRef = useRef(lastRideTarget);
  useEffect(() => { lastRideTargetRef.current = lastRideTarget; }, [lastRideTarget]);

  if (trackedEnabled !== enabled) {
    setTrackedEnabled(enabled);
    setSnap(enabled ? CHECKING_SNAPSHOT : IDLE_SNAPSHOT);
  }

  const acceptSnap = useCallback((token: number, next: EntryLocationSnapshot) => {
    if (tokenRef.current !== token) return;
    setSnap(next);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    // 진입 때 한 번만 결정한다. 이후 주행 기록 변경은 탐색 중인 지도를 덮지 않는다.
    const priorTarget = lastRideTargetRef.current;
    if (priorTarget) {
      acceptSnap(token, { phase: "ready", permission: "unknown", target: priorTarget, notice: null });
      return () => { tokenRef.current += 1; };
    }
    const session = createEntryLocationSession(
      readBrowserEntryLocationEnv(),
      ENTRY_LOCATION_FALLBACK_TARGET,
    );
    sessionRef.current = session;
    const unsubscribe = session.subscribe((next) => {
      acceptSnap(token, next);
    });
    session.setEnabled(true);
    return () => {
      tokenRef.current += 1;
      unsubscribe();
      session.setEnabled(false);
      if (sessionRef.current === session) sessionRef.current = null;
    };
  }, [acceptSnap, enabled]);

  const chooseRome = useCallback(() => {
    sessionRef.current?.chooseRome();
  }, []);

  const chooseCurrent = useCallback(() => {
    sessionRef.current?.chooseCurrent();
  }, []);

  const acceptPosition = useCallback((lng: number, lat: number) => {
    sessionRef.current?.acceptPosition(lng, lat);
  }, []);

  const shown = !enabled ? IDLE_SNAPSHOT : trackedEnabled === enabled ? snap : CHECKING_SNAPSHOT;

  return {
    phase: shown.phase,
    permission: shown.permission,
    target: shown.target,
    notice: shown.notice,
    chooseRome,
    chooseCurrent,
    acceptPosition,
  };
}
