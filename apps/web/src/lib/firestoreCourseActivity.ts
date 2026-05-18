import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
import type { LngLat } from "./geo";
import { lastSeenAtToMillis } from "./firestoreTrail";

/** `courseActivity/{courseId}` — 코스 단위 aggregate(클라이언트 write 없음) */
export type CourseActivitySnapshot = {
  courseId: string;
  activeRiderCount: number;
  recentRideCount7d: number;
  recentLikeCount: number;
  liveNow: boolean;
  pulseLevel: number;
  updatedAtMs: number | null;
  /** v2: CF가 진행률·코스 geometry 로 계산(없으면 bounds 중심 DOT) */
  liveAnchorLngLat: LngLat | null;
  liveAnchorProgressRatio: number | null;
};

const COLLECTION = "courseActivity";

function clampPulseLevel(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(3, Math.round(raw)));
}

function parseLiveAnchorLngLat(raw: unknown): LngLat | null {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const lng = raw[0];
  const lat = raw[1];
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }
  return [lng, lat];
}

function parseCourseActivityDoc(courseId: string, data: Record<string, unknown>): CourseActivitySnapshot {
  const activeRiderCount =
    typeof data.activeRiderCount === "number" && Number.isFinite(data.activeRiderCount)
      ? Math.max(0, Math.floor(data.activeRiderCount))
      : 0;
  const recentRideCount7d =
    typeof data.recentRideCount7d === "number" && Number.isFinite(data.recentRideCount7d)
      ? Math.max(0, Math.floor(data.recentRideCount7d))
      : 0;
  const recentLikeCount =
    typeof data.recentLikeCount === "number" && Number.isFinite(data.recentLikeCount)
      ? Math.max(0, Math.floor(data.recentLikeCount))
      : 0;
  const liveNow = data.liveNow === true;
  const pulseLevel = clampPulseLevel(data.pulseLevel);
  const liveAnchorLngLat = parseLiveAnchorLngLat(data.liveAnchorLngLat);
  const liveAnchorProgressRatio =
    typeof data.liveAnchorProgressRatio === "number" && Number.isFinite(data.liveAnchorProgressRatio)
      ? Math.max(0, Math.min(1, data.liveAnchorProgressRatio))
      : null;
  return {
    courseId,
    activeRiderCount,
    recentRideCount7d,
    recentLikeCount,
    /** 서버 `liveNow`만 신뢰 — pulseLevel 잔존 시 heat가 막히지 않게 */
    liveNow,
    pulseLevel: liveNow && pulseLevel === 0 ? 1 : liveNow ? pulseLevel : 0,
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
    liveAnchorLngLat,
    liveAnchorProgressRatio,
  };
}

const memoryCache = new Map<string, CourseActivitySnapshot | null>();
const inflight = new Map<string, Promise<CourseActivitySnapshot | null>>();
/** 주행 종료 직후 서버 `liveNow`가 늦게 내려갈 때 heat 표시 유지 */
const rideCompletedOptimistic = new Map<string, CourseActivitySnapshot>();

function mergeRideCompletedOptimistic(
  courseId: string,
  server: CourseActivitySnapshot | null,
): CourseActivitySnapshot | null {
  const opt = rideCompletedOptimistic.get(courseId);
  if (!opt) return server;
  if (!server) return opt;

  const server7d = server.recentRideCount7d;
  const liveStuck =
    server.liveNow && server.activeRiderCount > 0;
  /** CF 지연: `liveNow`만 남고 rider=0·7d 미반영 — 낙관 heat 유지 */
  const staleLiveWithoutHeat =
    server.liveNow && server.activeRiderCount === 0 && server7d < opt.recentRideCount7d;
  const serverCaughtUp = server7d >= opt.recentRideCount7d && !liveStuck && !staleLiveWithoutHeat;

  if (serverCaughtUp) {
    rideCompletedOptimistic.delete(courseId);
    return server;
  }

  return {
    ...server,
    liveNow: false,
    activeRiderCount: 0,
    pulseLevel: 0,
    liveAnchorLngLat: null,
    liveAnchorProgressRatio: null,
    recentRideCount7d: Math.max(server7d, opt.recentRideCount7d),
  };
}

/** 종료 직후 지도 heat — Firestore·CF 반영 전 클라이언트 표시 */
export function markCourseActivityRideCompletedOptimistic(courseId: string): CourseActivitySnapshot | null {
  const id = courseId.trim();
  if (!id) return null;
  const prev = memoryCache.get(id) ?? rideCompletedOptimistic.get(id) ?? null;
  const next: CourseActivitySnapshot = {
    courseId: id,
    activeRiderCount: 0,
    recentRideCount7d: (prev?.recentRideCount7d ?? 0) + 1,
    recentLikeCount: prev?.recentLikeCount ?? 0,
    liveNow: false,
    pulseLevel: 0,
    updatedAtMs: Date.now(),
    liveAnchorLngLat: null,
    liveAnchorProgressRatio: null,
  };
  rideCompletedOptimistic.set(id, next);
  memoryCache.set(id, next);
  return next;
}

