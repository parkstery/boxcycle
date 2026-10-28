import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeaderboardResponse,
  cacheDataToSnapshot,
  computeBoardSnapshot,
  isCacheFresh,
  periodStartMs,
  snapshotToCacheData,
  type BoardSnapshot,
  type LeaderboardBoard,
  type LeaderboardPeriod,
  type LeaderboardRideRow,
} from "./leaderboardCore.js";

/**
 * 리더보드 집계 계약.
 *
 * 무엇을 막는가 — 이 계산이 틀리면 에러가 나지 않는다. 센서 인정 조건이 잘못 적용되거나, 주 경계가
 * 하루 밀리거나, 응답에 uid 가 새도 화면은 멀쩡히 뜬다.
 */

const HOUR = 3600 * 1000;
/** 2026-10-23(금) 12:00 KST. 이번 주 시작 = 2026-10-19(월) 00:00 KST (※ 계획서의 10-20 은 예시) */
const NOW = Date.UTC(2026, 9, 23, 3, 0, 0);
/** 2026-10-19 00:00 KST = 2026-10-18 15:00 UTC */
const WEEK_START = Date.UTC(2026, 9, 18, 15, 0, 0);
const MONTH_START = Date.UTC(2026, 8, 30, 15, 0, 0);

let seq = 0;
const ride = (uid: string, over: Partial<LeaderboardRideRow> = {}): LeaderboardRideRow => ({
  uid,
  endedAtMs: NOW - HOUR,
  distanceMeters: 10_000,
  newMeters: 2_000,
  tier: "t1",
  publicationId: `pub-${(seq += 1)}`,
  ...over,
});

function snapshot(
  rows: LeaderboardRideRow[],
  opts: {
    members?: string[];
    owners?: Record<string, string>;
    board?: LeaderboardBoard;
    period?: LeaderboardPeriod;
    nowMs?: number;
    sensorOnly?: boolean;
  } = {},
): BoardSnapshot {
  const uids = new Set(rows.map((r) => r.uid));
  return computeBoardSnapshot({
    rows,
    memberUids: new Set(opts.members ?? [...uids]),
    publicationOwners: new Map(Object.entries(opts.owners ?? {})),
    board: opts.board ?? "distance",
    period: opts.period ?? "all",
    nowMs: opts.nowMs ?? NOW,
    sensorOnly: opts.sensorOnly,
  });
}

const NAMES = (uids: string[]) => new Map(uids.map((u) => [u, `nick-${u}`]));
const respond = (
  s: BoardSnapshot,
  uid: string,
  isAnonymous = false,
  live: Record<string, string> = {},
) =>
  buildLeaderboardResponse(
    s,
    { uid, isAnonymous },
    {
      nicknames: NAMES(s.entries.map((e) => e.uid)),
      liveByUid: new Map(Object.entries(live)),
    },
  );

/** u1..uN 이 (N-i+1)*1km 씩 — u1 이 1위(N km). */
function ladder(n: number): LeaderboardRideRow[] {
  return Array.from({ length: n }, (_, i) =>
    ride(`u${i + 1}`, { distanceMeters: (n - i) * 1000 }),
  );
}

describe("periodStartMs — KST 경계", () => {
  it("주 = 월요일 00:00 KST: 일요일 23:59 은 지난 주, 월요일 00:00 은 새 주", () => {
    const sun2359 = Date.UTC(2026, 9, 25, 14, 59, 0); // 일 23:59 KST
    const mon0000 = Date.UTC(2026, 9, 25, 15, 0, 0); // 월 00:00 KST
    assert.equal(periodStartMs("week", sun2359), WEEK_START);
    assert.equal(periodStartMs("week", mon0000), WEEK_START + 7 * 24 * HOUR);
  });

  it("월 = 1일 00:00 KST, all = null", () => {
    assert.equal(periodStartMs("month", NOW), MONTH_START);
    assert.equal(periodStartMs("all", NOW), null);
  });

  it("기간 시작 직전·직후 주행이 갈린다", () => {
    const s = snapshot(
      [
        ride("a", { endedAtMs: WEEK_START - 1 }), // 일요일 23:59:59.999
        ride("b", { endedAtMs: WEEK_START }), // 월요일 00:00
      ],
      { period: "week" },
    );
    assert.deepEqual(s.entries.map((e) => e.uid), ["b"]);
    assert.equal(s.periodStartKst, "2026-10-19");
  });
});

