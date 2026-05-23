import type { User } from "firebase/auth";
import type { TrailInstance, TrailVisibility } from "./firestoreTrailInstance";

export type TrailJoinGate =
  | { ok: true }
  | { ok: false; message: string };

/** 공개 Trail(`visibility: open`) — Firestore에 코스 ID가 있어야 함 */
export function trailHasConfiguredRoute(trail: Pick<TrailInstance, "courseId">): boolean {
  return typeof trail.courseId === "string" && trail.courseId.trim().length > 0;
}

export function isPublicTrail(trail: Pick<TrailInstance, "visibility">): boolean {
  return trail.visibility === "open";
}

/** 공개 전환·공개 Trail 생성 시 경로 필수 */
export function assertPublicTrailHasRoute(
  courseId: string | null | undefined,
): void {
  if (!courseId?.trim()) {
    throw new Error("공개 Trail은 경로(코스)가 설정되어 있어야 합니다.");
  }
}

/** Trail 합류·presence — 비공개는 개설자만(초대·승인은 후속) */
export function canUserJoinTrail(
  trail: TrailInstance,
  user: User | null | undefined,
): TrailJoinGate {
  if (!user) {
    return { ok: false, message: "로그인 후 Trail에 참여할 수 있습니다." };
  }
  if (trail.status !== "open") {
    return { ok: false, message: "종료된 Trail에는 참여할 수 없습니다." };
  }
  if (trail.visibility === "private") {
    if (trail.hostUid === user.uid) return { ok: true };
    return {
      ok: false,
      message:
        "비공개 Trail은 개설자만 참여할 수 있습니다. 초대·승인 기능은 준비 중입니다.",
    };
  }
  if (!trailHasConfiguredRoute(trail)) {
    return {
      ok: false,
      message: "공개 Trail에 경로가 설정되지 않았습니다. 합류할 수 없습니다.",
    };
  }
  return { ok: true };
}

/** Trailhead ▶ 신규 개설 — 공개는 코스 필수, 경로 없으면 비공개(개설자 전용) */
export function resolveNewTrailVisibility(courseId: string | null | undefined): TrailVisibility {
  return courseId?.trim() ? "open" : "private";
}
