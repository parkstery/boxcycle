// 주행 스토리 계약 — 원칙 SoT: document/reference/product/261007-RTW-주행-스토리-원칙.md
// 사실에서만 칭찬하고(N1), 해낸 것을 먼저(N2), 남이 아니라 지난 나와(N3), 결핍의 말 없이(N4).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRideStoryFacts,
  composeRideEndStory,
  koreanOrdinal,
  type RideStoryFacts,
} from "../../src/lib/ride/rideStory.ts";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage.ts";

function session(id: string, endedAt: Date, distanceMeters = 3000, extra: Partial<StoredRideSession> = {}) {
  return {
    id,
    endedAt: endedAt.toISOString(),
    elapsedSec: 600,
    distanceMeters,
    avgSpeedKmh: 18,
    caloriesEstimate: null,
    routeDistanceMeters: 3000,
    routeDurationSec: 600,
    ...extra,
  } as StoredRideSession;
}

const NOW = new Date(2026, 9, 7, 21, 0, 0, 0);
const at = (dayOffset: number, hour: number) => new Date(2026, 9, 7 + dayOffset, hour, 0, 0, 0);

type ThisRide = Parameters<typeof buildRideStoryFacts>[0]["thisRide"];
function facts(sessions: StoredRideSession[], thisRide: Partial<ThisRide> = {}) {
  return buildRideStoryFacts({
    sessions,
    thisRide: {
      id: "this",
      serverRideId: null,
      distanceMeters: 2000,
      endedAtIso: NOW.toISOString(),
      routeMeters: 17900,
      previousProgressRatio: 0.18,
      progressRatio: 0.3,
      routeCompleted: false,
      ...thisRide,
    },
    now: NOW,
  });
}

const BASE: RideStoryFacts = {
  thisRideMeters: 2100,
  routeMeters: 17900,
  previousProgressRatio: 0.18,
  progressRatio: 0.3,
  routeCompleted: false,
  todayRides: 1,
  todayMeters: 2100,
  streakDays: 1,
  previousRides: 4,
  daysSincePreviousRide: 1,
  typicalMeters: null,
};

describe("사실 — 세는 일이 정확해야 칭찬이 성립한다(§4)", () => {
  it("Chief 예시 — 오늘 두 번째, 합계 5km(이전 3km + 이번 2km)", () => {
    const f = facts([session("a", at(0, 9), 3000)]);
    assert.equal(f.todayRides, 2);
    assert.equal(f.todayMeters, 5000);
  });

  it("이번 주행이 로컬 id 로 들어 있어도 빼고 센다", () => {
    const f = facts([session("a", at(0, 9)), session("this", NOW, 2000)]);
    assert.equal(f.todayRides, 2);
  });

  it("이번 주행이 서버판(id = 서버 문서 id)으로 들어 있어도 빼고 센다 — 2026-10-07 「네 번째」 결함", () => {
    const serverCopy = session("srv-this", NOW, 2000, { serverRideId: "srv-this" });
    assert.equal(facts([session("a", at(0, 9)), serverCopy], { serverRideId: "srv-this" }).todayRides, 2);
    // serverRideId 를 아직 모를 때도 끝난 시각·거리(지문)로 알아본다
    assert.equal(facts([session("a", at(0, 9)), serverCopy]).todayRides, 2);
  });

  it("지난 기록이 로컬판·서버판 두 줄이어도 한 번만 센다", () => {
    const local = session("seed", at(0, 8), 3000);
    const server = session("srv-seed", at(0, 8), 3000, { serverRideId: "srv-seed" });
    const f = facts([local, server]);
    assert.equal(f.todayRides, 2);
    assert.equal(f.todayMeters, 5000);
  });

  it("폐기 대상(100m 이하) 주행은 세지 않는다", () => {
    assert.equal(facts([session("tiny", at(0, 9), 50)]).todayRides, 1);
  });

  it("연속 일수 — 어제·그제 주행, 사흘 전 공백이면 3일", () => {
    const f = facts([session("a", at(-1, 9)), session("b", at(-2, 9)), session("c", at(-4, 9))]);
    assert.equal(f.streakDays, 3);
  });

  it("쉰 날 수 — 직전 주행이 8일 전이면 8, 기록이 없으면 null", () => {
    assert.equal(facts([session("a", at(-8, 23))]).daysSincePreviousRide, 8);
    assert.equal(facts([]).daysSincePreviousRide, null);
  });

  it("평소 거리는 5건 이상일 때만 — 4건이면 null", () => {
    const four = [1, 2, 3, 4].map((i) => session(`p${i}`, at(-i, 9), 4000));
    assert.equal(facts(four).typicalMeters, null);
    const five = [1, 2, 3, 4, 5].map((i) => session(`p${i}`, at(-i, 9), 4000));
    assert.equal(facts(five).typicalMeters, 4000);
  });
});

