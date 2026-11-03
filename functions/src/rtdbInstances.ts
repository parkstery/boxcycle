/**
 * RTDB 인스턴스의 단일 출처 — 서버에서 `getDatabase` 를 부르는 곳은 **여기 하나**다
 * (pre-push `scripts/check-firebase-accessors.mjs` 가 지킨다).
 *
 * 왜 — 계획 document/ops/20261103-global-geo-data/00-plan.md §5.1 P2.
 * 해외 사용자가 늘면 동행 위치(`trails/{id}/motion/{uid}`)를 지역별 RTDB 인스턴스로 나눌 수 있다.
 * 그때 계정 삭제·게스트 정리가 기본 인스턴스 하나만 보면 **다른 지역에 개인 위치가 남는다** —
 * 에러 없이. 그래서 정리 코드는 처음부터 「기본 + 추가 동행 인스턴스 목록」을 돈다.
 *
 * 역할 구분
 *   - 기본 인스턴스: 제어 노드(`guestLifecycle/{uid}/blocked`) + 지금의 모든 동행.
 *   - 추가 동행 인스턴스: `EXTRA_MOTION_RTDB_URLS`. 지금은 비어 있다. 지역 서버를 켜면 주소를 더한다.
 */
import { getDatabase, getDatabaseWithUrl, type Database } from "firebase-admin/database";

/** 기본 인스턴스 밖의 동행 인스턴스 주소(예: `https://<db>.europe-west1.firebasedatabase.app`). */
export const EXTRA_MOTION_RTDB_URLS: readonly string[] = [];

/** 기본 인스턴스. 초기화 실패는 null — 호출 측 port 가 null 을 예외로 다룬다(기존 계약). */
export function getDefaultRtdbOrNull(): Database | null {
  try {
    return getDatabase();
  } catch {
    return null;
  }
}

/**
 * 추가 동행 인스턴스. **하나라도 열지 못하면 예외** — 조용히 건너뛰면 그 지역의 개인 위치가
 * 정리되지 않은 채 「완료」가 된다.
 */
export function getExtraMotionRtdbs(urls: readonly string[] = EXTRA_MOTION_RTDB_URLS): Database[] {
  return urls.map((url) => getDatabaseWithUrl(url));
}
