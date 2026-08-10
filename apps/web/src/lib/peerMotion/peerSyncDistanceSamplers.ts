/**
 * S3-DIAG — useVirtualRideSession 의 rAF sampler 를 publish fanout 에서 읽기 위한 브리지.
 * App / useLiveLocationPublishSession 을 경유하지 않음.
 */

let sampleVirtualDistanceM: (() => number) | null = null;
let sampleAppliedSpeedKmh: (() => number) | null = null;
let sampleTargetSpeedKmh: (() => number) | null = null;
let sampleRouteLens: (() => { routeLen: number; geoLen: number }) | null = null;

export function registerPeerSyncDistanceSamplers(opts: {
  sampleVirtualDistanceM: (() => number) | null;
  sampleAppliedSpeedKmh: (() => number) | null;
  sampleTargetSpeedKmh?: (() => number) | null;
  sampleRouteLens?: (() => { routeLen: number; geoLen: number }) | null;
}): void {
  sampleVirtualDistanceM = opts.sampleVirtualDistanceM;
  sampleAppliedSpeedKmh = opts.sampleAppliedSpeedKmh;
  sampleTargetSpeedKmh = opts.sampleTargetSpeedKmh ?? null;
  sampleRouteLens = opts.sampleRouteLens ?? null;
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

export function peekSampleRouteLens(): { routeLen: number; geoLen: number } {
  return sampleRouteLens?.() ?? { routeLen: Number.NaN, geoLen: Number.NaN };
}
