import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  backfillRideSessionsToFirestore,
  loadRecentRideSessionsFromFirestore,
} from "../lib/firestoreRides";
import { loadRideSessions, saveRideSessions, type StoredRideSession } from "../lib/rideSessionsStorage";
import type { RouteProfile } from "../services/mapboxDirections";

export type UseRecentRideSessionsOptions = {
  configured: boolean;
  user: User | null;
  roomId: string;
  profile: RouteProfile;
};

/**
 * 최근 주행 세션 목록(로컬 + 로그인 시 Firestore 동기·백필).
 */
export function useRecentRideSessions(options: UseRecentRideSessionsOptions) {
  const { configured, user, roomId, profile } = options;

  const [recentSessions, setRecentSessions] = useState<StoredRideSession[]>(() => loadRideSessions());

  const reloadRecentSessionsFromLocalStorage = useCallback(() => {
    setRecentSessions(loadRideSessions());
  }, []);

  useEffect(() => {
    if (!configured || !user) return;
    let cancelled = false;
    void loadRecentRideSessionsFromFirestore(user.uid, 50)
      .then(async (rows) => {
        if (cancelled) return;
        if (rows.length > 0) {
          saveRideSessions(rows);
          setRecentSessions(rows);
          return;
        }
        const localRows = loadRideSessions();
        if (localRows.length > 0) {
          try {
            await backfillRideSessionsToFirestore({
              userId: user.uid,
              roomId,
              profile,
              sessions: localRows,
            });
            const synced = await loadRecentRideSessionsFromFirestore(user.uid, 50);
            if (!cancelled && synced.length > 0) {
              saveRideSessions(synced);
              setRecentSessions(synced);
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
  }, [configured, user, roomId, profile]);

  return {
    recentSessions,
    setRecentSessions,
    reloadRecentSessionsFromLocalStorage,
  };
}
