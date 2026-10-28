import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isRouteShorterThanInterval } from "../../src/lib/route/distanceAutoRouteEta.ts";
import {
  DEFAULT_RIDE_INTERVAL_CONFIG,
  getRideIntervalTotalMs,
  getRideIntervalView,
  isRideIntervalConfig,
  matchRideIntervalPreset,
  normalizeRideIntervalConfig,
  RIDE_INTERVAL_PRESETS,
  RIDE_INTERVAL_TOTAL_MS,
} from "../../src/lib/ride/rideInterval.ts";

const DEFAULT = DEFAULT_RIDE_INTERVAL_CONFIG;

test("예상 경로 시간이 운동보다 짧을 때만 확인한다", () => {
  assert.equal(isRouteShorterThanInterval(4999, 20, 900), true);
  assert.equal(isRouteShorterThanInterval(5000, 20, 900), false);
  assert.equal(isRouteShorterThanInterval(0, 20, 900), false);
  assert.equal(isRouteShorterThanInterval(5000, 0, 900), false);
});

test("기본 1:2 25분 루틴의 모든 구간 경계에서 정확히 다음 단계로 넘어간다", () => {
  assert.equal(RIDE_INTERVAL_TOTAL_MS, 1_500_000);
  assert.equal(getRideIntervalView(0).remainingSec, 300);
  assert.equal(getRideIntervalView(299_999).remainingSec, 1);
  for (let repeat = 1; repeat <= 5; repeat++) {
    const start = 300_000 + (repeat - 1) * 180_000;
    const work = getRideIntervalView(start);
    assert.equal(work.phase, "work"); assert.equal(work.repeat, repeat); assert.equal(work.remainingSec, 60);
    assert.equal(getRideIntervalView(start + 59_999).phase, "work");
    const recovery = getRideIntervalView(start + 60_000);
    assert.equal(recovery.phase, "recovery"); assert.equal(recovery.repeat, repeat); assert.equal(recovery.remainingSec, 120);
    assert.equal(getRideIntervalView(start + 179_999).remainingSec, 1);
  }
  assert.equal(getRideIntervalView(1_200_000).phase, "cooldown");
  assert.equal(getRideIntervalView(1_499_999).remainingSec, 1);
  assert.equal(getRideIntervalView(1_500_000).phase, "complete");
});

test("지연 복귀는 놓친 구간을 누적 재생하지 않고 현재 단계로 바로 맞춘다", () => {
  const work = getRideIntervalView(713_000);
  assert.equal(work.phase, "work"); assert.equal(work.repeat, 3); assert.equal(work.remainingSec, 7);
  const recovery = getRideIntervalView(720_200);
  assert.equal(recovery.phase, "recovery"); assert.equal(recovery.repeat, 3); assert.equal(recovery.remainingSec, 120);
  assert.equal(getRideIntervalView(5_000_000).nextLabel, "자유 주행 계속");
});

test("초는 올림하여 표시하고 잘못된 시간은 준비 단계로 보정한다", () => {
  assert.equal(getRideIntervalView(300_001).remainingSec, 60);
  for (const value of [-1, NaN, Infinity]) assert.equal(getRideIntervalView(value).remainingSec, 300);
});

test("3종 프리셋 총시간과 라운드 경계를 지킨다", () => {
  assert.equal(RIDE_INTERVAL_PRESETS.length, 8);
  assert.deepEqual(DEFAULT, {
    highSec: 60, lowSec: 120, repeats: 5, warmupSec: 300, cooldownSec: 300, rounds: 1, roundRestSec: 0,
  });
  assert.equal(getRideIntervalTotalMs(), 1_500_000);
  assert.equal(matchRideIntervalPreset(DEFAULT), "recovery");

  const balanced = RIDE_INTERVAL_PRESETS.find((item) => item.id === "balanced")!;
  assert.equal(getRideIntervalTotalMs(balanced.config), 1_560_000);
  assert.equal(matchRideIntervalPreset(balanced.config), "balanced");

  const short = RIDE_INTERVAL_PRESETS.find((item) => item.id === "short")!;
  assert.equal(short.config.rounds, 2);
  assert.equal(short.config.roundRestSec, 180);
  assert.equal(getRideIntervalTotalMs(short.config), 1_560_000);
  const restStart = (600 + (20 + 10) * 8) * 1000;
  assert.equal(getRideIntervalView(restStart, short.config).phase, "rest");
  assert.equal(getRideIntervalView(restStart, short.config).round, 1);
  assert.equal(getRideIntervalView(restStart + 180_000, short.config).phase, "work");
  assert.equal(getRideIntervalView(restStart + 180_000, short.config).round, 2);
  const afterLastRecovery = restStart + 180_000 + (20 + 10) * 8 * 1000;
  assert.equal(getRideIntervalView(afterLastRecovery, short.config).phase, "cooldown");
  assert.equal(getRideIntervalView(getRideIntervalTotalMs(short.config), short.config).phase, "complete");

  const three = { ...short.config, rounds: 3 };
  assert.equal(getRideIntervalTotalMs(three), 1_980_000);
  const secondRest = restStart + 180_000 + (20 + 10) * 8 * 1000;
  assert.equal(getRideIntervalView(secondRest, three).phase, "rest");
  assert.equal(getRideIntervalView(secondRest, three).round, 2);
  assert.equal(getRideIntervalView(secondRest + 180_000, three).round, 3);
});