describe("computeBoardSnapshot — 집계 규칙", () => {
  it("출시 조건으로 복원하면 t0 와 tier 없는 주행은 값에 들어가지 않는다", () => {
    const s = snapshot([
      ride("a", { tier: "t1", distanceMeters: 5000 }),
      ride("a", { tier: "t0", distanceMeters: 99_000 }),
      ride("a", { tier: null, distanceMeters: 99_000 }),
      ride("b", { tier: "t0" }),
    ], { sensorOnly: true });
    assert.deepEqual(s.entries, [{ uid: "a", meters: 5000, member: true }]);
  });

  it("테스트 중 t0·t1을 합산하고 미처리·알 수 없는 tier는 제외한다", () => {
    const rows = [ride("a", { distanceMeters: 1000, newMeters: 100 }),
      ride("a", { tier: "t0", distanceMeters: 2000, newMeters: 200 }),
      ride("manual", { tier: "t0", distanceMeters: 4000, newMeters: 400 }),
      ride("pending", { tier: null }), ride("unknown", { tier: "other" })];
    for (const board of ["distance", "pioneer"] as const) {
      const s = snapshot(rows, { board, sensorOnly: false });
      assert.deepEqual(s.entries.map(e => e.uid), ["a", "manual"]);
      assert.equal(s.entries[0]!.meters, board === "distance" ? 3000 : 300);
      const response = respond(s, "manual");
      assert.equal(response.me.status, "ranked");
      assert.equal(response.rule.sensorOnly, false);
    }
  });

  it("distance 는 distanceMeters 합, pioneer 는 newMeters 합", () => {
    const rows = [
      ride("a", { distanceMeters: 7000, newMeters: 1500 }),
      ride("a", { distanceMeters: 3000, newMeters: 500 }),
    ];
    assert.equal(snapshot(rows, { board: "distance" }).entries[0]!.meters, 10_000);
    assert.equal(snapshot(rows, { board: "pioneer" }).entries[0]!.meters, 2000);
  });

  it("값이 0 인 계정은 순위에 넣지 않는다(pioneer 새 도로 0)", () => {
    const s = snapshot([ride("a", { newMeters: 0 })], { board: "pioneer" });
    assert.deepEqual(s.entries, []);
  });
});

describe("순위·동점·회원/게스트", () => {
  it("동점은 같은 순위, 다음은 건너뛴다(1,2,2,4)", () => {
    const s = snapshot([
      ride("a", { distanceMeters: 9000 }),
      ride("b", { distanceMeters: 5000 }),
      ride("c", { distanceMeters: 5000 }),
      ride("d", { distanceMeters: 1000 }),
    ]);
    const r = respond(s, "d");
    assert.deepEqual(r.top.map((x) => x.rank), [1, 2, 2, 4]);
    assert.equal(r.me.rank, 4);
  });

  it("표시 값(0.1km)이 같으면 동점", () => {
    const s = snapshot([ride("a", { distanceMeters: 5040 }), ride("b", { distanceMeters: 4960 })]);
    const r = respond(s, "a");
    assert.deepEqual(r.top.map((x) => [x.rank, x.valueKm]), [[1, 5], [1, 5]]);
  });

  it("게스트는 순위 목록에서 빠지고 status guest + projectedRank 를 받는다", () => {
    const s = snapshot(
      [
        ride("m1", { distanceMeters: 30_000 }),
        ride("g", { distanceMeters: 20_000 }),
        ride("m2", { distanceMeters: 10_000 }),
      ],
      { members: ["m1", "m2"] },
    );
    const r = respond(s, "g", true);
    assert.deepEqual(r.top.map((x) => x.nickname), ["nick-m1", "nick-m2"]);
    assert.equal(r.me.status, "guest");
    assert.equal(r.me.rank, null);
    assert.equal(r.me.projectedRank, 2);
    assert.equal(r.me.valueKm, 20);
    assert.equal(r.me.uses, null);
    assert.deepEqual(r.me.around, []);
    assert.ok(r.top.every((x) => !x.isMe));
  });

  it("게스트라도 t1 주행이 없으면 projectedRank 는 null", () => {
    const s = snapshot([ride("m1")]);
    const r = respond(s, "g", true);
    assert.equal(r.me.status, "guest");
    assert.equal(r.me.projectedRank, null);
    assert.equal(r.me.valueKm, 0);
  });

  it("토큰이 회원이면 캐시에 게스트로 남아 있어도 순위에 든다(방금 회원 등록)", () => {
    const s = snapshot([ride("x", { distanceMeters: 8000 }), ride("y", { distanceMeters: 4000 })], {
      members: ["y"],
    });
    const r = respond(s, "x", false);
    assert.equal(r.me.status, "ranked");
    assert.equal(r.me.rank, 1);
  });

  it("회원인데 기간 안 t1 주행이 없으면 unranked", () => {
    const s = snapshot([ride("a"), ride("me", { tier: "t0" })], { sensorOnly: true });
    const r = respond(s, "me");
    assert.equal(r.me.status, "unranked");
    assert.equal(r.me.rank, null);
    assert.equal(r.me.valueKm, 0);
    assert.equal(r.me.gapToNextKm, null);
    assert.deepEqual(r.me.around, []);
  });

  it("gapToNextKm = 바로 앞(더 큰 값)과의 차이, 1위는 null, 소수 1자리", () => {
    const s = snapshot([
      ride("a", { distanceMeters: 42_000 }),
      ride("b", { distanceMeters: 38_400 }),
      ride("c", { distanceMeters: 38_400 }),
    ]);
    const rb = respond(s, "b");
    assert.equal(rb.me.rank, 2);
    assert.equal(rb.me.gapToNextKm, 3.6);
    assert.equal(rb.me.valueKm, 38.4);
    assert.equal(respond(s, "c").me.gapToNextKm, 3.6); // 동점은 같은 앞사람 기준
    assert.equal(respond(s, "a").me.gapToNextKm, null);
  });
});

