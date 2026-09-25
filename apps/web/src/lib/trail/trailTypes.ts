/**
 * Trail 도메인 타입 — **저장소보다 아래** 층.
 *
 * 왜 여기 있는가 (Phase 5 D1·D3) — 이 타입들이 저장소(`trail/repo/*`)에 정의돼 있어
 * **순환 두 쌍**이 생겼다. 한쪽은 타입을, 반대쪽은 함수를 가져가는 형태였다.
 *
 *   trailAccessPolicy → firestoreTrailInstance (타입)
 *   firestoreTrailInstance·firestoreOpenTrailListings → trailAccessPolicy (함수)
 *
 *   rtdbTrailMotion → firestoreTrailLivePublicationRides (타입)
 *   firestoreTrailLivePublicationRides → rtdbTrailMotion (함수)
 *
 * **파일을 폴더로 옮기는 것만으로는 순환이 끊기지 않는다**(구조 감사 §8 의 「자연 해소」는
 * 사실이 아니었다). 정책이 저장소를 올려다보지 않게 **타입을 도메인 층으로 내려야** 끊긴다.
 *
 * 이 모듈은 아무것도 import 하지 않는다. 저장소는 종전 이름으로 re-export 해
 * 소비자(약 30곳)를 건드리지 않는다.
 */

export type TrailVisibility = "open" | "private";
export type TrailStatus = "open" | "closed" | "archived";

export type TrailInstance = {
  id: string;
  hostUid: string;
  displayNumber: number;
  publicationId: string | null;
  regionLabel: string | null;
  distanceKm: number | null;
  visibility: TrailVisibility;
  status: TrailStatus;
  createdAtMs: number | null;
  lastActivityAtMs: number | null;
  /** `livePublicationRides` 서브컬렉션 문서 수(목록 UI용, best-effort) */
  liveRiderCount?: number;
};

export type TrailLiveRidePhase = "live" | "paused" | "completed";
