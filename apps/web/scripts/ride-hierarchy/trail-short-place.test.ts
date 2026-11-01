import assert from "node:assert/strict";
import test from "node:test";
import { shortTrailPlace } from "../../src/lib/trail/shortTrailPlace.ts";

// Chief 11-02: 지도 오른쪽 Trail 탭은 좁은 줄 — 앞의 행정 구역만 걷어낸다.
test("앞의 대한민국·시도·시군구만 걷어낸다", () => {
  assert.equal(shortTrailPlace("대한민국 서울특별시 용산구 이태원로 22"), "이태원로 22");
  assert.equal(shortTrailPlace("대한민국 경기도 성남시 분당구 정자동"), "정자동");
  assert.equal(shortTrailPlace("부산광역시 해운대구 우동"), "우동");
  assert.equal(shortTrailPlace("제주특별자치도 제주시 애월읍"), "애월읍");
});

test("행정 구역이 아니면 그대로 둔다", () => {
  assert.equal(shortTrailPlace("여의도 한 바퀴"), "여의도 한 바퀴");
  assert.equal(shortTrailPlace("남산 순환로"), "남산 순환로");
  assert.equal(shortTrailPlace("한강 자전거길"), "한강 자전거길");
});

test("마지막 한 토막은 남긴다", () => {
  assert.equal(shortTrailPlace("대한민국"), "대한민국");
  assert.equal(shortTrailPlace("서울특별시 용산구"), "용산구");
  assert.equal(shortTrailPlace("  "), "");
});
