/**
 * 동행 보간 지터 계측기 — 제품 코드(`integrator.ts`)를 그대로 돌린다.
 *
 * 무엇을 재는가: 송신자가 **완전히 일정한 속도**로 달릴 때, 수신 화면의 속도가
 * 얼마나 흔들리는가. 송신이 일정하므로 흔들림은 전부 보간 탓이다.
 */
import {
  applyPeerMotionIngest,
  createPeerMotionEntity,
  stepPeerMotionEntity,
} from "../../src/lib/peerMotion/integrator.ts";
import { peerRenderDelayMs } from "../../src/lib/peerMotion/integrator.ts";
import type { PeerMotionPacket } from "../../src/lib/peerMotion/types.ts";

const SPEED_MPS = 5.0;          // 18 km/h 등속
const ROUTE_LEN = 5_000;
const FRAME_MS = 1000 / 60;
const RUN_MS = 30_000;

/**
 * 송신자는 **정확한 격자 시각**에 좌표를 잡는다(distM 은 그 시각의 참값).
 * 망 지연은 도착 시각에만 붙는다 — 이것이 실제 지터의 모양이다.
 * 앞선 판에서는 지터를 거리에도 함께 넣어 지터가 스스로 상쇄됐다.
 */
function run(intervalMs: number, jitterMs: number, trace = false) {
  let now = 0;
  const RTT = 140;
  const packets: Array<{ capturedAt: number; arriveAt: number }> = [];
  for (let t = intervalMs; t < RUN_MS; t += intervalMs) {
    packets.push({ capturedAt: t, arriveAt: t + RTT + Math.random() * jitterMs });
  }
  packets.sort((a, b) => a.arriveAt - b.arriveAt);

  const mk = (capturedAt: number): PeerMotionPacket => ({
    uid: "peer", publicationId: "p", distM: SPEED_MPS * (capturedAt / 1000),
    speedMps: SPEED_MPS, phase: "live", serverAtMs: capturedAt, seq: Math.round(capturedAt),
  }) as PeerMotionPacket;

  const realNow = Date.now;
  (Date as unknown as { now: () => number }).now = () => now;

  const entity = createPeerMotionEntity(mk(0), "peer");
  let pi = 0;
  let prevDisp = entity.displayDistM;
  let prevT = 0;
  const vels: number[] = [];
  let extrapFrames = 0, totalFrames = 0;
  let worst = { v: 0, now: 0, from: 0, to: 0 };

  for (now = FRAME_MS; now < RUN_MS; now += FRAME_MS) {
    while (pi < packets.length && packets[pi]!.arriveAt <= now) {
      applyPeerMotionIngest(entity, mk(packets[pi]!.capturedAt), "peer");
      pi += 1;
    }
    const buf = entity.buffer;
    if (now - peerRenderDelayMs(entity) >= buf[buf.length - 1]!.recvAtMs) extrapFrames += 1;
    totalFrames += 1;

    stepPeerMotionEntity(entity, FRAME_MS / 1000, ROUTE_LEN, now);
    if (now > 5_000) {
      const v = (entity.displayDistM - prevDisp) / ((now - prevT) / 1000);
      vels.push(v);
      if (Math.abs(v - SPEED_MPS) > Math.abs(worst.v - SPEED_MPS)) {
        worst = {
          v, now, from: prevDisp, to: entity.displayDistM,
          참값: SPEED_MPS * ((now - peerRenderDelayMs(entity)) / 1000),
          지연: Math.round(peerRenderDelayMs(entity)),
          오프셋: entity.clockOffsetMs,
          버퍼: entity.buffer.slice(-4).map((b) => ({
            d: +b.distM.toFixed(2), src: b.srcAtMs, recv: Math.round(b.recvAtMs),
          })),
        } as never;
      }
    }
    prevDisp = entity.displayDistM;
    prevT = now;
  }
  (Date as unknown as { now: () => number }).now = realNow;

  if (trace) console.log("  최악 프레임:", JSON.stringify(worst));

  vels.sort((a, b) => a - b);
  const jumps = vels.filter((v) => Math.abs(v - SPEED_MPS) > SPEED_MPS * 0.5).length;
  return {
    "도착간격": `${intervalMs}ms`,
    "지연(제품 선택)": `${Math.round(peerRenderDelayMs(entity))}ms`,
    "화면속도 최소": vels[0]!.toFixed(2),
    "화면속도 최대": vels[vels.length - 1]!.toFixed(2),
    "튀는 프레임%": ((jumps / vels.length) * 100).toFixed(1),
    "외삽 프레임%": ((extrapFrames / totalFrames) * 100).toFixed(1),
  };
}

const rows = [
  run(200, 60, true),    // 실측: RTT 137 + queue 70 — 지금의 10Hz 발행
  run(1000, 200),  // chief 가 좁힌 1초
  run(3000, 300),  // 비용을 아끼려던 넓은 간격
  run(5000, 400),  // 더 넓히면?
];
console.log("등속 5.00 m/s 송신 — 화면 속도가 얼마나 흔들리는가");
console.table(rows);
