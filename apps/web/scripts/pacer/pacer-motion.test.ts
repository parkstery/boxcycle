import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PACER_DT_MAX_SEC,
  PACER_MAX_ACCEL_MPS2,
  PACER_MAX_GAP_M,
  PACER_MAX_REL_V_MPS,
  PACER_SOFT_GAP_M,
  PACER_ENTRY_DELAY_SEC,
  createPacerWorld,
  enteredPacers,
  pacerSpeedMps,
  resolvePacerDistM,
  stepPacerWorld,
  type PacerState,
  type PacerWorld,
} from "../../src/lib/ride/pacer/pacerMotion.ts";

const DT = 1 / 60;

function clonePacers(pacers: PacerState[]): PacerState[] {
  return pacers.map((p) => ({ ...p }));
}

function signOf(n: number): number {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

type RunStats = {
  overtakes: number[];
  maxAbsGap: number;
  maxAccel: number;
  minSpeed: number;
};

function runProfile(
  world: PacerWorld,
  seconds: number,
  speedAt: (t: number) => number,
  status: "running" | "paused" = "running",
): RunStats {
  const steps = Math.round(seconds / DT);
  const overtakes = world.pacers.map(() => 0);
  const prevSign = world.pacers.map((p) => signOf(p.gapM));
  let maxAbsGap = 0;
  let maxAccel = 0;
  let minSpeed = Infinity;
  for (let i = 0; i < steps; i += 1) {
    const before = world.pacers.map((p) => p.relVMps);
    const self = speedAt(i * DT);
    stepPacerWorld(world, { dtSec: DT, selfSpeedMps: self, status });
    for (let k = 0; k < world.pacers.length; k += 1) {
      const p = world.pacers[k]!;
      const gap = p.gapM;
      maxAbsGap = Math.max(maxAbsGap, Math.abs(gap));
      const dRel = p.relVMps - before[k]!;
      const accel = Math.abs(dRel) / DT;
      maxAccel = Math.max(maxAccel, accel);
      const spd = pacerSpeedMps(self, p);
      minSpeed = Math.min(minSpeed, spd);
      const s = signOf(gap);
      if (s !== 0 && prevSign[k] !== 0 && s !== prevSign[k]) overtakes[k]! += 1;
      if (s !== 0) prevSign[k] = s;
    }
  }
  return { overtakes, maxAbsGap, maxAccel, minSpeed };
}

function assertEnvelope(label: string, stats: RunStats, minCross: number): void {
  console.log(
    `${label} overtakes=${stats.overtakes.join(",")} maxAbsGap=${stats.maxAbsGap.toFixed(3)} maxAccel=${stats.maxAccel.toFixed(4)} minSpeed=${stats.minSpeed.toFixed(4)}`,
  );
  // 자연 주행에서는 안전 클램프(20)에 닿지 않아야 한다 — 닿으면 상대속도가 순간 0 으로 끊긴다.
  assert.ok(stats.maxAbsGap <= PACER_SOFT_GAP_M + 0.5, `${label} |gap| ${stats.maxAbsGap}`);
  for (const n of stats.overtakes) {
    assert.ok(n >= minCross, `${label} overtakes ${n} < ${minCross}`);
  }
  assert.ok(stats.maxAccel <= PACER_MAX_ACCEL_MPS2 + 1e-3, `${label} accel ${stats.maxAccel}`);
}

describe("pacer motion", () => {
  it("U1 30 km/h 10분, seed 5 — 간격·추월·가속", () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const world = createPacerWorld(seed);
      const stats = runProfile(world, 600, () => 8.3);
      assertEnvelope(`U1 seed=${seed}`, stats, 6);
    }
  });

  it("U2 4~11 m/s 사인 10분 — 속도는 0 이상", () => {
    for (const seed of [11, 22, 33, 44, 55]) {
      const world = createPacerWorld(seed);
      const stats = runProfile(world, 600, (t) => 7.5 + 3.5 * Math.sin(t / 40));
      assertEnvelope(`U2 seed=${seed}`, stats, 6);
      assert.ok(stats.minSpeed >= -1e-9, `U2 speed ${stats.minSpeed}`);
    }
  });

  it("U3 30초 주행 후 60초 정지 — 함께 서고 간격이 거의 안 변함", () => {
    const world = createPacerWorld(7);
    runProfile(world, 30, () => 8.3);
    const gapAtStop = world.pacers.map((p) => p.gapM);
    const settledAt: number[] = world.pacers.map(() => Infinity);
    const steps = Math.round(60 / DT);
    let maxDrift = 0;
    for (let i = 0; i < steps; i += 1) {
      stepPacerWorld(world, { dtSec: DT, selfSpeedMps: 0, status: "running" });
      for (let k = 0; k < world.pacers.length; k += 1) {
        const spd = pacerSpeedMps(0, world.pacers[k]!);
        if (spd < 0.1 && settledAt[k] === Infinity) settledAt[k] = i * DT;
        maxDrift = Math.max(maxDrift, Math.abs(world.pacers[k]!.gapM - gapAtStop[k]!));
      }
    }
    console.log(`U3 settleSec=${settledAt.map((s) => s.toFixed(2)).join(",")} maxDrift=${maxDrift.toFixed(4)}`);
    for (const s of settledAt) assert.ok(s <= 20, `settle ${s}`);
    assert.ok(maxDrift < 1, `drift ${maxDrift}`);
  });

  it("U4 paused 30초 — 상태와 이후 궤적이 불변", () => {
    const a = createPacerWorld(9);
    const b = createPacerWorld(9);
    runProfile(a, 10, () => 8.3);
    runProfile(b, 10, () => 8.3);
    const snap = clonePacers(a.pacers);
    runProfile(a, 30, () => 8.3, "paused");
    assert.deepEqual(a.pacers, snap);
    runProfile(a, 5, () => 6);
    runProfile(b, 5, () => 6);
    assert.deepEqual(a.pacers, b.pacers);
  });

  it("U5 dt 5초 한 번 — 간격 변화가 dt 클램프 안", () => {
    const world = createPacerWorld(3);
    runProfile(world, 20, () => 8.3);
    const before = world.pacers.map((p) => p.gapM);
    stepPacerWorld(world, { dtSec: 5, selfSpeedMps: 8.3, status: "running" });
    for (let k = 0; k < world.pacers.length; k += 1) {
      const d = Math.abs(world.pacers[k]!.gapM - before[k]!);
      console.log(`U5 pacer=${world.pacers[k]!.id} dGap=${d.toFixed(4)}`);
      assert.ok(d <= PACER_MAX_REL_V_MPS * PACER_DT_MAX_SEC + 1e-6, `dGap ${d}`);
    }
  });

  it("U6 같은 seed 는 같고 다른 seed 는 다름", () => {
    const a = createPacerWorld(42);
    const b = createPacerWorld(42);
    const c = createPacerWorld(43);
    runProfile(a, 120, () => 8.3);
    runProfile(b, 120, () => 8.3);
    runProfile(c, 120, () => 8.3);
    assert.deepEqual(a.pacers, b.pacers);
    assert.notDeepEqual(
      a.pacers.map((p) => p.gapM),
      c.pacers.map((p) => p.gapM),
    );
  });

  it("U8 경계 직전 상태를 직접 넣어도 ±20 을 넘지 않는다", () => {
    for (const sign of [1, -1]) {
      const world = createPacerWorld(1);
      const p = world.pacers[0]!;
      p.gapM = sign * 19.8;
      p.relVMps = sign * 1.5;
      p.targetGapM = sign * PACER_SOFT_GAP_M;
      p.retargetInSec = 999;
      let maxAbs = 0;
      for (let i = 0; i < Math.round(10 / DT); i += 1) {
        stepPacerWorld(world, { dtSec: DT, selfSpeedMps: 8.3, status: "running" });
        maxAbs = Math.max(maxAbs, Math.abs(p.gapM));
      }
      console.log(`U8 sign=${sign} maxAbsGap=${maxAbs.toFixed(3)}`);
      assert.ok(maxAbs <= PACER_MAX_GAP_M + 1e-6, `U8 |gap| ${maxAbs}`);
    }
  });

  it("U9 차례 등장 — 5초 뒤 한 명, 10초 뒤 한 명, 일시정지는 세지 않는다", () => {
    const world = createPacerWorld(5, { staggerEntry: true });
    const ids = () => enteredPacers(world).map((p) => p.id);
    const run = (sec: number, status: "running" | "paused" = "running") => {
      for (let i = 0; i < Math.round(sec / DT); i += 1) {
        stepPacerWorld(world, { dtSec: DT, selfSpeedMps: 8.3, status });
      }
    };
    assert.deepEqual(ids(), []);
    run(4.9);
    assert.deepEqual(ids(), []);
    run(30, "paused");
    assert.deepEqual(ids(), [], "일시정지 중에는 등장하지 않는다");
    run(0.2);
    assert.deepEqual(ids(), ["pacer-a"]);
    assert.equal(PACER_ENTRY_DELAY_SEC["pacer-a"], 5);
    run(4.8);
    assert.deepEqual(ids(), ["pacer-a"]);
    run(0.2);
    assert.deepEqual(ids(), ["pacer-a", "pacer-b"]);
    // 등장 직후는 뒤쪽에서 시작해 ±20 을 넘지 않는다
    const b = world.pacers.find((p) => p.id === "pacer-b")!;
    assert.ok(b.gapM < 0, `pacer-b 등장 gap ${b.gapM}`);
    run(60);
    for (const p of world.pacers) assert.ok(Math.abs(p.gapM) <= PACER_MAX_GAP_M + 1e-6);
  });

  it("U7 resolvePacerDistM 은 경로 안에 둔다", () => {
    assert.equal(resolvePacerDistM(10, -30, 100), 0);
    assert.equal(resolvePacerDistM(90, 30, 100), 100);
    assert.equal(resolvePacerDistM(40, 5, 100), 45);
    assert.equal(resolvePacerDistM(0, -1, 0), 0);
    assert.ok(resolvePacerDistM(-5, -5, 50) >= 0);
    assert.ok(resolvePacerDistM(1000, 20, 80) <= 80);
  });
});
