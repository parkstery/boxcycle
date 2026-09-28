/**
 * 사용자 이름·등급 조회 — **route 가 선언하는 포트** (D1 읽기 모델 소유권).
 *
 * 왜 포트인가 — 퍼블릭 카탈로그에 「이 도로의 개척자」를 띄우고, 퍼블릭 신청 자격을
 * 등급으로 가르는 것은 **제품 요구**다. 의존을 끊으면 기능이 죽는다. 그래서 끊지 않고
 * **방향을 뒤집는다** — 코스 저장소는 「이름을 주는 것」·「등급을 주는 것」의 모양만
 * 선언하고, 실제 사용자 저장소는 조립 지점(hooks)이 꽂는다.
 *
 * ⚠️ 구현은 **함수의 필수 인자로 받는다.** 전역 등록(setter) 방식은 배선을 한 번
 * 빠뜨리면 아무 에러 없이 이름이 사라지거나 자격 판정이 빈다 — 화면은 정상으로 보인다.
 * 필수 인자면 `tsc` 가 강제한다(`peerMotion/trailLiveRidePort.ts` 와 같은 규율).
 *
 * 이 파일은 **타입만 있는 leaf** 여야 한다. 값을 내보내거나 identity 를 런타임으로
 * 끌고 오는 순간 포트가 아니라 구멍이 된다.
 */
import type { UserTier } from "../account/userTier";

/**
 * uid 묶음 → 표시 이름 묶음. 없는 사용자도 **키는 채워서** 돌려준다(원본 계약과 동일).
 */
export type RouteUserLabelLookup = (uids: readonly string[]) => Promise<Map<string, string>>;

/** uid → 등급. 문서가 없거나 값이 이상하면 `null`(원본 계약과 동일). */
export type RouteUserTierLookup = (uid: string) => Promise<UserTier | null>;
