// 최근 주행 목록 병합 계약 — 2026-09-03 폰 실사용 결함 ⑦.
//
// 「다음 주행」 카드가 한 세대 전(테헤란로27길)을 가리켰다. 주행 종료는 로컬 기록을 즉시
// 반영하지만 Firestore 쓰기는 fire-and-forget 이고, `useRecentRideSessions` 의 effect 는
// deps 에 `profile`·`trailId` 가 있어 이어 달리기로 이동수단이 바뀌면 재실행된다.
// 그때 아직 최신 주행이 없는 서버 응답이 로컬을 통째로 덮어썼다.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeRecentRideSessions,
  type StoredRideSession,
} from "../../src/lib/rideSessionsStorage.ts";

function session(id: string, endedAt: string, extra: Partial<StoredRideSession> = {}) {
  return {
    id,
    endedAt,
    elapsedSec: 600,
    distanceMeters: 3000,
    avgSpeedKmh: 18,
    caloriesEstimate: 100,
    routeDistanceMeters: 3000,
    routeDurationSec: 600,
    ...extra,
  } as StoredRideSession;
}

describe("M0 · 시험 자가 검산", () => {
  it("입력이 서로 다른 세대라 병합을 실제로 구별한다", () => {
    const server = [session("r1", "2026-09-03T07:50:00.000Z")];
    const local = [session("r2", "2026-09-03T07:58:00.000Z"), server[0]!];
    assert.notEqual(server[0]!.id, local[0]!.id);
  });
});

describe("결함 ⑦ · 서버 응답이 로컬 최신을 덮지 않는다", () => {
  it("서버에 아직 없는 최신 주행이 살아남고 맨 앞에 온다", () => {
    const newest = session("r2", "2026-09-03T07:58:00.000Z");
    const merged = mergeRecentRideSessions(
      [session("r1", "2026-09-03T07:50:00.000Z")], // 서버 — 한 세대 뒤
      [newest, session("r1", "2026-09-03T07:50:00.000Z")],
    );
    assert.equal(merged[0]?.id, "r2", "카드가 한 세대 전을 가리킨다");
    assert.equal(merged.length, 2);
  });

  it("같은 id 는 서버판이 정본이다(지명 등 후처리 반영)", () => {
    const merged = mergeRecentRideSessions(
      [session("r1", "2026-09-03T07:50:00.000Z", { endPlaceLabel: "논현로98길" })],
      [session("r1", "2026-09-03T07:50:00.000Z", { endPlaceLabel: undefined })],
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.endPlaceLabel, "논현로98길");
  });

  it("endedAt 내림차순으로 정렬된다", () => {
    const merged = mergeRecentRideSessions(
      [session("a", "2026-09-01T00:00:00.000Z")],
      [session("c", "2026-09-03T00:00:00.000Z"), session("b", "2026-09-02T00:00:00.000Z")],
    );
    assert.deepEqual(merged.map((r) => r.id), ["c", "b", "a"]);
  });

  it("상한을 지킨다", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      session(`s${i}`, new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString()),
    );
    assert.equal(mergeRecentRideSessions([], many, 50).length, 50);
  });

  it("망가진 endedAt 이 있어도 최신이 앞으로 온다", () => {
    const merged = mergeRecentRideSessions(
      [session("bad", "nope")],
      [session("good", "2026-09-03T07:58:00.000Z")],
    );
    assert.equal(merged[0]?.id, "good");
  });

  it("한쪽이 비어도 다른 쪽을 그대로 돌려준다", () => {
    assert.equal(mergeRecentRideSessions([], [session("x", "2026-09-03T00:00:00.000Z")]).length, 1);
    assert.equal(mergeRecentRideSessions([session("y", "2026-09-03T00:00:00.000Z")], []).length, 1);
  });
});
