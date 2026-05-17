import { doc, getDoc, getFirestore } from "firebase/firestore";
import { getFirebaseApp } from "./firebase";
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
};

const COLLECTION = "courseActivity";

function clampPulseLevel(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(3, Math.round(raw)));
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
  return {
    courseId,
    activeRiderCount,
    recentRideCount7d,
    recentLikeCount,
    liveNow: liveNow || pulseLevel > 0,
    pulseLevel: liveNow && pulseLevel === 0 ? 1 : pulseLevel,
    updatedAtMs: lastSeenAtToMillis(data.updatedAt),
  };
}

const memoryCache = new Map<string, CourseActivitySnapshot | null>();
const inflight = new Map<string, Promise<CourseActivitySnapshot | null>>();

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
      memoryCache.set(id, parsed);
      inflight.delete(id);
      return parsed;
    })().catch((e) => {
      inflight.delete(id);
      throw e;
    });
    inflight.set(id, pending);
  }
  return pending;
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

/** 여러 코스 aggregate — 코스당 `getDoc` 1회(캐시·in-flight 공유) */
export async function fetchCourseActivitiesBatch(
  courseIds: readonly string[],
): Promise<Map<string, CourseActivitySnapshot | null>> {
  const uniq = [...new Set(courseIds.map((id) => id.trim()).filter(Boolean))];
  const pairs = await Promise.all(
    uniq.map(async (id) => [id, await fetchCourseActivity(id)] as const),
  );
  return new Map(pairs);
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
