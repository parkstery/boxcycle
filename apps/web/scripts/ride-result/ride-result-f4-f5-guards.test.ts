/**
 * F4/F5 · 실제 production guard 함수 테스트
 * 
 * 팀장 요구: "Extract pure helpers ... tests must import those production helpers"
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isRideOwnedByUser, isRideIdMatch } from "../../src/lib/rideConquestResult.ts";
import { isDiscardableRideRecord, isRouteCompletion } from "../../src/lib/rideRecordPolicy.ts";

describe("F5 · ownership guard — real production functions", () => {
  it("isRideOwnedByUser: userId 일치 → 적용", () => {
    const result = isRideOwnedByUser("user-123", "user-123");
    assert.equal(result, true, "same userId → owned");
  });

  it("isRideOwnedByUser: userId 불일치 → 거부", () => {
    const result = isRideOwnedByUser("user-456", "user-123");
    assert.equal(result, false, "different userId → not owned");
  });

  it("isRideOwnedByUser: active userId null → 거부", () => {
    const result = isRideOwnedByUser("user-123", null);
    assert.equal(result, false, "no active user → not owned");
  });

  it("isRideOwnedByUser: doc userId null → 거부", () => {
    const result = isRideOwnedByUser(null, "user-123");
    assert.equal(result, false, "no doc userId → not owned");
  });

  it("C12: isRideIdMatch — serverRideId 일치 → 적용", () => {
    const result = isRideIdMatch("ride-abc", "ride-abc");
    assert.equal(result, true, "same rideId → match");
  });

  it("C12: isRideIdMatch — serverRideId 불일치 → 거부", () => {
    const result = isRideIdMatch("ride-abc", "ride-xyz");
    assert.equal(result, false, "different rideId → no match");
  });

  it("C12: isRideIdMatch — expected null → 거부", () => {
    const result = isRideIdMatch(null, "ride-abc");
    assert.equal(result, false, "no expected rideId → no match");
  });
});

describe("F4 · independent save axes — leaf production helpers", () => {
  it("isDiscardableRideRecord: 100m 초과 + 5초 초과 → 유효", () => {
    const result = isDiscardableRideRecord(150, 10);
    assert.equal(result, false, "150m + 10s → keep");
  });

  it("isDiscardableRideRecord: 100m 이하 → 폐기", () => {
    const result = isDiscardableRideRecord(90, 10);
    assert.equal(result, true, "90m → discard");
  });

  it("isDiscardableRideRecord: 5초 이하 → 폐기", () => {
    const result = isDiscardableRideRecord(150, 4);
    assert.equal(result, true, "4s → discard");
  });

  it("isRouteCompletion: 0.98 이상 → 완주", () => {
    const result = isRouteCompletion(0.98);
    assert.equal(result, true, "98% → complete");
  });

  it("isRouteCompletion: 0.97 → 미완주", () => {
    const result = isRouteCompletion(0.97);
    assert.equal(result, false, "97% → incomplete");
  });

  it("C11: ride record validation — 동기 leaf helpers", () => {
    // C11: 끝 스냅샷은 동기 블록에서 고정
    // 여기서는 동기 호출 가능한 leaf helper들을 테스트
    
    // isDiscardableRideRecord: 동기 순수 함수
    const discardable = isDiscardableRideRecord(50, 3); // 100m 이하, 5초 이하
    assert.equal(discardable, true, "폐기 판정 동기 호출");
    
    // isRouteCompletion: 동기 순수 함수
    const completed = isRouteCompletion(0.99);
    assert.equal(completed, true, "완주 판정 동기 호출");
  });
});
