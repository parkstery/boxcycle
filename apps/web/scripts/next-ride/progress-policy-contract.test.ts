// SavedRoute 진행률 단조 보존 계약(RIDE-CONTINUE-1 §7.1 「진행률·중복 저장」).
// Firestore transaction·로컬 저장·중복 갱신이 공유하는 순수 규칙만 검증한다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  preserveDedupedSavedRouteState,
  resolveSavedRouteProgressUpdate,
} from "../../src/lib/savedRouteProgressPolicy.ts";

describe("resolveSavedRouteProgressUpdate", () => {
  it("31% → 43% 는 43% 로 올라간다", () => {
    const d = resolveSavedRouteProgressUpdate(
      { completed: 0, lastProgressRatio: 0.31 },
      0.43,
    );
    assert.equal(d.shouldWrite, true);
    assert.ok(Math.abs(d.nextProgressRatio - 0.43) < 1e-9);
    assert.equal(d.completed, 0);
  });

  it("43% 뒤 늦은 31% 는 43% 로 남고 쓰지 않는다(lastRideId 도 보존)", () => {
    const d = resolveSavedRouteProgressUpdate(
      { completed: 0, lastProgressRatio: 0.43 },
      0.31,
    );
    assert.equal(d.shouldWrite, false, "stale write 가 문서를 건드렸다");
    assert.ok(Math.abs(d.nextProgressRatio - 0.43) < 1e-9);
  });

  it("같은 값이면 쓰지 않는다", () => {
    const d = resolveSavedRouteProgressUpdate(
      { completed: 0, lastProgressRatio: 0.43 },
      0.43,
    );
    assert.equal(d.shouldWrite, false);
  });

  it("completed=1 문서는 20% 요청으로 미완주가 되지 않는다", () => {
    const d = resolveSavedRouteProgressUpdate({ completed: 1, lastProgressRatio: 1 }, 0.2);
    assert.equal(d.shouldWrite, false);
    assert.equal(d.completed, 1);
    assert.equal(d.nextProgressRatio, 1);
  });

  it("NaN·범위 밖 요청은 clamp 된다", () => {
    assert.equal(
      resolveSavedRouteProgressUpdate({ completed: 0, lastProgressRatio: 0.3 }, Number.NaN)
        .shouldWrite,
      false,
    );
    const over = resolveSavedRouteProgressUpdate({ completed: 0, lastProgressRatio: 0.3 }, 7);
    assert.equal(over.nextProgressRatio, 1);
  });
});

describe("preserveDedupedSavedRouteState", () => {
  const fallback = {
    completed: 0 as const,
    completedAtIso: null,
    expiresAtIso: "2026-11-27T00:00:00.000Z",
    lastRideId: null,
    lastProgressRatio: 0,
    createdAtIso: "2026-08-29T00:00:00.000Z",
  };

  it("중복 저장이 기존 완료·진행 상태를 초기화하지 않는다", () => {
    const preserved = preserveDedupedSavedRouteState(
      {
        completed: 0,
        completedAtIso: null,
        expiresAtIso: "2026-10-01T00:00:00.000Z",
        lastRideId: "ride-9",
        lastProgressRatio: 0.43,
        createdAtIso: "2026-07-01T00:00:00.000Z",
      },
      fallback,
    );
    assert.ok(Math.abs(preserved.lastProgressRatio - 0.43) < 1e-9);
    assert.equal(preserved.lastRideId, "ride-9");
    assert.equal(preserved.createdAtIso, "2026-07-01T00:00:00.000Z", "최초 생성 시각이 덮였다");
    assert.equal(preserved.expiresAtIso, "2026-10-01T00:00:00.000Z");
  });

  it("완주 문서는 completed=1·진행률 1·TTL 없음을 유지한다", () => {
    const preserved = preserveDedupedSavedRouteState(
      {
        completed: 1,
        completedAtIso: "2026-08-10T00:00:00.000Z",
        expiresAtIso: null,
        lastRideId: "ride-3",
        lastProgressRatio: 1,
        createdAtIso: "2026-07-01T00:00:00.000Z",
      },
      fallback,
    );
    assert.equal(preserved.completed, 1);
    assert.equal(preserved.lastProgressRatio, 1);
    assert.equal(preserved.expiresAtIso, null, "완주 문서에 TTL 이 되살아났다");
  });

  it("기존 문서를 못 읽으면 신규 기본값으로 폴백한다", () => {
    assert.deepEqual(preserveDedupedSavedRouteState(null, fallback), fallback);
  });
});
