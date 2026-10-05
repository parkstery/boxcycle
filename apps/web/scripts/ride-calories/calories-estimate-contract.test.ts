/**
 * MET-gross-v1 칼로리 SoT · 집계 null 계약 · 프로필 스토어
 */
import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  buildCaloriesMeta,
  clampActiveSecForCalories,
  estimateGrossKcal,
  isLegacyDistanceCalories,
  parseCaloriesMeta,
  parseWeightKg,
  resolveMet,
} from "../../src/lib/ride/caloriesEstimate.ts";
import { aggregateRideStatsInRange } from "../../src/lib/ride/rideStatsAggregate.ts";
import type { StoredRideSession } from "../../src/lib/ride/rideSessionsStorage.ts";
import {
  emptyCalorieProfile,
  getCalorieProfileSnapshot,
  parseCalorieProfile,
  resetCalorieProfileCacheForTests,
  subscribeCalorieProfile,
  writeCalorieProfile,
} from "../../src/lib/ride/repo/calorieProfileLocal.ts";

describe("estimateGrossKcal · MET × kg × h", () => {
  it("70kg · 30min · 6MET = 210", () => {
    assert.equal(
      estimateGrossKcal({ weightKg: 70, met: 6, activeSec: 30 * 60 }),
      210,
    );
  });

  it("체중·강도·활동초 없으면 null (70kg 가정 금지)", () => {
    assert.equal(estimateGrossKcal({ weightKg: null, met: 6, activeSec: 1800 }), null);
    assert.equal(estimateGrossKcal({ weightKg: 70, met: null, activeSec: 1800 }), null);
    assert.equal(estimateGrossKcal({ weightKg: 70, met: 6, activeSec: null }), null);
  });

  it("센서 연결 후 RPM0 → activeSec 0 → 0kcal (미산정 null 과 구분)", () => {
    assert.equal(estimateGrossKcal({ weightKg: 70, met: 6, activeSec: 0 }), 0);
  });

  it("가상거리 변화와 무관 — 동일 입력 동일 kcal", () => {
    const a = estimateGrossKcal({ weightKg: 70, met: 6, activeSec: 1800 });
    const b = estimateGrossKcal({ weightKg: 70, met: 6, activeSec: 1800 });
    assert.equal(a, b);
    assert.equal(a, 210);
  });

  it("체중 범위 30–300만 허용 · boolean/object 거부", () => {
    assert.equal(parseWeightKg(29), null);
    assert.equal(parseWeightKg(30), 30);
    assert.equal(parseWeightKg(300), 300);
    assert.equal(parseWeightKg(301), null);
    assert.equal(parseWeightKg(true), null);
    assert.equal(parseWeightKg(false), null);
    assert.equal(parseWeightKg({ weightKg: 70 }), null);
  });

  it("강도 MET 가벼움4/보통6/강함8", () => {
    assert.equal(resolveMet("light"), 4);
    assert.equal(resolveMet("moderate"), 6);
    assert.equal(resolveMet("hard"), 8);
    assert.equal(resolveMet(null), null);
  });

  it("meta 는 체중 없이 version·met·activeSec·signalGap", () => {
    const meta = buildCaloriesMeta({ met: 6, activeSec: 1800, signalGap: true });
    assert.equal(meta.version, "MET-gross-v1");
    assert.equal(meta.met, 6);
    assert.equal(meta.activeSec, 1800);
    assert.equal(meta.inputMethod, "cadence");
    assert.equal(meta.signalGap, true);
    assert.equal("weightKg" in meta, false);
  });

  it("activeSec 는 elapsed 초과 시 clamp", () => {
    assert.equal(clampActiveSecForCalories(120, 100), 100);
    assert.equal(clampActiveSecForCalories(50, 100), 50);
    assert.equal(clampActiveSecForCalories(null, 100), null);
    assert.equal(
      estimateGrossKcal({
        weightKg: 70,
        met: 6,
        activeSec: clampActiveSecForCalories(9999, 1800),
      }),
      210,
    );
  });

  it("parseCaloriesMeta · version/NaN 거부", () => {
    assert.equal(parseCaloriesMeta(null), null);
    assert.equal(parseCaloriesMeta({ version: "legacy", met: 6, activeSec: 10 }), null);
    assert.equal(parseCaloriesMeta({ version: "MET-gross-v1", met: NaN, activeSec: 10 }), null);
    assert.equal(
      parseCaloriesMeta({ version: "MET-gross-v1", met: 6, activeSec: Number.NaN }),
      null,
    );
    const ok = parseCaloriesMeta({
      version: "MET-gross-v1",
      met: 6,
      activeSec: 90.7,
      signalGap: 1,
    });
    assert.equal(ok?.activeSec, 91);
    assert.equal(ok?.signalGap, true);
  });
});

