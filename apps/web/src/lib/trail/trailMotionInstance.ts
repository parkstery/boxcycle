/**
 * Trail 동행 위치를 주고받을 RTDB 인스턴스 **이름표** — 주소가 아니다.
 *
 * 계획: document/ops/20261103-global-geo-data/00-plan.md §5.1 P1
 *
 * 왜 이름표인가 — Trail 문서는 클라이언트가 쓴다. 주소를 그대로 받으면 악의적 사용자가 자기 서버
 * 주소를 적어 같은 Trail 라이더들의 위치를 그쪽으로 보내게 만들 수 있다. 그래서 정해진 이름만
 * 허용하고(`firestore.rules` 의 `trailMotionInstanceValid`), 주소는 앱 설정이 이름표로 고른다.
 *
 * 지금은 인스턴스가 하나(`default`)뿐이고 접속 코드는 이 값을 아직 읽지 않는다. 지역 서버를 켤 때
 * 이 목록·Rules·접속 코드(`rtdbTrailMotion.ts`)를 함께 바꾼다. 계약 시험:
 * `scripts/trail/trail-motion-instance-rules.test.ts`.
 */
export const TRAIL_MOTION_INSTANCES = ["default"] as const;

export type TrailMotionInstance = (typeof TRAIL_MOTION_INSTANCES)[number];

/** 새 Trail 에 적는 값. 필드가 없는 옛 Trail 도 이 값으로 본다. */
export const TRAIL_MOTION_INSTANCE_DEFAULT: TrailMotionInstance = "default";
