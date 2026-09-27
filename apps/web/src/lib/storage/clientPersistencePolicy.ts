import type { User } from "firebase/auth";

export const PERSISTENCE_REQUIRES_AUTH_MSG =
  "저장·주행 기록은 로그인(임시 라이더) 후에 사용할 수 있습니다.";

/** uid 없이 localStorage·Firestore 영속 쓰기 금지 ([tier 정책 §4.4](document/260519-사용자-tier-및-진입-정책.md)) */
export function canPersistAppData(user: User | null): boolean {
  return user != null;
}

export function assertCanPersistAppData(user: User | null): void {
  if (!canPersistAppData(user)) {
    throw new Error(PERSISTENCE_REQUIRES_AUTH_MSG);
  }
}
