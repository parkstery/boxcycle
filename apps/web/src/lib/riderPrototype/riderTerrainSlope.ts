import { Matrix4 } from "three";

type LngLat = readonly [number, number];
type ElevationAt = (lngLat: { lng: number; lat: number }) => number | null | undefined;
type SlopeState = { sampleMs: number; frameMs: number; target: number; value: number };

// PreservedRiderRig의 허브 좌표. 모델 +X가 전방, +Y가 위이며 두 후보가 공유한다.
const FRONT_M = 0.583;
const REAR_M = -0.412;
const EARTH_RADIUS_M = 6371008.8;
const SAMPLE_MS = 100;
const FOLLOW_MS = 150;

function offsetAlongBearing([lng, lat]: LngLat, bearingDeg: number, distanceM: number) {
  const rad = Math.PI / 180;
  const heading = bearingDeg * rad;
  const latitude = lat * rad;
  const arc = distanceM / EARTH_RADIUS_M;
  const nextLat = Math.asin(
    Math.sin(latitude) * Math.cos(arc) + Math.cos(latitude) * Math.sin(arc) * Math.cos(heading),
  );
  const nextLng = lng * rad + Math.atan2(
    Math.sin(heading) * Math.sin(arc) * Math.cos(latitude),
    Math.cos(arc) - Math.sin(latitude) * Math.sin(nextLat),
  );
  return { lng: ((nextLng / rad + 540) % 360) - 180, lat: nextLat / rad };
}

/** 표시 지형의 앞뒤 고도 차이. 중심점 고도/미로딩0m 정책은 기존 렌더러가 담당한다. */
function samplePitch(lngLat: LngLat, bearingDeg: number, elevationAt: ElevationAt): number {
  try {
    const front = elevationAt(offsetAlongBearing(lngLat, bearingDeg, FRONT_M));
    const rear = elevationAt(offsetAlongBearing(lngLat, bearingDeg, REAR_M));
    if (typeof front !== "number" || !Number.isFinite(front)
      || typeof rear !== "number" || !Number.isFinite(rear)) return 0;
    return Math.atan2(front - rear, FRONT_M - REAR_M);
  } catch {
    return 0;
  }
}

/** 지형 경사(Z축)를 먼저 고정한 후 진행축(X축)의 기존 코너링/페달링 롤을 합성한다. */
export function riderTerrainRotation(pitchRad: number, rollRad: number): Matrix4 {
  return new Matrix4().makeRotationZ(pitchRad)
    .multiply(new Matrix4().makeRotationX(rollRad));
}

/** 기기 내 시각 보정 전용. 라이더별 DEM 조회는 최대10Hz, 각도는 렌더 프레임마다 보간한다. */
export class RiderTerrainSlope {
  private readonly states = new Map<string, SlopeState>();

  update(
    id: string, lngLat: LngLat, bearingDeg: number, nowMs: number,
    terrainEnabled: boolean, elevationAt: ElevationAt,
  ): number {
    if (!terrainEnabled) {
      this.states.delete(id);
      return 0;
    }
    const previous = this.states.get(id);
    if (!previous) {
      const pitch = samplePitch(lngLat, bearingDeg, elevationAt);
      this.states.set(id, { sampleMs: nowMs, frameMs: nowMs, target: pitch, value: pitch });
      return pitch;
    }
    // 지난 프레임까지의 목표로 먼저 적분해, 새 샘플을 과거 구간에 소급 적용하지 않는다.
    const dtMs = Math.max(0, nowMs - previous.frameMs);
    previous.value += (previous.target - previous.value) * (1 - Math.exp(-dtMs / FOLLOW_MS));
    previous.frameMs = nowMs;
    if (nowMs - previous.sampleMs >= SAMPLE_MS) {
      previous.target = samplePitch(lngLat, bearingDeg, elevationAt);
      previous.sampleMs = nowMs;
    }
    return previous.value;
  }

  prune(liveIds: ReadonlySet<string>): void {
    for (const id of this.states.keys()) {
      if (!liveIds.has(id)) this.states.delete(id);
    }
  }
}
