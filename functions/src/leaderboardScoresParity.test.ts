import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLeaderboardResponse,
  computeBoardSnapshot,
  renderLeaderboard,
  type LeaderboardBoard,
  type LeaderboardPeriod,
  type LeaderboardRideRow,
} from "./leaderboardCore.js";
import { FakeScoreDb } from "./leaderboardFakeFirestore.js";
import type { RideScoreInput } from "./leaderboardScoresCore.js";
import {
  applyRideScoresInTransaction,
  loadLeaderboardLayoutFromScores,
  resetLeaderboardTopMemoForTests,
} from "./leaderboardScoresStore.js";

/**
 * 동등성 시험 — 같은 합성 주행 묶음으로
 *   기존 경로(rides 전체 훑기): computeBoardSnapshot + buildLeaderboardResponse
 *   새 경로(누적 점수): 주행마다 트랜잭션으로 더한 점수 문서 → loadLeaderboardLayoutFromScores + renderLeaderboard
 * 의 LeaderboardResponse 가 **완전히 같아야** 한다(판 2 × 기간 3 × 센서 조건 2 × 모든 요청자 × 회원/게스트 토큰).
 *
 * 무엇을 막는가: 동점(1,2,2,4)·회원 필터·around·gap 이 한 칸 어긋나도 에러 없이 화면은 멀쩡히 뜬다.
 * 사보타주(동점 처리나 member 필터를 빼면 이 시험이 FAIL) 확인은 03-result-g3-1.md 에 기록했다.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
/** 2026-10-23(금) 12:00 KST */
const NOW = Date.UTC(2026, 9, 23, 3, 0, 0);
const WEEK_START = Date.UTC(2026, 9, 18, 15, 0, 0); // 10-19(월) 00:00 KST
const MONTH_START = Date.UTC(2026, 8, 30, 15, 0, 0); // 10-01 00:00 KST

/** 재현 가능한 의사 난수(mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Scenario = {
  rides: LeaderboardRideRow[];
  members: Set<string>;
  owners: Map<string, string>;
  /** 요청자로 시험할 uid 전부(주행 없는 사람 포함) */
  uids: string[];
};

/** 0.25 m 단위 — 이진수로 정확히 더해져 합산 순서가 달라도 같은 값이 된다. */
const quarter = (n: number): number => Math.round(n * 4) / 4;

function randomScenario(seed: number): Scenario {
  const rand = rng(seed);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)]!;
  const members = new Set<string>();
  const uids: string[] = [];
  for (let i = 0; i < 46; i += 1) {
    const uid = `m${String(i).padStart(2, "0")}`;
    members.add(uid);
    uids.push(uid);
  }
  for (let i = 0; i < 6; i += 1) uids.push(`g${i}`); // 게스트 계정
  uids.push("idle-member", "idle-guest"); // 주행 없음
  members.add("idle-member");

  const owners = new Map<string, string>([
    ["pub1", "m03"], ["pub2", "m07"], ["pub3", "m03"], ["pub4", "g1"], ["pub5", "m20"],
    ["pub-self", "m11"],
  ]);
  const pubs = [null, null, null, "pub1", "pub2", "pub3", "pub4", "pub5", "pub-self", "pub-orphan"] as const;
  // 동점이 자주 생기게 값을 몇 개로 묶는다(0.1km 경계 근처 포함).
  const distances = [1000, 1049.75, 1050, 2000, 2000.25, 3500, 4960, 5040, 7000, 7000, 12_000, 12_040, 12_049.75, 25_000];
  const endings = [
    () => NOW - rand() * 3 * DAY, // 이번 주
    () => NOW - rand() * 3 * DAY,
    () => MONTH_START + rand() * 17 * DAY, // 이번 달
    () => MONTH_START - rand() * 25 * DAY, // 지난 달
    () => NOW - 200 * DAY - rand() * 100 * DAY, // 작년 초
    () => WEEK_START, // 주 시작 정각
    () => WEEK_START - 1, // 주 시작 직전
    () => MONTH_START,
    () => MONTH_START - 1,
  ];
  const tiers = ["t1", "t1", "t1", "t1", "t0", "t0", null, "other"] as const;

  const rides: LeaderboardRideRow[] = [];
  for (const uid of uids) {
    if (uid.startsWith("idle")) continue;
    const n = 1 + Math.floor(rand() * 4);
    for (let k = 0; k < n; k += 1) {
      const distanceMeters = rand() < 0.5 ? pick(distances) : quarter(500 + rand() * 20_000);
      rides.push({
        uid,
        endedAtMs: Math.floor(pick(endings)()),
        distanceMeters,
        newMeters: rand() < 0.2 ? 0 : quarter(distanceMeters * rand() * 0.6),
        tier: pick(tiers),
        publicationId: pick(pubs),
      });
    }
  }
  rides.push({ uid: "m00", endedAtMs: null, distanceMeters: 99_000, newMeters: 99_000, tier: "t1", publicationId: null });
  return { rides, members, owners, uids };
}

