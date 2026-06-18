import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "./firestoreTrail";

const TRAIL_QUERY_KEYS = ["trail", "room"] as const;

/** `?trail=` 우선, 하위 호환 `?room=` — 값은 Trail ID (Firestore `trails/{id}`) */
export function readTrailIdFromLocation(): string {
  const params = new URLSearchParams(window.location.search);
  for (const key of TRAIL_QUERY_KEYS) {
    const raw = params.get(key);
    if (raw != null && String(raw).trim()) {
      return sanitizeTrailId(raw);
    }
  }
  return sanitizeTrailId(null);
}

export function replaceTrailInUrl(trailId: string): void {
  const r = sanitizeTrailId(trailId);
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  url.searchParams.delete("trail");
  if (r === DEFAULT_TRAIL_ID) {
    window.history.replaceState(null, "", url.pathname + url.hash);
    return;
  }
  url.searchParams.set("trail", r);
  window.history.replaceState(null, "", url.toString());
}