test("시간별 프리셋은 약속한 총시간과 긴 회복 구간을 지킨다", () => {
  for (const [minutes, rounds, rest] of [[10, 1, 0], [15, 2, 60], [20, 2, 120], [25, 3, 90], [30, 3, 150]] as const) {
    const config = RIDE_INTERVAL_PRESETS.find((item) => item.id === `${minutes}min`)!.config;
    assert.equal(getRideIntervalTotalMs(config), minutes * 60_000);
    assert.equal(config.rounds, rounds);
    assert.equal(config.roundRestSec, rest);
    if (rest) {
      const boundary = (config.warmupSec + (config.highSec + config.lowSec) * config.repeats) * 1000;
      assert.equal(getRideIntervalView(boundary, config).phase, "rest");
      assert.equal(getRideIntervalView(boundary + rest * 1000, config).phase, "work");
    }
  }
});

test("반복 1회·30회와 최대 시간 경계를 계산한다", () => {
  const one = { highSec: 30, lowSec: 30, repeats: 1 };
  assert.equal(isRideIntervalConfig(one), true);
  assert.equal(getRideIntervalTotalMs(one), 660_000);
  assert.equal(getRideIntervalView(300_000, one).phase, "work");
  assert.equal(getRideIntervalView(330_000, one).phase, "recovery");
  assert.equal(getRideIntervalView(360_000, one).phase, "cooldown");
  assert.equal(getRideIntervalView(660_000, one).phase, "complete");

  const thirty = { highSec: 5, lowSec: 5, repeats: 30 };
  assert.equal(isRideIntervalConfig(thirty), true);
  assert.equal(getRideIntervalTotalMs(thirty), 900_000);
  const lastWork = 300_000 + 29 * 10_000;
  assert.equal(getRideIntervalView(lastWork, thirty).phase, "work");
  assert.equal(getRideIntervalView(lastWork, thirty).repeat, 30);
  assert.equal(getRideIntervalView(lastWork + 5_000, thirty).phase, "recovery");
  assert.equal(getRideIntervalView(600_000, thirty).phase, "cooldown");
  assert.equal(getRideIntervalView(900_000, thirty).phase, "complete");

  const max = { highSec: 600, lowSec: 600, repeats: 30 };
  assert.equal(isRideIntervalConfig(max), true);
  assert.equal(getRideIntervalTotalMs(max), 36_600_000);
  assert.equal(getRideIntervalView(36_599_999, max).phase, "cooldown");
  assert.equal(getRideIntervalView(36_600_000, max).phase, "complete");
});

test("다음 안내 시간은 설정 값을 반영하고 분은 60초 배수에만 쓴다", () => {
  assert.equal(getRideIntervalView(0).nextLabel, "다음 · 운동 1분");
  assert.equal(getRideIntervalView(300_000).nextLabel, "다음 · 회복 2분");
  assert.equal(getRideIntervalView(1_200_000).nextLabel, "다음 · 자유 주행");
  const minutes = { highSec: 60, lowSec: 60, repeats: 5 };
  assert.equal(getRideIntervalView(0, minutes).nextLabel, "다음 · 운동 1분");
  assert.equal(getRideIntervalView(300_000, minutes).nextLabel, "다음 · 회복 1분");
  const mixed = { highSec: 90, lowSec: 60, repeats: 6 };
  assert.equal(getRideIntervalView(0, mixed).nextLabel, "다음 · 운동 90초");
  assert.equal(getRideIntervalView(300_000, mixed).nextLabel, "다음 · 회복 1분");
  assert.equal(getRideIntervalView(1_200_000, mixed).nextLabel, "다음 · 자유 주행");
  const custom = { highSec: 20, lowSec: 40, repeats: 8 };
  assert.equal(getRideIntervalView(300_000, custom).nextLabel, "다음 · 회복 40초");
  assert.equal(getRideIntervalView(320_000, custom).nextLabel, "다음 · 운동 20초");
});

