import type { User } from "firebase/auth";
import { canPersistAppData } from "./clientPersistencePolicy";

const SESSIONS_KEY = "boxcycle_web_ride_sessions_v1";

export type StoredRideSession = {
  id: string;
  /** Firestore rides/{} 문서 ID (서버 부여). F1: local↔server identity link */
  serverRideId?: string | null;
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
  /** 출발지 역지오코딩(맵 UI·주행 종료 시 스냅샷). **계획된** Route 의 출발지다. */
  startPlaceLabel?: string;
  /** 도착지 역지오코딩. **계획된** Route 의 도착지다. */
  endPlaceLabel?: string;
  /**
   * 이번 세션이 **실제로** 시작·종료한 경로상 지점(RIDE-CONTINUE-1 §4.1).
   * 31% 에서 시작해 43% 에서 끝난 Ride 의 연결점을 복원하는 유일한 근거이며,
   * 「다음 주행」의 출발점이 된다. 옛 Ride 는 필드가 없다(legacy fallback 유지).
   */
  sessionStartLngLat?: [number, number] | null;
  sessionEndLngLat?: [number, number] | null;
  sessionStartRouteMeters?: number;
  sessionEndRouteMeters?: number;
  sessionStartProgressRatio?: number;
  sessionEndProgressRatio?: number;
  /** 실제 세션 시작·종료 지점의 역지오코딩. UI 는 이 값을 우선하고 없으면 계획 지명으로 폴백. */
  sessionStartPlaceLabel?: string;
  sessionEndPlaceLabel?: string;
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

/**
 * 서버 목록과 로컬 목록을 **최신 우선**으로 합친다.
 *
 * 왜 필요한가: 주행 종료는 로컬 기록을 즉시 반영하지만 Firestore 쓰기는 fire-and-forget 이다.
 * 그 사이에 `useRecentRideSessions` 의 effect 가 다시 돌면(deps 에 `profile`·`trailId` 가 있어
 * 이어 달리기로 이동수단이 바뀌면 실제로 재실행된다) 아직 최신 주행이 없는 서버 응답이
 * 로컬을 통째로 덮어써, 「다음 주행」 카드가 **한 세대 전**을 가리킨다(2026-09-03 결함 ⑦).
 *
 * F1 (fixed): serverRideId 기준 중복 제거 — 한 주행이 한 행.
 * - 서버 세션: id = serverRideId = Firestore doc ID
 * - 로컬 세션: id = UUID, serverRideId = Firestore doc ID (저장 후 채워짐)
 * - serverRideId로 매칭하여 한 주행이 두 행으로 중복되지 않게 함
 */
export function mergeRecentRideSessions(
  serverRows: readonly StoredRideSession[],
  localRows: readonly StoredRideSession[],
  limit = 50,
): StoredRideSession[] {
  const byKey = new Map<string, StoredRideSession>();
  
  // 1. 서버 세션 먼저 매핑 (서버판이 정본)
  for (const row of serverRows) {
    if (!row?.id) continue;
    // 서버 세션: serverRideId가 있으면 그것으로, 없으면 id로 (legacy)
    const key = row.serverRideId || row.id;
    byKey.set(key, row);
    // id로도 매핑 (legacy same-id merge 지원)
    if (row.id !== key) {
      byKey.set(row.id, row);
    }
  }
  
  // 2. 로컬 세션 처리
  for (const row of localRows) {
    if (!row?.id) continue;
    
    // 2a. serverRideId가 있으면 그것으로 매칭 시도
    if (row.serverRideId) {
      if (byKey.has(row.serverRideId)) {
        // 서버에 이미 있음 → 서버판 유지 (지명 역지오코딩 등 후처리 반영)
        const existing = byKey.get(row.serverRideId)!;
        // 서버판이 아직 serverRideId를 명시하지 않았다면 추가
        if (!existing.serverRideId) {
          byKey.set(row.serverRideId, { ...existing, serverRideId: row.serverRideId });
        }
        continue;
      }
      // 서버에 아직 없음 → 로컬 추가 (in-flight)
      byKey.set(row.serverRideId, row);
      continue;
    }
    
    // 2b. serverRideId 없음 (legacy) → id로 매칭 시도
    if (byKey.has(row.id)) {
      // 서버에 같은 id가 있음 → 서버판 유지
      continue;
    }
    
    // 2c. 완전히 새로운 로컬 전용
    byKey.set(row.id, row);
  }
  
  // 3. 중복 제거 및 정렬
  const uniqueById = new Map<string, StoredRideSession>();
  for (const row of byKey.values()) {
    if (!uniqueById.has(row.id)) {
      uniqueById.set(row.id, row);
    }
  }
  
  const all = Array.from(uniqueById.values());
  const endedAtMs = (r: StoredRideSession) => {
    const t = Date.parse(r.endedAt ?? "");
    return Number.isFinite(t) ? t : 0;
  };
  return all.sort((a, b) => endedAtMs(b) - endedAtMs(a)).slice(0, limit);
}