/** 저빈도 `getDoc` — 세션 캐시·in-flight 공유 */
export async function fetchCourseActivity(courseId: string): Promise<CourseActivitySnapshot | null> {
  const id = courseId.trim();
  if (!id) return null;
  if (memoryCache.has(id)) return memoryCache.get(id)!;

  let pending = inflight.get(id);
  if (!pending) {
    pending = (async () => {
      const db = getFirestore(getFirebaseApp());
      const snap = await getDoc(doc(db, COLLECTION, id));
      const parsed = snap.exists()
        ? parseCourseActivityDoc(id, snap.data() as Record<string, unknown>)
        : null;
      const merged = mergeRideCompletedOptimistic(id, parsed);
      memoryCache.set(id, merged);
      inflight.delete(id);
      return merged;
    })().catch((e) => {
      inflight.delete(id);
      throw e;
    });
    inflight.set(id, pending);
  }
  return pending;
}

/** 지도 라이브 펄스 — 실제 주행자가 있을 때만(집계 `liveNow` 단독은 heat로 넘김) */
export function isCourseActivityLive(activity: CourseActivitySnapshot): boolean {
  return activity.liveNow && activity.activeRiderCount > 0;
}

/** 지도 heat(주행 종료 후 7일 흔적) — 라이브가 아니면 `recentRideCount7d`만으로 판정 */
export function isCourseActivityHeat(activity: CourseActivitySnapshot): boolean {
  if (isCourseActivityLive(activity)) return false;
  return activity.recentRideCount7d > 0;
}

/** heat 점·선 시각 강도 1..5 */
export function heatVisualWeight(recentRideCount7d: number): number {
  if (!Number.isFinite(recentRideCount7d) || recentRideCount7d <= 0) return 1;
  return Math.min(5, Math.max(1, Math.round(recentRideCount7d)));
}

/** 코스 목록 행용 짧은 배지 */
export function formatCourseActivityListBadge(activity: CourseActivitySnapshot | null): string | null {
  if (!activity) return null;
  if (activity.liveNow) {
    return activity.activeRiderCount > 0 ? `라이브 ${activity.activeRiderCount}` : "라이브";
  }
  if (activity.recentRideCount7d > 0) return `7일 ${activity.recentRideCount7d}회`;
  if (activity.recentLikeCount > 0) return `♥ ${activity.recentLikeCount}`;
  return null;
}

/** 맵 오버레이 폴링 시 aggregate 재조회(라이브 `liveNow` 반영) */
export function invalidateCourseActivityCache(courseIds?: readonly string[]): void {
  if (!courseIds?.length) {
    memoryCache.clear();
    return;
  }
  for (const id of courseIds) {
    const key = id.trim();
    if (key) memoryCache.delete(key);
  }
}

/** 여러 코스 aggregate — 코스당 `getDoc` 1회(캐시·in-flight 공유) */
export async function fetchCourseActivitiesBatch(
  courseIds: readonly string[],
  options?: { refresh?: boolean },
): Promise<Map<string, CourseActivitySnapshot | null>> {
  const uniq = [...new Set(courseIds.map((id) => id.trim()).filter(Boolean))];
  if (options?.refresh) invalidateCourseActivityCache(uniq);
  const pairs = await Promise.all(
    uniq.map(async (id) => [id, await fetchCourseActivity(id)] as const),
  );
  return new Map(pairs);
}

/** Activity World 지도 핀 탭 팝업 */
export function formatActivityWorldPinPopup(
  activity: CourseActivitySnapshot | null,
  kind: "pulse" | "heat",
): string {
  const title = kind === "pulse" ? "라이브 코스" : "최근 활동";
  const detail = formatCourseActivityHudLine(activity);
  if (detail) return `${title}\n${detail}`;
  if (kind === "pulse") return `${title}\n지금 이 코스에서 주행 중`;
  return `${title}\n최근 7일 내 주행 흔적`;
}

export function formatCourseActivityHudLine(activity: CourseActivitySnapshot | null): string | null {
  if (!activity) return null;
  const parts: string[] = [];
  if (activity.liveNow) {
    parts.push(
      activity.activeRiderCount > 0
        ? `지금 ${activity.activeRiderCount}명 주행`
        : "지금 활동 중",
    );
  } else if (activity.recentRideCount7d > 0) {
    parts.push(`최근 7일 ${activity.recentRideCount7d}회`);
  }
  if (activity.recentLikeCount > 0) parts.push(`좋아요 ${activity.recentLikeCount}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
