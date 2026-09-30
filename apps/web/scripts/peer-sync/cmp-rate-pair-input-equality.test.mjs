/**
 * TASK-24R — 10Hz/5Hz 비교 입력 동등성.
 *
 * 제품 integrator 가 아니라 시나리오 패킷 입력의 정상성:
 * 공통 serverAtMs(200ms 격자)에서 distM·speed 가 수치 오차 이내로 같고,
 * phase 경계·무패킷 갭의 절대시각이 쌍마다 같다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CMP_RATE_PAIRS, SCENARIOS } from "./scenarios.mjs";

const EPS_DIST_M = 1e-9;
const EPS_SPEED = 1e-12;
const COMMON_GRID_MS = 200;

function byName(name) {
  const s = SCENARIOS.find((x) => x.name === name);
  assert.ok(s, `missing scenario ${name}`);
  return s;
}

function packetMap(events) {
  const m = new Map();
  for (const e of events) {
    const t = e.packet.serverAtMs;
    assert.ok(!m.has(t), `duplicate serverAtMs ${t}`);
    m.set(t, e.packet);
  }
  return m;
}

/** 연속 패킷 serverAtMs 간격이 interval 상한을 넘는 무패킷 구간. */
function observedGaps(events, maxIntervalMs) {
  const gaps = [];
  for (let i = 1; i < events.length; i += 1) {
    const prev = events[i - 1].packet.serverAtMs;
    const next = events[i].packet.serverAtMs;
    const dt = next - prev;
    if (dt > maxIntervalMs + 1) gaps.push({ startMs: prev, endMs: next, dt });
  }
  return gaps;
}

describe("cmp 10Hz/5Hz rate-pair input equality (TASK-24R)", () => {
  it("exposes exactly four comparison pairs", () => {
    assert.equal(CMP_RATE_PAIRS.length, 4);
  });

  for (const pair of CMP_RATE_PAIRS) {
    describe(pair.name, () => {
      const ten = byName(pair.ten);
      const five = byName(pair.five);
      const tenMap = packetMap(ten.events);
      const fiveMap = packetMap(five.events);

      it("matches distM and speedMps on common 200ms serverAtMs lattice", () => {
        const common = [...tenMap.keys()]
          .filter((t) => t % COMMON_GRID_MS === 0)
          .sort((a, b) => a - b);
        assert.ok(common.length > 0, "expected common grid samples");

        let compared = 0;
        for (const t of common) {
          const p5 = fiveMap.get(t);
          if (!p5) continue;
          const p10 = tenMap.get(t);
          assert.ok(p10, `10Hz missing packet at ${t}`);
          assert.ok(
            Math.abs(p10.distM - p5.distM) <= EPS_DIST_M,
            `distM mismatch @${t}: 10Hz=${p10.distM} 5Hz=${p5.distM}`,
          );
          assert.ok(
            Math.abs(p10.speedMps - p5.speedMps) <= EPS_SPEED,
            `speed mismatch @${t}: 10Hz=${p10.speedMps} 5Hz=${p5.speedMps}`,
          );
          compared += 1;
        }
        assert.ok(compared >= 10, `too few compared samples: ${compared}`);
      });

      it("aligns gap absolute start/end when a silent window is defined", () => {
        for (const g of pair.gaps) {
          // 갭 내부에는 어느 쪽도 패킷이 없어야 한다.
          for (const [t] of tenMap) {
            assert.ok(t < g.startMs || t >= g.endMs, `10Hz packet inside gap @${t}`);
          }
          for (const [t] of fiveMap) {
            assert.ok(t < g.startMs || t >= g.endMs, `5Hz packet inside gap @${t}`);
          }
          // 재개 첫 패킷은 갭 종료 절대시각에 양쪽 모두 존재.
          assert.ok(tenMap.has(g.endMs), `10Hz missing resume @${g.endMs}`);
          assert.ok(fiveMap.has(g.endMs), `5Hz missing resume @${g.endMs}`);
          assert.ok(
            Math.abs(tenMap.get(g.endMs).distM - fiveMap.get(g.endMs).distM) <= EPS_DIST_M,
            `resume dist mismatch @${g.endMs}`,
          );

          const obs10 = observedGaps(ten.events, 100);
          const obs5 = observedGaps(five.events, 200);
          const hit10 = obs10.find((x) => x.endMs === g.endMs);
          const hit5 = obs5.find((x) => x.endMs === g.endMs);
          assert.ok(hit10, `10Hz observed gap ending ${g.endMs}`);
          assert.ok(hit5, `5Hz observed gap ending ${g.endMs}`);
          // 마지막 송신 시각은 rate 에 따라 다를 수 있으나, 재개 절대시각은 같아야 한다.
          assert.equal(hit10.endMs, g.endMs);
          assert.equal(hit5.endMs, g.endMs);
          assert.equal(hit10.endMs, hit5.endMs);
        }
      });

      it("keeps phase-boundary absolute times on both rate streams", () => {
        for (const bound of pair.phaseBoundsMs) {
          const isTerminal = bound === pair.phaseBoundsMs[pair.phaseBoundsMs.length - 1];
          if (isTerminal) {
            for (const [t] of tenMap) assert.ok(t < bound, `10Hz past terminal ${bound}: ${t}`);
            for (const [t] of fiveMap) assert.ok(t < bound, `5Hz past terminal ${bound}: ${t}`);
            continue;
          }
          const inGapStart = pair.gaps.some((g) => g.startMs === bound);
          if (inGapStart) {
            assert.equal(tenMap.has(bound), false, `10Hz should be silent at gap start ${bound}`);
            assert.equal(fiveMap.has(bound), false, `5Hz should be silent at gap start ${bound}`);
            continue;
          }
          // phase 시작 절대시각 — 격자 정렬과 무관하게 양쪽 표본 필수.
          assert.ok(tenMap.has(bound), `10Hz missing phase start @${bound}`);
          assert.ok(fiveMap.has(bound), `5Hz missing phase start @${bound}`);
          assert.equal(tenMap.get(bound).speedMps, fiveMap.get(bound).speedMps);
          assert.ok(
            Math.abs(tenMap.get(bound).distM - fiveMap.get(bound).distM) <= EPS_DIST_M,
            `phase-start dist mismatch @${bound}`,
          );
        }
      });
    });
  }

  it("does not alter candidate-5hz-jitter-gap regression lock identity", () => {
    const cand = byName("candidate-5hz-jitter-gap");
    assert.equal(cand.events.length, 98);
    assert.equal(cand.events[0].packet.serverAtMs, 10_000);
    const last = cand.events[cand.events.length - 1].packet;
    // TASK-04 잠금: 마지막 발행 시각·거리 스냅샷(변경 금지 신호).
    assert.equal(last.serverAtMs, 31_200);
    assert.ok(Math.abs(last.distM - 256.8) < 1e-6);
  });
});