test("잘못된 config는 거부하고 기본 1:2 루틴으로 복귀한다", () => {
  assert.equal(isRideIntervalConfig({ highSec: 7, lowSec: 11, repeats: 2 }), true);
  for (const value of [
    null,
    undefined,
    "30",
    30,
    [],
    { highSec: 30, lowSec: 30 },
    { highSec: "30", lowSec: 30, repeats: 5 },
    { highSec: 30.5, lowSec: 30, repeats: 5 },
    { highSec: NaN, lowSec: 30, repeats: 5 },
    { highSec: Infinity, lowSec: 30, repeats: 5 },
    { highSec: 4, lowSec: 30, repeats: 5 },
    { highSec: 601, lowSec: 30, repeats: 5 },
    { highSec: 30, lowSec: 30, repeats: 0 },
    { highSec: 30, lowSec: 30, repeats: 31 },
  ]) {
    assert.equal(isRideIntervalConfig(value), false);
    assert.equal(getRideIntervalView(300_000, value as never).phase, "work");
    assert.equal(getRideIntervalView(300_000, value as never).remainingSec, 60);
    assert.equal(getRideIntervalTotalMs(value as never), 1_500_000);
  }
});

test("사용자 설정에서도 지연 복귀는 현재 단계로 바로 맞춘다", () => {
  const config = { highSec: 20, lowSec: 40, repeats: 8 };
  const recovery = getRideIntervalView(330_000, config);
  assert.equal(recovery.phase, "recovery");
  assert.equal(recovery.repeat, 1);
  assert.equal(recovery.remainingSec, 30);
  assert.equal(getRideIntervalView(5_000_000, config).nextLabel, "자유 주행 계속");
});

test("pure core는 브라우저 저장소에 의존하지 않는다", () => {
  const src = readFileSync(new URL("../../src/lib/ride/rideInterval.ts", import.meta.url), "utf8");
  assert.equal(src.includes("localStorage"), false);
  const hook = readFileSync(new URL("../../src/hooks/useRideInterval.ts", import.meta.url), "utf8");
  assert.equal(hook.includes("spinatlas.rideInterval.config.v1"), true);
});

test("준비·마무리 시간은 총합·분 표시·첫·마지막 경계에 반영한다", () => {
  const config = { highSec: 30, lowSec: 30, repeats: 1, warmupSec: 60, cooldownSec: 120 };
  assert.equal(getRideIntervalTotalMs(config), 240_000);
  assert.equal(getRideIntervalView(0, config).phase, "warmup");
  assert.equal(getRideIntervalView(0, config).remainingSec, 60);
  assert.equal(getRideIntervalView(0, config).nextLabel, "다음 · 운동 30초");
  assert.equal(getRideIntervalView(59_999, config).remainingSec, 1);
  assert.equal(getRideIntervalView(60_000, config).phase, "work");
  assert.equal(getRideIntervalView(90_000, config).phase, "recovery");
  assert.equal(getRideIntervalView(90_000, config).nextLabel, "다음 · 마무리 2분");
  assert.equal(getRideIntervalView(120_000, config).phase, "cooldown");
  assert.equal(getRideIntervalView(120_000, config).remainingSec, 120);
  assert.equal(getRideIntervalView(239_999, config).remainingSec, 1);
  assert.equal(getRideIntervalView(240_000, config).phase, "complete");

  const oddCooldown = { highSec: 20, lowSec: 40, repeats: 1, warmupSec: 90, cooldownSec: 90 };
  assert.equal(getRideIntervalTotalMs(oddCooldown), 240_000);
  assert.equal(getRideIntervalView(0, oddCooldown).remainingSec, 90);
  assert.equal(getRideIntervalView(0, oddCooldown).nextLabel, "다음 · 운동 20초");
  assert.equal(getRideIntervalView(110_000, oddCooldown).phase, "recovery");
  assert.equal(getRideIntervalView(110_000, oddCooldown).nextLabel, "다음 · 마무리 90초");
  assert.equal(getRideIntervalView(1_170_000).nextLabel, "다음 · 마무리 5분");
});

