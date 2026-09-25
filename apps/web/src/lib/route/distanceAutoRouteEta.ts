/**
 * 목표 거리 예상 소요 시간 — 5A-R2 §4.3.
 *
 * 일반적인 20~25 km/h 가정 대신 **사용자의 실제 누적 평균**을 쓴다. 이미 갖고 있다
 * (`users/{uid}.mileageTotalMeters` · `mileageTotalSec`).
 */

/**
 * 누적이 없거나 비정상일 때 쓰는 기본 속도(km/h).
 *
 * 근거: 이 앱은 **실내 자전거**로 달린다. 실외처럼 신호·경사·바람이 없어 속도가
 * 일정하고, 앱의 체험 속도 기본값과 입문 코스 설계가 20 km/h 대를 전제로 한다.
 * 신규 사용자가 대부분 여기 해당하므로 과하게 낙관적인 값을 쓰지 않는다.
 */
export const DISTANCE_AUTO_ROUTE_FALLBACK_KMH = 20;

/** 사람이 낼 수 없는 값은 누적이 오염된 것으로 본다(0 나눗셈·센서 폭주 방어) */
export const DISTANCE_AUTO_ROUTE_MIN_PLAUSIBLE_KMH = 3;
export const DISTANCE_AUTO_ROUTE_MAX_PLAUSIBLE_KMH = 60;

export type DistanceAutoRouteEta = {
  /** 예상 소요 분(반올림, 최소 1) */
  minutes: number;
  /** 계산에 쓴 속도(km/h) */
  kmh: number;
  /** 사용자의 누적 평균을 썼는가 — false 면 「내 평균」 표기를 빼야 한다 */
  fromUserAverage: boolean;
};

/**
 * 누적 주행에서 평균 속도(km/h)를 낸다. 신뢰할 수 없으면 `null`.
 * **축퇴값(0·NaN·비현실적)이 조용히 통과하지 않게** 범위를 확인한다.
 */
export function resolveUserAverageKmh(
  mileageTotalMeters: number | null | undefined,
  mileageTotalSec: number | null | undefined,
): number | null {
  const m = Number(mileageTotalMeters);
  const sec = Number(mileageTotalSec);
  if (!Number.isFinite(m) || !Number.isFinite(sec)) return null;
  if (m <= 0 || sec <= 0) return null;
  const kmh = (m / 1000) / (sec / 3600);
  if (!Number.isFinite(kmh)) return null;
  if (kmh < DISTANCE_AUTO_ROUTE_MIN_PLAUSIBLE_KMH) return null;
  if (kmh > DISTANCE_AUTO_ROUTE_MAX_PLAUSIBLE_KMH) return null;
  return kmh;
}

export function resolveDistanceAutoRouteEta(input: {
  targetKm: number;
  mileageTotalMeters?: number | null;
  mileageTotalSec?: number | null;
}): DistanceAutoRouteEta {
  const avg = resolveUserAverageKmh(input.mileageTotalMeters, input.mileageTotalSec);
  const kmh = avg ?? DISTANCE_AUTO_ROUTE_FALLBACK_KMH;
  const km = Number(input.targetKm);
  const safeKm = Number.isFinite(km) && km > 0 ? km : 0;
  const minutes = Math.max(1, Math.round((safeKm / kmh) * 60));
  return { minutes, kmh, fromUserAverage: avg != null };
}

/** 표시 문구. 누적이 없으면 「내 평균」을 붙이지 않는다. */
export function formatDistanceAutoRouteEta(eta: DistanceAutoRouteEta): string {
  return eta.fromUserAverage
    ? `약 ${eta.minutes}분 (내 평균 ${eta.kmh.toFixed(1)} km/h)`
    : `약 ${eta.minutes}분 (${eta.kmh.toFixed(0)} km/h 기준)`;
}
