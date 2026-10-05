/**
 * 자기 표시용 motion 표본 버퍼.
 *
 * 송신과 **같은** (tSrv, dist, speed) 스냅샷만 넣는다.
 * wire 양자(0.01m / 0.01mps)를 적용해 peer decode 와 동일 canonical 표본을 쓴다.
 * 고주파 local history 와 섞어 peer 와 「일치」라고 주장하지 않는다.
 */
import { PEER_INTERP_BUFFER_MAX, PEER_INTERP_MAX_EXTRAP_MS } from "./peerSyncPolicy";
import {
  quantizeMotionWireDistM,
  quantizeMotionWireSpeedMps,
} from "./motionWireQuantize";

export type SelfDisplaySample = {
  /** 캡처 순간 추정 서버시각(ms) */
  tSrv: number;
  distM: number;
  speedMps: number;
};

const buffer: SelfDisplaySample[] = [];

export function resetSelfDisplayBuffer(): void {
  buffer.length = 0;
}

export function pushSelfDisplaySample(sample: SelfDisplaySample): void {
  if (!(sample.tSrv > 0) || !Number.isFinite(sample.distM) || !Number.isFinite(sample.speedMps)) {
    return;
  }
  const distM = quantizeMotionWireDistM(sample.distM);
  const speedMps = quantizeMotionWireSpeedMps(sample.speedMps);
  const newest = buffer[buffer.length - 1];
  if (newest && sample.tSrv < newest.tSrv) {
    // out-of-order — 무시(송신 큐가 순서를 지키지만 방어).
    return;
  }
  if (newest && sample.tSrv === newest.tSrv && Math.abs(newest.distM - distM) < 1e-9) {
    return;
  }
  buffer.push({
    tSrv: sample.tSrv,
    distM,
    speedMps,
  });
  while (buffer.length > PEER_INTERP_BUFFER_MAX) buffer.shift();
}

export function selfDisplaySampleCount(): number {
  return buffer.length;
}

/**
 * renderTime(서버축)에서 거리 보간. peer integrator 와 같은 구간 규칙.
 * 표본 없으면 null — 호출부는 즉시 거리로 폴백.
 */
export function sampleSelfDisplayDistM(renderTimeMs: number): number | null {
  if (buffer.length === 0 || !Number.isFinite(renderTimeMs)) return null;
  const newest = buffer[buffer.length - 1]!;
  const oldest = buffer[0]!;

  if (renderTimeMs <= oldest.tSrv) return oldest.distM;
  if (renderTimeMs >= newest.tSrv) {
    const aheadMs = Math.min(renderTimeMs - newest.tSrv, PEER_INTERP_MAX_EXTRAP_MS);
    return newest.distM + newest.speedMps * (aheadMs / 1000);
  }

  let s0 = oldest;
  let s1 = newest;
  for (let i = 1; i < buffer.length; i += 1) {
    if (buffer[i]!.tSrv >= renderTimeMs) {
      s1 = buffer[i]!;
      s0 = buffer[i - 1]!;
      break;
    }
  }
  const span = s1.tSrv - s0.tSrv;
  const t = span > 0 ? (renderTimeMs - s0.tSrv) / span : 0;
  return s0.distM + (s1.distM - s0.distM) * t;
}

export function peekSelfDisplayNewest(): SelfDisplaySample | null {
  return buffer.length ? buffer[buffer.length - 1]! : null;
}