describe("aggregateRideStats · null 칼로리", () => {
  function session(
    id: string,
    endedAt: Date,
    caloriesEstimate: number | null,
    caloriesMeta?: StoredRideSession["caloriesMeta"],
  ): StoredRideSession {
    return {
      id,
      endedAt: endedAt.toISOString(),
      elapsedSec: 600,
      distanceMeters: 3000,
      avgSpeedKmh: 18,
      caloriesEstimate,
      caloriesMeta,
      routeDistanceMeters: 3000,
      routeDurationSec: 600,
    };
  }

  it("null 을 0으로 합치지 않고 unknown count로 센다", () => {
    const start = new Date(2026, 9, 6, 0, 0, 0, 0);
    const end = new Date(2026, 9, 7, 0, 0, 0, 0);
    const stats = aggregateRideStatsInRange(
      [
        session("a", new Date(2026, 9, 6, 10, 0, 0, 0), 100),
        session("b", new Date(2026, 9, 6, 12, 0, 0, 0), null),
        session("c", new Date(2026, 9, 6, 14, 0, 0, 0), 50),
      ],
      start,
      end,
    );
    assert.equal(stats.caloriesEstimate, 150);
    assert.equal(stats.caloriesUnknownCount, 1);
    assert.equal(stats.rides, 3);
  });

  it("legacy 숫자는 합산에 포함 · meta 없으면 legacy", () => {
    const start = new Date(2026, 9, 6, 0, 0, 0, 0);
    const end = new Date(2026, 9, 7, 0, 0, 0, 0);
    const legacy = session("legacy", new Date(2026, 9, 6, 10, 0, 0, 0), 156);
    const stats = aggregateRideStatsInRange([legacy], start, end);
    assert.equal(stats.caloriesEstimate, 156);
    assert.equal(stats.caloriesUnknownCount, 0);
    assert.equal(isLegacyDistanceCalories(legacy), true);
  });

  it("전부 unknown 이면 합계 0 · unknown=rides (UI — 표시 근거)", () => {
    const start = new Date(2026, 9, 6, 0, 0, 0, 0);
    const end = new Date(2026, 9, 7, 0, 0, 0, 0);
    const stats = aggregateRideStatsInRange(
      [
        session("a", new Date(2026, 9, 6, 10, 0, 0, 0), null),
        session("b", new Date(2026, 9, 6, 12, 0, 0, 0), null),
      ],
      start,
      end,
    );
    assert.equal(stats.caloriesEstimate, 0);
    assert.equal(stats.caloriesUnknownCount, 2);
    assert.equal(stats.rides, 2);
    assert.ok(stats.caloriesUnknownCount >= stats.rides);
  });
});

describe("calorieProfileLocal · uid store", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    resetCalorieProfileCacheForTests();
    const store: Storage = {
      get length() {
        return memory.size;
      },
      clear() {
        memory.clear();
      },
      getItem(key: string) {
        return memory.has(key) ? memory.get(key)! : null;
      },
      key() {
        return null;
      },
      removeItem(key: string) {
        memory.delete(key);
      },
      setItem(key: string, value: string) {
        memory.set(key, String(value));
      },
    };
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: store,
    });
  });

  it("인증 전 write 거부 · snapshot 빈 프로필", () => {
    assert.equal(writeCalorieProfile(null, { weightKg: 70, intensityId: "moderate" }), false);
    assert.deepEqual(getCalorieProfileSnapshot(null), emptyCalorieProfile());
  });

  it("uid 전환 첫 snapshot 에 이전 체중 없음", () => {
    const userA = { uid: "uid-a" } as import("firebase/auth").User;
    const userB = { uid: "uid-b" } as import("firebase/auth").User;
    assert.equal(writeCalorieProfile(userA, { weightKg: 72, intensityId: "hard" }), true);
    assert.equal(getCalorieProfileSnapshot("uid-a").weightKg, 72);
    assert.equal(getCalorieProfileSnapshot("uid-b").weightKg, null);
    assert.equal(getCalorieProfileSnapshot(userB.uid).intensityId, null);
  });

  it("같은 탭 write 가 subscribe 리스너 통지", () => {
    const user = { uid: "uid-same" } as import("firebase/auth").User;
    let hits = 0;
    const unsub = subscribeCalorieProfile("uid-same", () => {
      hits += 1;
    });
    assert.equal(writeCalorieProfile(user, { weightKg: 65, intensityId: "light" }), true);
    assert.equal(hits, 1);
    assert.equal(getCalorieProfileSnapshot("uid-same").weightKg, 65);
    unsub();
  });

  it("storage 실패 시 false · 캐시 유지", () => {
    const user = { uid: "uid-fail" } as import("firebase/auth").User;
    assert.equal(writeCalorieProfile(user, { weightKg: 80, intensityId: "moderate" }), true);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
    });
    assert.equal(writeCalorieProfile(user, { weightKg: 90, intensityId: "hard" }), false);
    assert.equal(getCalorieProfileSnapshot("uid-fail").weightKg, 80);
  });

  it("parseCalorieProfile 이 invalid raw 를 빈 프로필로", () => {
    assert.deepEqual(parseCalorieProfile(true), emptyCalorieProfile());
    assert.deepEqual(parseCalorieProfile({ weightKg: true, intensityId: "nope" }), emptyCalorieProfile());
  });
});
