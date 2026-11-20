import type { User } from "firebase/auth";
import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { IntervalWorkoutFeedback } from "../lib/ride/intervalWorkout";
import { saveIntervalWorkoutFeedback } from "../lib/ride/repo/firestoreRides";
import type { RideEndResult } from "../lib/ride/rideEndResult";
import { loadRideSessions, saveRideSessions, type StoredRideSession } from "../lib/ride/rideSessionsStorage";

export function useIntervalWorkoutFeedback({ user, configured, result, setRecentSessions, setLastRideResult }: {
  user: User | null;
  configured: boolean;
  result: RideEndResult | null;
  setRecentSessions: (sessions: StoredRideSession[]) => void;
  setLastRideResult: Dispatch<SetStateAction<RideEndResult | null>>;
}) {
  const ownerRef = useRef(user?.uid);
  useEffect(() => { ownerRef.current = user?.uid; }, [user?.uid]);

  return async (workoutId: string, effort: IntervalWorkoutFeedback) => {
    if (!result || !user || !result.intervalWorkouts?.some((workout) => workout.id === workoutId)) return;
    if (configured) {
      if (!result.serverRideId) throw new Error("주행 기록 저장 후 다시 선택해주세요.");
      await saveIntervalWorkoutFeedback(result.serverRideId, workoutId, effort);
    }
    if (ownerRef.current !== user.uid) return;
    const applyFeedback = (workouts: RideEndResult["intervalWorkouts"]) =>
      workouts?.map((workout) => workout.id === workoutId ? { ...workout, feedback: effort } : workout);
    const updated = loadRideSessions().map((session) => session.ownerUid === user.uid && session.id === result.recordId
      ? { ...session, intervalWorkouts: applyFeedback(session.intervalWorkouts) }
      : session);
    saveRideSessions(updated, user);
    setRecentSessions(updated);
    setLastRideResult((previous) => previous?.recordId === result.recordId
      ? { ...previous, intervalWorkouts: applyFeedback(previous.intervalWorkouts) }
      : previous);
  };
}