/** 상위 20위 경계에서 동점이 이어지는 구성: 1.0km 간격 18명 위, 12.0km 동점 6명(meters 달라 정렬 확인), 그 아래. */
function boundaryScenario(): Scenario {
  const rides: LeaderboardRideRow[] = [];
  const members = new Set<string>();
  const uids: string[] = [];
  const add = (uid: string, distanceMeters: number, member = true): void => {
    uids.push(uid);
    if (member) members.add(uid);
    rides.push({ uid, endedAtMs: NOW - HOUR, distanceMeters, newMeters: distanceMeters / 4, tier: "t1", publicationId: null });
  };
  for (let i = 0; i < 18; i += 1) add(`top${String(i).padStart(2, "0")}`, 40_000 - i * 1000);
  // 같은 0.1km(12.0) 6명 — 19위 동점 그룹이 20위 경계를 넘는다
  [12_040, 12_049.75, 12_000, 12_030, 12_049.75, 12_010].forEach((m, i) => add(`tie${i}`, m));
  for (let i = 0; i < 8; i += 1) add(`low${i}`, 11_000 - i * 700);
  add("guest-high", 30_000, false);
  return { rides, members, owners: new Map(), uids: [...uids, "ghost"] };
}

function shuffled<T>(list: readonly T[], seed: number): T[] {
  const rand = rng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** 새 경로의 점수 문서를 만든다 — 주행을 섞은 순서로 트랜잭션마다 하나씩 더한다. */
async function buildScoreDb(s: Scenario, seed: number): Promise<FakeScoreDb> {
  const db = new FakeScoreDb();
  let n = 0;
  for (const r of shuffled(s.rides, seed)) {
    n += 1;
    const input: RideScoreInput = {
      rideId: `ride${n}`,
      userId: r.uid,
      endedAtMs: r.endedAtMs,
      tier: r.tier,
      distanceMeters: r.distanceMeters,
      newMeters: r.newMeters,
      publicationId: r.publicationId,
      publicationOwnerUid: r.publicationId ? (s.owners.get(r.publicationId) ?? null) : null,
    };
    const member = s.members.has(r.uid);
    await db.runTransaction((tx) => applyRideScoresInTransaction(tx as never, db.asFirestore(), input, member, 0));
  }
  return db;
}

const BOARDS: LeaderboardBoard[] = ["distance", "pioneer"];
const PERIODS: LeaderboardPeriod[] = ["week", "month", "all"];

async function assertParity(s: Scenario, seed: number, label: string): Promise<number> {
  const db = await buildScoreDb(s, seed);
  const nicknames = new Map(s.uids.map((u) => [u, `nick-${u}`]));
  const liveByUid = new Map([[s.uids[1]!, "trail-1"], [s.uids[5]!, "trail-5"]]);
  let compared = 0;
  for (const board of BOARDS) {
    for (const period of PERIODS) {
      for (const sensorOnly of [false, true]) {
        const snapshot = computeBoardSnapshot({
          rows: s.rides, memberUids: s.members, publicationOwners: s.owners, board, period, nowMs: NOW, sensorOnly,
        });
        resetLeaderboardTopMemoForTests();
        // 토큰이 회원/게스트인 두 경우를 모든 uid 에 대해 본다 — 문서의 member 표시와 토큰이 어긋나는 경우도 포함된다.
        for (const uid of s.uids) {
          for (const isAnonymous of [false, true]) {
            const requester = { uid, isAnonymous };
            const expected = buildLeaderboardResponse(snapshot, requester, { nicknames, liveByUid });
            const layout = await loadLeaderboardLayoutFromScores(db.asFirestore(), {
              board, period, requester, nowMs: NOW, sensorOnly,
            });
            const actual = renderLeaderboard(layout, { nicknames, liveByUid });
            assert.deepEqual(
              actual,
              expected,
              `${label} ${board}/${period}/sensorOnly=${sensorOnly} requester=${uid} anon=${isAnonymous}`,
            );
            compared += 1;
          }
        }
      }
    }
  }
  return compared;
}

describe("동등성 — 기존 rides 훑기 vs 누적 점수", () => {
  for (const seed of [1, 2, 3]) {
    it(`무작위 합성 묶음 seed=${seed}: 모든 요청자·판·기간·센서 조건에서 응답이 같다`, async () => {
      const compared = await assertParity(randomScenario(seed), seed * 101, `seed${seed}`);
      assert.ok(compared >= 54 * 2 * 12, `비교 건수 ${compared}`);
    });
  }

  it("20위 경계에서 동점이 이어지는 구성(1,2,2,4 규칙·meters 정렬·uid 정렬)", async () => {
    const compared = await assertParity(boundaryScenario(), 7, "boundary");
    assert.ok(compared > 0);
  });

  it("합성 묶음이 시험 대상을 실제로 건드린다: 동점·게스트·around·uses 가 응답에 나온다", async () => {
    const s = randomScenario(1);
    const snapshot = computeBoardSnapshot({
      rows: s.rides, memberUids: s.members, publicationOwners: s.owners, board: "distance", period: "all", nowMs: NOW,
    });
    const names = { nicknames: new Map(), liveByUid: new Map() };
    const resp = buildLeaderboardResponse(snapshot, { uid: "m30", isAnonymous: false }, names);
    const b = boundaryScenario();
    const bSnap = computeBoardSnapshot({
      rows: b.rides, memberUids: b.members, publicationOwners: b.owners, board: "distance", period: "all", nowMs: NOW,
    });
    const bRanks = buildLeaderboardResponse(bSnap, { uid: "low3", isAnonymous: false }, names).top.map((r) => r.rank);
    assert.ok(bRanks.some((r, i) => i > 0 && r === bRanks[i - 1]), "경계 구성의 top 에 동점이 있다");
    assert.ok(resp.me.around.length > 0 || resp.top.some((r) => r.isMe));
    const guest = buildLeaderboardResponse(snapshot, { uid: "g0", isAnonymous: true }, names);
    assert.equal(guest.me.status, "guest");
    assert.ok(guest.me.projectedRank != null);
    const pio = computeBoardSnapshot({
      rows: s.rides, memberUids: s.members, publicationOwners: s.owners, board: "pioneer", period: "all", nowMs: NOW,
    });
    assert.ok(Object.keys(pio.uses).length > 0, "개척판 uses 가 있다");
    const owner = buildLeaderboardResponse(pio, { uid: "m03", isAnonymous: false }, names);
    assert.ok(owner.me.uses && owner.me.uses.riders > 0);
  });

  it("점수 경로는 rides 를 읽지 않고 상위 N·내 주변만 읽는다(읽기 수가 사용자 수에 비례하지 않는다)", async () => {
    const s = boundaryScenario();
    const db = await buildScoreDb(s, 3);
    resetLeaderboardTopMemoForTests();
    db.queryReads = 0;
    await loadLeaderboardLayoutFromScores(db.asFirestore(), {
      board: "distance", period: "all", requester: { uid: "low3", isAnonymous: false }, nowMs: NOW, sensorOnly: false,
    });
    // top(N+1) + 이전/이후 각 3 + 근접 1 + 줄별 count — 전체 문서 수(≈33 × 기간 4 × 판 2)보다 훨씬 작다.
    assert.ok(db.queryReads < 40, `queryReads=${db.queryReads}`);
    assert.ok(![...db.docs.keys()].some((p) => p.startsWith("rides/")));
  });
});
