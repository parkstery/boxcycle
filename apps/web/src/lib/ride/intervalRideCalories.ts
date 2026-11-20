import {
  buildCaloriesMeta,
  estimateGrossKcal,
  INTERVAL_CALORIES_METHOD_VERSION,
  type CalorieSessionSnapshot,
  type CaloriesEstimateMeta,
} from "./caloriesEstimate";
import { INTERVAL_INTENSITIES, type IntervalWorkoutRecord } from "./intervalWorkout";

/** 기존 일반 주행 추정에 인터벌 구간만 치환한다. 같은 활동초를 두 번 더하지 않는다. */
export function estimateRideCaloriesWithIntervals(input: {
  snapshot: CalorieSessionSnapshot | null;
  activeSec: number | null;
  signalGap: boolean;
  workouts: readonly IntervalWorkoutRecord[];
}): { caloriesEstimate: number | null; caloriesMeta: CaloriesEstimateMeta | null } {
  const { snapshot, activeSec, signalGap, workouts } = input;
  const baseline = estimateGrossKcal({ weightKg: snapshot?.weightKg, met: snapshot?.met, activeSec });
  if (workouts.length === 0) {
    return {
      caloriesEstimate: baseline,
      caloriesMeta: baseline != null && snapshot?.met != null && activeSec != null
        ? buildCaloriesMeta({ met: snapshot.met, activeSec, signalGap }) : null,
    };
  }
  if (activeSec == null || snapshot?.weightKg == null) return { caloriesEstimate: null, caloriesMeta: null };
  let intervalActive = 0;
  let intervalMetSeconds = 0;
  for (const workout of workouts) {
    if (workout.activeSec == null) continue;
    const policy = INTERVAL_INTENSITIES.find((option) => option.id === workout.intensity)!;
    for (const [phase, seconds] of Object.entries(workout.activePhaseSeconds)) {
      intervalActive += seconds;
      intervalMetSeconds += seconds * (phase === "work" ? policy.workMet : policy.recoveryMet);
    }
  }
  // 실제 센서 누적량보다 큰 입력으로 열량을 부풀리지 않는다.
  if (intervalActive > activeSec + 0.01) return { caloriesEstimate: null, caloriesMeta: null };
  const otherActive = Math.max(0, activeSec - intervalActive);
  if (otherActive > 0.01 && snapshot.met == null) return { caloriesEstimate: null, caloriesMeta: null };
  const metSeconds = intervalMetSeconds + otherActive * (snapshot.met ?? 0);
  const met = activeSec > 0 ? metSeconds / activeSec : (snapshot.met ?? 3.5);
  return {
    caloriesEstimate: Math.round(snapshot.weightKg * metSeconds / 3600),
    caloriesMeta: {
      version: INTERVAL_CALORIES_METHOD_VERSION,
      met,
      activeSec,
      inputMethod: "cadence",
      estimated: true,
      signalGap: signalGap || workouts.some((workout) => workout.signalGap),
    },
  };
}
