import type { RouteProfile } from "../../services/mapboxDirections";
import type { PublishedPublicCourseSummary } from "./repo/firestoreCourses";

/** Publication 목록·HUD — 프로필 한글 라벨 */
export function publicationProfileLabelKo(profile: RouteProfile): string {
  if (profile === "walking") return "도보";
  if (profile === "driving") return "자동차";
  return "자전거";
}

/**
 * `publicTitle` 에서 목적지(· 뒤 구간)를 추출한다.
 * Publication 스냅샷에 없는 지명은 만들지 않는다.
 */
export function publicationDestinationFromTitle(title: string): string | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const sep = trimmed.indexOf("·");
  if (sep < 0) return null;
  const dest = trimmed.slice(sep + 1).trim();
  return dest.length > 0 ? dest : null;
}

/** Publication 제목 — 카탈로그 `title`(= publicTitle) 그대로 */
export function publicationDisplayTitle(summary: Pick<PublishedPublicCourseSummary, "title">): string {
  return summary.title.trim();
}

/**
 * 추천·입문 Publication 한 줄 메타 — geometry·Publication 필드만.
 * 「N분 도착」·도시 % 같은 가짜 약속은 넣지 않는다.
 */
export function formatPublicationListMeta(
  summary: Pick<PublishedPublicCourseSummary, "title" | "profile" | "distanceMeters">,
): string {
  const profile = publicationProfileLabelKo(summary.profile);
  const km = (summary.distanceMeters / 1000).toFixed(2);
  const dest = publicationDestinationFromTitle(summary.title);
  if (dest) return `${profile} · ${km} km · ${dest}`;
  return `${profile} · ${km} km`;
}
