import type { Map as MapboxMap } from "mapbox-gl";
import type { LineStringGeometry } from "../geo/geo";

/** 주행 종료 정북 복귀 ease 길이(ms). 500~800 범위. */
export const RIDE_END_NORTH_UP_DURATION_MS = 600;

/**
 * 주행 세션 활성(running|paused) → idle 전이에서만 정북 ease 를 켠다.
 * paused 유지·재개·시작에서는 false — 재개 시 방향이 튀지 않게.
 */
export function shouldEaseNorthUpOnRideActiveChange(
  wasRideActive: boolean,
  isRideActive: boolean,
): boolean {
  return wasRideActive && !isRideActive;
}

/**
 * 경로 동일 여부 — 참조가 바뀌어도 끝점·중점이 같으면 같은 경로로 본다.
 * 종료 hold 중 재-fitBounds 오발 방지용.
 */
export function isSameRouteLine(
  a: LineStringGeometry | null | undefined,
  b: LineStringGeometry | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const ac = a.coordinates;
  const bc = b.coordinates;
  if (ac.length !== bc.length) return false;
  if (ac.length === 0) return true;
  const i1 = ac.length - 1;
  const iMid = ac.length >> 1;
  return (
    ac[0][0] === bc[0][0] &&
    ac[0][1] === bc[0][1] &&
    ac[i1][0] === bc[i1][0] &&
    ac[i1][1] === bc[i1][1] &&
    ac[iMid][0] === bc[iMid][0] &&
    ac[iMid][1] === bc[iMid][1]
  );
}

/**
 * 주행 종료 후 bearing 만 0° 로 ease. 중심·줌은 현재값을 명시해 유지한다
 * (fitBounds·재중심 금지). pitch 를 같이 되돌릴 기존 경로가 있으면 `pitch` 로
 * 같은 easeTo 에 합친다(애니메이션이 두 번 돌지 않게).
 */
export function easeMapNorthUpAfterRideEnd(
  map: MapboxMap,
  opts?: { durationMs?: number; pitch?: number },
): void {
  const duration = opts?.durationMs ?? RIDE_END_NORTH_UP_DURATION_MS;
  const center = map.getCenter();
  const next: {
    bearing: number;
    duration: number;
    center: { lng: number; lat: number };
    zoom: number;
    pitch?: number;
  } = {
    bearing: 0,
    duration,
    center: { lng: center.lng, lat: center.lat },
    zoom: map.getZoom(),
  };
  if (opts?.pitch != null && Number.isFinite(opts.pitch)) {
    next.pitch = opts.pitch;
  }
  try {
    map.stop();
    map.easeTo(next);
  } catch (err) {
    console.warn("[map] easeMapNorthUpAfterRideEnd failed", err);
  }
}
