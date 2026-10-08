/**
 * 시험용 가짜 도로 기하 — 두 점 사이를 20m 간격으로 채운다.
 *
 * 2026-09-24(344a954)부터 서버는 점이 성긴 직선(한강 횡단 같은 가짜 도로)을
 * `low_point_density` 로 거부한다. 2점짜리 mock 은 그 거부에 걸려 시험 의도와 무관하게
 * 「failed」가 된다. 실제 Mapbox 응답처럼 촘촘한 선을 돌려줘야 원래 계약을 시험한다.
 */
type LngLat = [number, number];

export const DENSE_LINE_STEP_M = 20;

/** 위경도 선형 보간 — 수 km 이하 시험 구간에서는 길이 오차가 무시할 만하다 */
export function denseLine(a: LngLat, b: LngLat, stepM = DENSE_LINE_STEP_M): LngLat[] {
  const R = 6371008.8;
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLng / 2) ** 2;
  const meters = 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  const n = Math.max(1, Math.ceil(meters / stepM));
  const out: LngLat[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}
