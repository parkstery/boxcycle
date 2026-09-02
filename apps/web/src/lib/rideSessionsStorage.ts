import type { User } from "firebase/auth";
import type { LngLat } from "./geo";
import { canPersistAppData } from "./clientPersistencePolicy";

const SESSIONS_KEY = "boxcycle_web_ride_sessions_v1";

export type StoredRideSession = {
  id: string;
  endedAt: string;
  elapsedSec: number;
  distanceMeters: number;
  avgSpeedKmh: number;
  caloriesEstimate: number;
  routeDistanceMeters: number;
  routeDurationSec: number;
  /** 격상시킨 사용자 경로 ID(저장된 경로를 불러와 주행한 경우만). ad-hoc 주행은 null. */
  userRouteId?: string | null;
  /** 격상 시점의 경로 이름 스냅샷. 이후 사용자가 이름을 바꿔도 기록의 이름은 보존됨. */
  routeName?: string | null;
  /** 완주율(0~1). routeDistanceMeters > 0 일 때만 의미 있음. */
  completionRatio?: number;
  /** 출발지 역지오코딩(맵 UI·주행 종료 시 스냅샷). */
  startPlaceLabel?: string;
  /** 도착지 역지오코딩. */
  endPlaceLabel?: string;
  /** 이번 세션 실제 시작 좌표(geometry 위). legacy 문서는 null. */
  sessionStartLngLat?: LngLat | null;
  /** 이번 세션 실제 종료 좌표(geometry 위). */
  sessionEndLngLat?: LngLat | null;
  sessionStartRouteMeters?: number | null;
  sessionEndRouteMeters?: number | null;
  sessionStartProgressRatio?: number | null;
  sessionEndProgressRatio?: number | null;
};

export function loadRideSessions(): StoredRideSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredRideSession[]) : [];
  } catch {
    return [];
  }
}

export function saveRideSessions(items: StoredRideSession[], user: User | null): void {
  if (!canPersistAppData(user) || typeof localStorage === "undefined") return;
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
}
