/**
 * 경로 생성 상한 — API·DB 부담과 비정상 입력(테스트·실수·장난) 방어.
 *
 * 서버([functions/src/index.ts])에도 동일 값을 복제해 최종 강제한다(패키지 분리로 import 공유 불가).
 * 값을 바꾸면 서버 상수도 함께 갱신할 것.
 */

/** 실제 경로(Mapbox Directions) 거리 상한. 서버가 응답 거리로 최종 강제. */
export const MAX_ROUTE_DISTANCE_METERS = 120_000;

/** 사용자 안내용 상한(km). 메시지 문구에 사용. */
export const MAX_ROUTE_DISTANCE_KM = Math.round(MAX_ROUTE_DISTANCE_METERS / 1000);

/**
 * 사전 차단용 직선거리 합 상한.
 * 실제 도로 경로는 직선거리보다 항상 길므로, 직선 합이 상한을 넘으면 실제 거리는 반드시 초과한다.
 * → Mapbox 호출·토큰 소진 전에 확정 차단할 수 있는 안전한 하한 기준.
 */
export const MAX_ROUTE_STRAIGHT_LINE_METERS = MAX_ROUTE_DISTANCE_METERS;
