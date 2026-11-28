import assert from "node:assert/strict";
import test from "node:test";
import {
  __applyServerOffsetSampleForTests, __resetServerClockOffsetForTests, isServerClockReady, isServerClockUncertain, peekServerTimeOffsetMs,
} from "../../src/lib/peerMotion/repo/serverClockOffset.ts";

test("11-28 서버시계 큰 점프 뒤 「불확실」은 3초 뒤 스스로 풀린다(새 표본이 오지 않아도)", () => {
  __resetServerClockOffsetForTests();
  __applyServerOffsetSampleForTests(0, 1_000);          // SDK 첫 값(연결 전 0)
  __applyServerOffsetSampleForTests(7_500, 2_000);      // 실제 offset — 5초 이상 점프
  assert.equal(isServerClockReady(), true);
  assert.equal(peekServerTimeOffsetMs(), 7_500);
  assert.equal(isServerClockUncertain(2_500), true, "점프 직후는 불확실(구/신 축 버퍼 혼용 금지)");
  assert.equal(isServerClockUncertain(4_999), true);
  assert.equal(isServerClockUncertain(5_000), false, "3초 뒤 공통 표시 시계로 복귀");
  assert.equal(isServerClockUncertain(60_000), false, "한 번 풀리면 계속 정상(종전: 다음 표본까지 무기한 불확실)");
  __resetServerClockOffsetForTests();
});

test("작은 드리프트는 불확실을 만들지 않는다", () => {
  __resetServerClockOffsetForTests();
  __applyServerOffsetSampleForTests(200, 1_000);
  __applyServerOffsetSampleForTests(1_400, 2_000);
  assert.equal(isServerClockUncertain(2_001), false);
  __resetServerClockOffsetForTests();
});
