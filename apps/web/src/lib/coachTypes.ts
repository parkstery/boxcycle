export type CoachingData = {
  tip: string;
  resistance: string;
  intensity: "LOW" | "MODERATE" | "HIGH" | "MAX";
  action: "SIT" | "STAND" | "TUCK" | "PEDAL";
};

export type CachedCoachingByDistance = {
  coaching: CoachingData & { tipId?: string; resId?: string };
  validUntilDistanceM: number;
};
