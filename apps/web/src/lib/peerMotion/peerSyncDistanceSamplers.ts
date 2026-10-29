/**
 * S3-DIAG — useVirtualRideSession 의 rAF sampler 를 publish fanout 에서 읽기 위한 브리지.
 * App / useLiveLocationPublishSession 을 경유하지 않음.
 */

let sampleVirtualDistanceM: (() => number) | null = null;
let sampleAppliedSpeedKmh: (() => number) | null = null;
let sampleTargetSpeedKmh: (() => number) | null = null;
type MotionCaptureSample = { distM: number; speedKmh: number; capturedAtLocalMs: number };
let sampleMotionSnapshot: (() => MotionCaptureSample) | null = null;

export function registerPeerSyncDistanceSamplers(opts: {
  sampleVirtualDistanceM: (() => number) | null;
  sampleAppliedSpeedKmh: (() => number) | null;
  sampleTargetSpeedKmh?: (() => number) | null;
  /** 거리·속도와 그 적분 시각을 한 번에 읽는다. 송신 시각으로 재태깅하지 않는다. */
  sampleMotionSnapshot?: (() => MotionCaptureSample) | null;
  sampleRouteLens?: (() => { routeLen: number; geoLen: number }) | null;
}): void {
  sampleVirtualDistanceM = opts.sampleVirtualDistanceM;
  sampleAppliedSpeedKmh = opts.sampleAppliedSpeedKmh;
  sampleTargetSpeedKmh = opts.sampleTargetSpeedKmh ?? null;
  sampleMotionSnapshot = opts.sampleMotionSnapshot ?? null;
}

export function peekMotionCaptureSample(): MotionCaptureSample | null {
  return sampleMotionSnapshot?.() ?? null;
}

export function peekSampleVirtualDistanceM(): number {
  return sampleVirtualDistanceM?.() ?? Number.NaN;
}

export function peekSampleAppliedSpeedKmh(): number {
  return sampleAppliedSpeedKmh?.() ?? Number.NaN;
}

export function peekSampleTargetSpeedKmh(): number {
  return sampleTargetSpeedKmh?.() ?? Number.NaN;
}
