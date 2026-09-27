import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPeerMotionIngest,
  createPeerMotionEntity,
  peerRenderDelayMs,
  peerRenderTimeMs,
  stepPeerMotionEntity,
} from "../../src/lib/peerMotion/integrator.ts";
import {
  PEER_INTERP_DELAY_GAP_FACTOR,
  PEER_INTERP_DELAY_MAX_MS,
  PEER_INTERP_DELAY_MS,
} from "../../src/lib/peerMotion/peerSyncPolicy.ts";
import type { PeerMotionPacket } from "../../src/lib/peerMotion/types.ts";

/**
 * 동행 보간의 **부드러움** 계약 (2026-09-27).
 *
 * 무엇을 막는가 — 송신자가 등속으로 달려도 화면 속도가 출렁이는 세 가지 결함.
 * 셋 다 오류를 내지 않고, 화면에서만 「툭툭 튀는」 것으로 보인다.
 *
 *   ① 보간 지연이 도착 간격보다 짧다 → 보간이 아니라 **외삽 후 스냅**으로 동작
 *   ② 시간축이 도착 시각이다        → 망 지터가 그대로 **속도 지터**
 *   ③ 재생 시점을 매 프레임 다시 계산 → 지연이 바뀔 때마다 **순간이동**
 *
 * 계측(제품 코드 그대로, 등속 5.00 m/s 송신):
 *
 *            고치기 전                고친 뒤
 *   200ms   -0.40 ~  6.67 m/s      4.35 ~  8.12 m/s
 *   1000ms  -42.6 ~ 49.22 m/s      3.95 ~ 10.00 m/s
 *
 * 음수는 동행이 **뒤로 가는** 것이다.
 */

const SPEED = 5.0;
const ROUTE_LEN = 5_000;
const FRAME_MS = 1000 / 60;

const packet = (capturedAt: number, over?: Partial<PeerMotionPacket>): PeerMotionPacket =>
  ({
    uid: "peer",
    publicationId: "p",
    distM: SPEED * (capturedAt / 1000),
    speedMps: SPEED,
    phase: "live",
    serverAtMs: capturedAt,
    seq: Math.round(capturedAt),
    ...over,
  }) as PeerMotionPacket;

/**
 * 등속 송신 + 망 지터를 재생하고 **화면 속도의 폭**을 돌려준다.
 *
 * `Date.now()` 를 가상 시계로 갈아끼운다 — 제품 코드가 그것을 읽기 때문이다.
 */
function replay(opts: {
  intervalMs: number;
  jitterMs: number;
  runMs: number;
  /** k 번째 패킷의 추가 지연(ms). 기본은 결정적 의사난수. */
  delayAt?: (k: number, jitterMs: number) => number;
}) {
  const { intervalMs, jitterMs, runMs } = opts;
  const RTT = 140;
  let now = 0;

  // 결정적으로 흔든다 — 시험이 돌 때마다 결과가 달라지면 계약이 아니다.
  const delayAt = opts.delayAt ?? ((k: number, j: number) => ((Math.sin(k * 7.13) + 1) / 2) * j);

  const arrivals: Array<{ capturedAt: number; arriveAt: number }> = [];
  let k = 0;
  for (let t = intervalMs; t < runMs; t += intervalMs) {
    arrivals.push({ capturedAt: t, arriveAt: t + RTT + delayAt(k, jitterMs) });
    k += 1;
  }
  arrivals.sort((a, b) => a.arriveAt - b.arriveAt);

  const realNow = Date.now;
  (Date as unknown as { now: () => number }).now = () => now;
  try {
    const entity = createPeerMotionEntity(packet(1), "peer");
    let i = 0;
    let prev = entity.displayDistM;
    let prevT = 0;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;

    for (now = FRAME_MS; now < runMs; now += FRAME_MS) {
      while (i < arrivals.length && arrivals[i]!.arriveAt <= now) {
        applyPeerMotionIngest(entity, packet(arrivals[i]!.capturedAt), "peer");
        i += 1;
      }
      stepPeerMotionEntity(entity, FRAME_MS / 1000, ROUTE_LEN, now);
      if (now > runMs / 3) {
        const v = (entity.displayDistM - prev) / ((now - prevT) / 1000);
        if (v < min) min = v;
        if (v > max) max = v;
      }
      prev = entity.displayDistM;
      prevT = now;
    }
    return { min, max, entity };
  } finally {
    (Date as unknown as { now: () => number }).now = realNow;
  }
}

