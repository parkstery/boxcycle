import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  backfillRideSessionsToFirestore,
  loadRecentRideSessionsFromFirestore,
} from "../lib/firestoreRides";
import {
  loadRideSessions,
  mergeRecentRideSessions,
  saveRideSessions,
  type StoredRideSession,
} from "../lib/rideSessionsStorage";
import type { RouteProfile } from "../services/mapboxDirections";

export type UseRecentRideSessionsOptions = {
  configured: boolean;
  user: User | null;
  trailId: string;
  profile: RouteProfile;
};

/**
 * 최근 주행 세션 목록(로컬 + 로그인 시 Firestore 동기·백필).
 */
export function useRecentRideSessions(options: UseRecentRideSessionsOptions) {
  const { configured, user, trailId, profile } = options;

  const [recentSessions, setRecentSessions] = useState<StoredRideSession[]>(() => loadRideSessions());

  const reloadRecentSessionsFromLocalStorage = useCallback(() => {
    setRecentSessions(loadRideSessions());
  }, []);

  useEffect(() => {
    if (!user) {
      setRecentSessions([]);
      return;
    }
    if (!configured) return;
    let cancelled = false;
    void loadRecentRideSessionsFromFirestore(user.uid, 50)
      .then(async (rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          // 서버 응답이 로컬보다 한 세대 뒤일 수 있다(주행 종료 직후 Firestore 쓰기는
          // fire-and-forget). 덮어쓰지 않고 최신 우선으로 합친다 — 결함 ⑦.
          const merged = mergeRecentRideSessions(rows, loadRideSessions());
          saveRideSessions(merged, user);
          setRecentSessions(merged);
          return;
        }
        const localRows = loadRideSessions();
        if (localRows.length > 0) {
          try {
            await backfillRideSessionsToFirestore({
              userId: user.uid,
              trailId,
              profile,
              sessions: localRows,
            });
            const synced = await loadRecentRideSessionsFromFirestore(user.uid, 50);
            if (!cancelled && synced.length > 0) {
              const merged = mergeRecentRideSessions(synced, loadRideSessions());
              saveRideSessions(merged, user);
              setRecentSessions(merged);
              return;
            }
          } catch {
            // 백필 실패 시 로컬 데이터를 유지한다.
          }
        }
        if (!cancelled) setRecentSessions(localRows);
      })
      .catch(() => {
        if (!cancelled) {
          setRecentSessions(loadRideSessions());
        }
      });
    return () => {
      cancelled = true;
    };
  }, [configured, user, trailId, profile]);

  return {
    recentSessions,
    setRecentSessions,
    reloadRecentSessionsFromLocalStorage,
  };
}