describe("헤드라인 — §5 M3 우선순위 표", () => {
  const cases: [string, Partial<RideStoryFacts>, string][] = [
    ["1 완주", { routeCompleted: true, progressRatio: 1 }, "17.9km 완주! 끝까지 해내셨어요."],
    ["2 첫 라이딩", { previousRides: 0, daysSincePreviousRide: null }, "첫 라이딩을 마치셨어요. 시작이 가장 어려운 법이에요."],
    ["3 복귀(7일)", { daysSincePreviousRide: 7 }, "다시 돌아오셨어요. 반가워요."],
    ["4 절반 돌파", { previousProgressRatio: 0.4, progressRatio: 0.55 }, "경로의 절반을 넘으셨어요."],
    ["5 연속 3일", { streakDays: 3 }, "3일째 페달을 밟고 계세요."],
    ["6 오늘 두 번째", { todayRides: 2, todayMeters: 5000 }, "오늘 두 번째 라이딩이에요. 다시 페달을 밟으셨네요."],
    ["7 평소보다", { typicalMeters: 1000 }, "평소보다 더 멀리 달리셨어요."],
    ["8 기본", {}, "오늘도 2.1km를 달리셨어요."],
  ];
  for (const [name, patch, want] of cases) {
    it(name, () => assert.equal(composeRideEndStory({ ...BASE, ...patch }).headline, want));
  }

  it("우선순위 — 완주가 연속·오늘 두 번째보다 먼저", () => {
    const s = composeRideEndStory({ ...BASE, routeCompleted: true, streakDays: 5, todayRides: 2 });
    assert.equal(s.kind, "completed");
  });

  it("복귀 6일은 복귀가 아니다(C7 = 7일)", () => {
    assert.notEqual(composeRideEndStory({ ...BASE, daysSincePreviousRide: 6 }).kind, "comeback");
  });

  it("「평소보다」는 그 사람의 기록으로만 — 베테랑의 평소 30km 대비 2km 도 깎지 않고 달린 것을 말한다", () => {
    const vet = composeRideEndStory({ ...BASE, typicalMeters: 30000 });
    assert.equal(vet.headline, "오늘도 2.1km를 달리셨어요.");
  });
});

describe("반복 회피(N7)", () => {
  it("직전과 같은 문형이면 다음 순위로", () => {
    const f = { ...BASE, streakDays: 4, todayRides: 2, todayMeters: 5000 };
    assert.equal(composeRideEndStory(f).kind, "streak");
    assert.equal(composeRideEndStory(f, "streak").kind, "todayAgain");
  });

  it("완주는 반복이어도 말한다", () => {
    assert.equal(composeRideEndStory({ ...BASE, routeCompleted: true }, "completed").kind, "completed");
  });
});

describe("사실 줄 — 해낸 것이 먼저, 남은 것은 뒤(N2)", () => {
  it("미완주 + 오늘 두 번째", () => {
    const s = composeRideEndStory({ ...BASE, todayRides: 2, todayMeters: 5000 });
    assert.equal(s.detail, "17.9km 중 5.4km · 남은 12.5km · 오늘 2번 · 합계 5.0km");
  });

  it("완주면 남은 거리를 말하지 않는다", () => {
    assert.equal(composeRideEndStory({ ...BASE, routeCompleted: true, progressRatio: 1 }).detail, null);
  });

  it("경로 없이 달린 단독 주행은 사실 줄이 없다", () => {
    assert.equal(composeRideEndStory({ ...BASE, routeMeters: 0 }).detail, null);
  });
});

describe("쓰지 않는 말(N4) — 어떤 사실 조합에서도", () => {
  const banned = /미달|부족|겨우|밖에|만이에요|상위|하위|목표의|!!/;
  it("모든 문형·사실 줄에 결핍·비교·하루 목표의 말이 없다", () => {
    const variants: Partial<RideStoryFacts>[] = [
      {}, { routeCompleted: true }, { previousRides: 0 }, { daysSincePreviousRide: 30 },
      { previousProgressRatio: 0.1, progressRatio: 0.6 }, { streakDays: 9 },
      { todayRides: 12, todayMeters: 40000 }, { typicalMeters: 100 }, { thisRideMeters: 120 },
    ];
    for (const v of variants) {
      const s = composeRideEndStory({ ...BASE, ...v });
      assert.doesNotMatch(`${s.headline} ${s.detail ?? ""}`, banned, JSON.stringify(v));
    }
  });
});

it("서수 — 열 번째까지 우리말, 그 뒤는 숫자", () => {
  assert.equal(koreanOrdinal(1), "첫 번째");
  assert.equal(koreanOrdinal(10), "열 번째");
  assert.equal(koreanOrdinal(11), "11번째");
});