test("준비·마무리 0초는 단계에서 제외하고 양쪽 0이면 운동부터 완료한다", () => {
  const noWarmup = { highSec: 30, lowSec: 30, repeats: 1, warmupSec: 0, cooldownSec: 300 };
  assert.equal(isRideIntervalConfig(noWarmup), true);
  assert.equal(getRideIntervalTotalMs(noWarmup), 360_000);
  assert.equal(getRideIntervalView(0, noWarmup).phase, "work");
  assert.equal(getRideIntervalView(0, noWarmup).label, "운동");
  assert.equal(getRideIntervalView(0, noWarmup).nextLabel, "다음 · 회복 30초");
  assert.equal(getRideIntervalView(30_000, noWarmup).phase, "recovery");
  assert.equal(getRideIntervalView(60_000, noWarmup).phase, "cooldown");
  assert.equal(getRideIntervalView(360_000, noWarmup).phase, "complete");

  const noCooldown = { highSec: 30, lowSec: 30, repeats: 1, warmupSec: 300, cooldownSec: 0 };
  assert.equal(isRideIntervalConfig(noCooldown), true);
  assert.equal(getRideIntervalTotalMs(noCooldown), 360_000);
  assert.equal(getRideIntervalView(0, noCooldown).phase, "warmup");
  assert.equal(getRideIntervalView(300_000, noCooldown).phase, "work");
  assert.equal(getRideIntervalView(330_000, noCooldown).phase, "recovery");
  assert.equal(getRideIntervalView(330_000, noCooldown).nextLabel, "다음 · 자유 주행");
  assert.equal(getRideIntervalView(359_999, noCooldown).phase, "recovery");
  assert.equal(getRideIntervalView(360_000, noCooldown).phase, "complete");

  const bothZero = { highSec: 30, lowSec: 30, repeats: 1, warmupSec: 0, cooldownSec: 0 };
  assert.equal(isRideIntervalConfig(bothZero), true);
  assert.equal(getRideIntervalTotalMs(bothZero), 60_000);
  assert.equal(getRideIntervalView(0, bothZero).phase, "work");
  assert.equal(getRideIntervalView(0, bothZero).label, "운동");
  assert.equal(getRideIntervalView(0, bothZero).nextLabel, "다음 · 회복 30초");
  assert.equal(getRideIntervalView(30_000, bothZero).phase, "recovery");
  assert.equal(getRideIntervalView(30_000, bothZero).nextLabel, "다음 · 자유 주행");
  assert.equal(getRideIntervalView(60_000, bothZero).phase, "complete");
});

test("legacy 3필드는 준비·마무리 300초·라운드1로 정규화하고 잘못된 값은 거부한다", () => {
  const legacy = { highSec: 30, lowSec: 30, repeats: 5 };
  assert.equal(isRideIntervalConfig(legacy), true);
  assert.deepEqual(normalizeRideIntervalConfig(legacy), {
    highSec: 30, lowSec: 30, repeats: 5, warmupSec: 300, cooldownSec: 300, rounds: 1, roundRestSec: 0,
  });
  assert.equal(getRideIntervalTotalMs(legacy), 900_000);
  assert.equal(getRideIntervalView(0, legacy).phase, "warmup");
  assert.equal(getRideIntervalView(300_000, legacy).phase, "work");

  const omitted = { highSec: 20, lowSec: 40, repeats: 8, warmupSec: undefined, cooldownSec: undefined };
  assert.equal(isRideIntervalConfig(omitted), true);
  assert.deepEqual(normalizeRideIntervalConfig(omitted), {
    highSec: 20, lowSec: 40, repeats: 8, warmupSec: 300, cooldownSec: 300, rounds: 1, roundRestSec: 0,
  });

  const explicitZero = { highSec: 30, lowSec: 30, repeats: 5, warmupSec: 0, cooldownSec: 1800, rounds: 1, roundRestSec: 0 };
  assert.equal(isRideIntervalConfig(explicitZero), true);
  assert.deepEqual(normalizeRideIntervalConfig(explicitZero), explicitZero);

  for (const value of [
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: null },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: "300" },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: 300.5 },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: NaN },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: Infinity },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: -1 },
    { highSec: 30, lowSec: 30, repeats: 5, warmupSec: 1801 },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: null },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: "300" },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: 1.5 },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: NaN },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: Infinity },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: -1 },
    { highSec: 30, lowSec: 30, repeats: 5, cooldownSec: 1801 },
    { highSec: 30, lowSec: 30, repeats: 5, rounds: 0 },
    { highSec: 30, lowSec: 30, repeats: 5, rounds: 4 },
  ]) {
    assert.equal(isRideIntervalConfig(value), false);
    assert.equal(normalizeRideIntervalConfig(value), null);
    assert.equal(getRideIntervalTotalMs(value as never), 1_500_000);
    assert.equal(getRideIntervalView(300_000, value as never).phase, "work");
  }
});