describe("top·around", () => {
  it("top 은 20명, 내가 밖이면 around 는 내 줄(isMe)+위아래 3명", () => {
    const s = snapshot(ladder(40));
    const r = respond(s, "u30");
    assert.equal(r.top.length, 20);
    assert.deepEqual(r.me.around.map((x) => x.rank), [27, 28, 29, 30, 31, 32, 33]);
    assert.deepEqual(r.me.around.map((x) => x.isMe), [false, false, false, true, false, false, false]);
    assert.equal(r.me.rank, 30);
  });

  it("top 과 겹치는 줄은 around 에서 뺀다", () => {
    const s = snapshot(ladder(40));
    const r = respond(s, "u21"); // 위 3명 = 18~20위 (top 안)
    assert.deepEqual(r.me.around.map((x) => x.rank), [21, 22, 23, 24]);
    const inTop = respond(s, "u3");
    assert.ok(inTop.me.around.every((x) => x.rank > 20));
    assert.ok(inTop.top.some((x) => x.isMe));
  });

  it("목록 끝에서도 모자란 쪽을 건너뛴다", () => {
    const s = snapshot(ladder(25));
    const r = respond(s, "u25");
    assert.deepEqual(r.me.around.map((x) => x.rank), [22, 23, 24, 25]);
  });
});

describe("pioneer uses", () => {
  const owners = { "pub-mine": "me", "pub-other": "z" };

  it("내 퍼블릭을 다른 사람이 달린 사람 수·거리, 내 주행은 제외", () => {
    const s = snapshot(
      [
        ride("me", { publicationId: "pub-mine", distanceMeters: 5000 }), // 자기 주행: 제외
        ride("a", { publicationId: "pub-mine", distanceMeters: 20_000 }),
        ride("a", { publicationId: "pub-mine", distanceMeters: 2_000 }),
        ride("b", { publicationId: "pub-mine", distanceMeters: 20_000 }),
        ride("b", { publicationId: "pub-other", distanceMeters: 99_000 }), // 남의 퍼블릭
        ride("c", { publicationId: "pub-mine", distanceMeters: 77_000, tier: "t0" }), // t0 제외
      ],
      { board: "pioneer", owners, sensorOnly: true },
    );
    const r = respond(s, "me");
    assert.deepEqual(r.me.uses, { riders: 2, km: 42 });
    assert.equal(r.me.status, "ranked");
  });

  it("개척 주행이 없어도 내 길 이용은 나온다(unranked), distance 보드는 null", () => {
    const rows = [ride("a", { publicationId: "pub-mine", distanceMeters: 3000 })];
    const p = respond(snapshot(rows, { board: "pioneer", owners, members: ["a", "me"] }), "me");
    assert.equal(p.me.status, "unranked");
    assert.deepEqual(p.me.uses, { riders: 1, km: 3 });
    const d = respond(snapshot(rows, { board: "distance", owners }), "me");
    assert.equal(d.me.uses, null);
  });

  it("top 줄의 uses 는 항상 null", () => {
    const s = snapshot([ride("a")], { board: "pioneer", owners });
    assert.ok(respond(s, "a").top.every((x) => x.uses === null));
  });
});

