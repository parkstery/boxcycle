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

export function saveRideSessions(items: StoredRideSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(items));
}
