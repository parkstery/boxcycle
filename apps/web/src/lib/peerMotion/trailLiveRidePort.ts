/**
 * Trail 라이브 주행 기록 — **peerMotion 이 선언하는 포트** (Phase 5 D6).
 *
 * 왜 포트인가 — 경로 진행을 Trail 의 라이브 주행 문서에 쓰는 것은 **제품 요구**다.
 * 의존을 끊으면 동행이 서로를 못 본다. 그래서 끊지 않고 **방향을 뒤집는다** —
 * 전송 계층이 계약을 선언하고, Trail 이 구현하고, 주행이 조립한다.
 *
 * ⚠️ 구현은 `RouteFlightJob` 에 **필수 필드로 실어 보낸다.** 전역 등록(setter) 방식은
 * 배선을 한 번 빠뜨리면 **아무 에러 없이 발행만 멈춘다** — 동행이 서로 안 보이는데
 * 앱은 정상으로 보인다(구조 감사 R10 과 같은 침묵). 필수 필드면 `tsc` 가 강제한다.
 */
import type { User } from "firebase/auth";
import type { TrailLiveRidePhase } from "../trail/trailTypes";

export type TrailLiveRidePublishInput = {
  publicationId: string;
  progressRatio: number;
  distMeters: number;
  speedMps: number;
  /** 원본 저장소 계약과 같은 모양이어야 한다 — `null` 로 바꾸면 의미가 달라진다. */
  ridePhase: TrailLiveRidePhase | undefined;
};

export type TrailLiveRideSink = {
  /** 이 주행의 진행을 Trail 라이브 주행 문서에 병합한다. */
  publish(user: User, trailId: string, input: TrailLiveRidePublishInput): Promise<void>;
  /**
   * Trail 인스턴스의 마지막 활동 시각을 갱신한다(기본 Trail 은 호출부가 거른다).
   * **사유(reason) 를 받지 않는다** — 그것은 Trail 의 어휘이고, 전송 계층이 알 이유가 없다.
   */
  touchActivity(trailId: string): Promise<void>;
};
