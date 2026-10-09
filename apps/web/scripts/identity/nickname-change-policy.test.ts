/**
 * 닉네임 변경 30일 제한·옛 이름 7일 묶기 판정(2026-10-09 Chief). 서버 규칙은 같은 수치로
 * nickname-change.emulator.test.ts 가 확인한다.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  nicknameChangeBlockedUntilMs,
  nicknameReservationAccess,
  NICKNAME_CHANGE_COOLDOWN_DAYS,
  NICKNAME_RELEASE_HOLD_DAYS,
} from "../../src/lib/identity/nickname.ts";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 9);

test("수치는 chief 결정 그대로", () => {
  assert.equal(NICKNAME_CHANGE_COOLDOWN_DAYS, 30);
  assert.equal(NICKNAME_RELEASE_HOLD_DAYS, 7);
});

test("30일 제한 — 변경 기록 없으면 바로, 30일째까지 막고 그 뒤 풀린다", () => {
  assert.equal(nicknameChangeBlockedUntilMs(null, NOW), null);
  assert.equal(nicknameChangeBlockedUntilMs(NOW - 29 * DAY, NOW), NOW + DAY);
  assert.equal(nicknameChangeBlockedUntilMs(NOW - 30 * DAY, NOW), NOW, "정확히 30일째는 아직(규칙도 >)");
  assert.equal(nicknameChangeBlockedUntilMs(NOW - 30 * DAY - 1, NOW), null);
});

test("예약 접근 — 내 것·되찾기·남의 것·묶임 끝", () => {
  assert.equal(nicknameReservationAccess({ ownerUid: "me", releasedAtMs: null }, "me", NOW), "mine");
  assert.equal(nicknameReservationAccess({ ownerUid: "me", releasedAtMs: NOW }, "me", NOW), "reclaim");
  assert.equal(nicknameReservationAccess({ ownerUid: "b", releasedAtMs: null }, "me", NOW), "taken");
  assert.equal(nicknameReservationAccess({ ownerUid: "b", releasedAtMs: NOW - 7 * DAY }, "me", NOW), "taken");
  assert.equal(nicknameReservationAccess({ ownerUid: "b", releasedAtMs: NOW - 7 * DAY - 1 }, "me", NOW), "free");
});
