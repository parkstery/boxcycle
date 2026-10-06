/**
 * 운동 기록 폐기 ↔ 저장 경로 진행 반영 분리 계약(지시 13).
 * 「폐기면 반영 안 함」으로 되돌리면 (a) 가 실패한다(사보타주).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveRideEndDisposition } from "../../src/lib/ride/rideRecordPolicy.ts";

describe("resolveRideEndDisposition", () => {
  it("(a) 95%→100%, 세션 22m·15초 → 기록 폐기 + 완주 반영", () => {
    const d = resolveRideEndDisposition({
      distanceMeters: 22,
      elapsedSec: 15,
      hasSavedRoute: true,
      previousProgressRatio: 0.95,
      completionRatio: 1,
    });
    assert.equal(d.discardRecord, true);
    assert.equal(d.applySavedRouteProgress, true);
  });

  it("(b) 0%→3%, 세션 20m → 기록 폐기 + 진행 반영", () => {
    const d = resolveRideEndDisposition({
      distanceMeters: 20,
      elapsedSec: 10,
      hasSavedRoute: true,
      previousProgressRatio: 0,
      completionRatio: 0.03,
    });
    assert.equal(d.discardRecord, true);
    assert.equal(d.applySavedRouteProgress, true);
  });

  it("(c) 진행 증가 없음·즉시 종료 → 폐기 + 반영 없음", () => {
    const d = resolveRideEndDisposition({
      distanceMeters: 5,
      elapsedSec: 2,
      hasSavedRoute: true,
      previousProgressRatio: 0.4,
      completionRatio: 0.4,
    });
    assert.equal(d.discardRecord, true);
    assert.equal(d.applySavedRouteProgress, false);
  });

  it("(d) 일반 긴 주행 → 폐기 없음 + 진행 반영(종전)", () => {
    const d = resolveRideEndDisposition({
      distanceMeters: 500,
      elapsedSec: 60,
      hasSavedRoute: true,
      previousProgressRatio: 0,
      completionRatio: 0.5,
    });
    assert.equal(d.discardRecord, false);
    assert.equal(d.applySavedRouteProgress, true);
  });

  it("ad-hoc 짧은 주행은 폐기해도 진행 반영 없음", () => {
    const d = resolveRideEndDisposition({
      distanceMeters: 22,
      elapsedSec: 15,
      hasSavedRoute: false,
      previousProgressRatio: 0,
      completionRatio: 1,
    });
    assert.equal(d.discardRecord, true);
    assert.equal(d.applySavedRouteProgress, false);
  });

  it("사보타주: 폐기면 반영 안 함으로 되돌리면 (a) 실패", () => {
    // 의도적 회귀 판정 — discardRecord 만 보고 apply 를 끄면 안 된다.
    const d = resolveRideEndDisposition({
      distanceMeters: 22,
      elapsedSec: 15,
      hasSavedRoute: true,
      previousProgressRatio: 0.95,
      completionRatio: 1,
    });
    assert.equal(
      d.discardRecord && d.applySavedRouteProgress,
      true,
      "폐기여도 진행 증가(완주)면 applySavedRouteProgress 가 true 여야 한다",
    );
  });
});