describe("M0 — 계측기 자가 검산", () => {
  it("재생기가 실제로 움직인다 — 안 움직이면 모든 판정이 공짜로 통과한다", () => {
    const { min, max, entity } = replay({ intervalMs: 200, jitterMs: 60, runMs: 20_000 });
    assert.ok(entity.displayDistM > 50, `거의 안 움직였다: ${entity.displayDistM}`);
    assert.ok(Number.isFinite(min) && Number.isFinite(max), "속도를 한 번도 못 쟀다");
    assert.ok(max > 0, "최대 속도가 0 이면 아래 판정이 전부 무의미하다");
  });
});

describe("① 보간 지연은 도착 간격을 따라간다", () => {
  it("아직 간격을 모르면 하한을 쓴다", () => {
    const e = createPeerMotionEntity(packet(1), "peer");
    assert.equal(peerRenderDelayMs(e), PEER_INTERP_DELAY_MS);
  });

  it("도착 간격이 넓어지면 지연도 넓어진다 — 안 그러면 보간이 성립하지 않는다", () => {
    const fast = replay({ intervalMs: 200, jitterMs: 60, runMs: 20_000 }).entity;
    const slow = replay({ intervalMs: 1000, jitterMs: 200, runMs: 30_000 }).entity;
    assert.ok(
      peerRenderDelayMs(slow) > peerRenderDelayMs(fast) * 2,
      `간격이 5배인데 지연이 따라가지 않았다: ${peerRenderDelayMs(fast)} → ${peerRenderDelayMs(slow)}`,
    );
    assert.ok(
      peerRenderDelayMs(slow) >= slow.arrivalGapMsEma * PEER_INTERP_DELAY_GAP_FACTOR * 0.9,
      "지연이 도착 간격의 배수에 못 미치면 매 프레임 외삽으로 빠진다",
    );
    assert.ok(peerRenderDelayMs(slow) <= PEER_INTERP_DELAY_MAX_MS, "상한을 넘으면 너무 뒤처져 보인다");
  });
});

describe("② 시간축은 송신 시각이다 — 도착 시각이 아니다", () => {
  it("몰려 온 두 패킷을 순간이동으로 그리지 않는다", () => {
    /*
     * 무작위 지터에 기대면 안 된다 — 실제로 이 결함을 두 번 놓쳤다. **최악을 만들어** 겨눈다.
     *
     * 한 패킷은 크게 늦고 다음 패킷은 제때 온다. 1초 간격·지연 900ms 면 둘이 **100ms 차**로
     * 도착한다. 도착 시각을 시간축으로 쓰면 그 사이 5m 를 100ms 에 간 것으로 그린다(50 m/s).
     * 송신 시각을 쓰면 두 점의 간격은 송신자가 실제로 달린 1초 그대로다.
     */
    const { min, max } = replay({
      intervalMs: 1000,
      jitterMs: 900,
      runMs: 40_000,
      delayAt: (k, j) => (k % 2 === 0 ? j : 0),
    });
    assert.ok(max < SPEED * 2, `몰려 온 패킷이 속도를 ${max.toFixed(1)} m/s 로 튀게 했다`);
    assert.ok(min > 0, `동행이 뒤로 갔다: ${min.toFixed(2)} m/s`);
  });

  it("송신 시각을 읽을 수 없으면 도착 시각으로 내려간다 — 멈추지는 않는다", () => {
    const realNow = Date.now;
    let now = 0;
    (Date as unknown as { now: () => number }).now = () => now;
    try {
      const e = createPeerMotionEntity(packet(1, { serverAtMs: 0 }), "peer");
      assert.equal(e.clockOffsetMs, null, "읽을 수 없는 송신 시각을 오프셋으로 삼으면 안 된다");
      for (now = 200; now <= 4_000; now += 200) {
        applyPeerMotionIngest(e, packet(now, { serverAtMs: 0 }), "peer");
        stepPeerMotionEntity(e, 0.2, ROUTE_LEN, now);
      }
      assert.ok(e.displayDistM > 5, "폴백 경로에서 동행이 멈춰 버렸다");
    } finally {
      (Date as unknown as { now: () => number }).now = realNow;
    }
  });
});