describe("live 표시", () => {
  it("달리는 중인 사람 줄에 liveTrailId, 나 자신은 null", () => {
    const s = snapshot(ladder(3));
    const r = respond(s, "u2", false, { u1: "trail-1", u2: "trail-me" });
    assert.equal(r.top[0]!.liveTrailId, "trail-1");
    assert.equal(r.top[1]!.liveTrailId, null); // isMe
    assert.equal(r.top[2]!.liveTrailId, null);
  });
});

describe("응답에 uid 없음", () => {
  it("직렬화한 응답에 어떤 uid 도 나타나지 않는다", () => {
    const rows = [
      ...ladder(25).map((r) => ({ ...r, uid: `SECRETUID-${r.uid}` })),
      ride("SECRETUID-g", { distanceMeters: 5000 }),
    ];
    const s = snapshot(rows, {
      board: "pioneer",
      owners: { x: "SECRETUID-u1" },
      members: rows.map((r) => r.uid).filter((u) => u !== "SECRETUID-g"),
    });
    const nick = new Map<string, string>();
    for (const e of s.entries) nick.set(e.uid, "닉");
    for (const who of ["SECRETUID-u15", "SECRETUID-g"]) {
      const json = JSON.stringify(
        buildLeaderboardResponse(s, { uid: who, isAnonymous: who.endsWith("-g") }, {
          nicknames: nick,
          liveByUid: new Map(),
        }),
      );
      assert.ok(!json.includes("SECRETUID"), json);
      assert.ok(!/"uid"/i.test(json));
    }
  });

  it("닉네임이 없으면 대체 이름", () => {
    const s = snapshot([ride("a")]);
    const r = buildLeaderboardResponse(s, { uid: "a", isAnonymous: false }, {
      nicknames: new Map(),
      liveByUid: new Map(),
    });
    assert.equal(r.top[0]!.nickname, "라이더");
  });
});

describe("캐시", () => {
  it("스냅샷 ↔ 캐시 문서 왕복이 같다", () => {
    const s = snapshot([ride("a", { publicationId: "p" }), ride("b", { publicationId: "p" })], {
      board: "pioneer",
      owners: { p: "a" },
      period: "week",
    });
    const back = cacheDataToSnapshot(snapshotToCacheData(s), "pioneer", "week");
    assert.deepEqual(back, s);
  });

  it("이전 버전·다른 센서 조건의 캐시는 재사용하지 않는다", () => {
    const s = snapshot([ride("manual", { tier: "t0" })]);
    const cache = snapshotToCacheData(s);
    assert.equal(cacheDataToSnapshot({ ...cache, v: 1 }, "distance", "all"), null);
    assert.equal(cacheDataToSnapshot({ ...cache, sensorOnly: !cache.sensorOnly }, "distance", "all"), null);
    assert.equal(respond(snapshot([ride("a")], { sensorOnly: true }), "a").rule.sensorOnly, true);
  });

  it("5분 안이면 신선, 5분이 지나거나 주가 바뀌면 낡음, board/period 가 다르면 버림", () => {
    const s = snapshot([ride("a")], { period: "week" });
    assert.equal(isCacheFresh(s, NOW + 4 * 60 * 1000), true);
    assert.equal(isCacheFresh(s, NOW + 5 * 60 * 1000), false);
    // 같은 시각에 만든 캐시라도 월요일 0시를 넘기면 다시 계산
    const justBefore = snapshot([ride("a")], { period: "week", nowMs: WEEK_START + 7 * 24 * HOUR - 1000 });
    assert.equal(isCacheFresh(justBefore, WEEK_START + 7 * 24 * HOUR + 1000), false);
    assert.equal(cacheDataToSnapshot(snapshotToCacheData(s), "distance", "month"), null);
    assert.equal(cacheDataToSnapshot(undefined, "distance", "week"), null);
  });
});