describe("③ 재생 시점은 매 프레임 다시 계산하지 않는다", () => {
  it("지연 목표가 바뀌어도 화면은 순간이동하지 않는다", () => {
    /*
     * 이것이 ①을 넣자마자 생겼던 결함이다. 지연이 조금 바뀌면 `지금 − 지연` 이 통째로
     * 옮겨가 그만큼 건너뛴다. 재생 시계를 따로 굴려야 한다.
     */
    const realNow = Date.now;
    let now = 0;
    (Date as unknown as { now: () => number }).now = () => now;
    try {
      const e = createPeerMotionEntity(packet(1), "peer");
      for (now = 200; now <= 3_000; now += 200) {
        applyPeerMotionIngest(e, packet(now), "peer");
        stepPeerMotionEntity(e, 0.2, ROUTE_LEN, now);
      }
      const before = peerRenderTimeMs(e, now);
      const delayBefore = peerRenderDelayMs(e);

      // 도착 간격이 갑자기 10배로 벌어진다 — 지연 목표가 크게 뛴다.
      now += 2_000;
      applyPeerMotionIngest(e, packet(now), "peer");
      stepPeerMotionEntity(e, 0.016, ROUTE_LEN, now);

      assert.ok(peerRenderDelayMs(e) > delayBefore * 1.5, "지연 목표가 실제로 바뀌어야 시험이 의미 있다");
      const moved = peerRenderTimeMs(e, now) - before;
      assert.ok(
        moved >= 0 && moved <= 2_000 * 1.2,
        `재생 시점이 실제 시간보다 크게 벗어났다: ${moved}ms`,
      );
    } finally {
      (Date as unknown as { now: () => number }).now = realNow;
    }
  });

  it("재생 시계는 뒤로 가지 않는다", () => {
    const realNow = Date.now;
    let now = 0;
    (Date as unknown as { now: () => number }).now = () => now;
    try {
      const e = createPeerMotionEntity(packet(1), "peer");
      let prev = -Infinity;
      for (now = 100; now <= 20_000; now += 100) {
        if (now % 700 < 100) applyPeerMotionIngest(e, packet(now), "peer");
        stepPeerMotionEntity(e, 0.1, ROUTE_LEN, now);
        const t = peerRenderTimeMs(e, now);
        assert.ok(t >= prev, `재생 시점이 뒤로 갔다: ${prev} → ${t}`);
        prev = t;
      }
    } finally {
      (Date as unknown as { now: () => number }).now = realNow;
    }
  });
});

describe("등속 송신은 등속으로 보여야 한다", () => {
  for (const c of [
    { name: "지금의 10Hz 발행(도착 약 200ms)", intervalMs: 200, jitterMs: 60, runMs: 25_000 },
    { name: "1초 간격", intervalMs: 1000, jitterMs: 200, runMs: 40_000 },
  ]) {
    it(`${c.name} — 화면 속도가 뒤로 가거나 2배를 넘지 않는다`, () => {
      const { min, max } = replay(c);
      assert.ok(min > 0, `동행이 뒤로 갔다: ${min.toFixed(2)} m/s`);
      assert.ok(max < SPEED * 2.5, `화면 속도가 ${max.toFixed(2)} m/s 까지 튀었다`);
    });
  }
});
