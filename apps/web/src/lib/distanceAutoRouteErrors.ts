/** 지도 방향 선택 안내 — 클릭 거리가 아닌 방향만 사용 */
export const DISTANCE_AUTO_ROUTE_DIRECTION_HINT =
  "지도에서 원하는 주행 방향을 선택하세요. 클릭한 지점까지의 거리가 아니라 방향만 사용합니다.";

/** 방향 선택 모드 — popup 한 줄 상태 */
export const DISTANCE_AUTO_ROUTE_DIRECTION_CLICK_HINT =
  "도착하고 싶은 도로 위 지점을 클릭하세요";

/** Route 생성 성공 후 같은 popup에서 재탐색 안내 */
export const DISTANCE_AUTO_ROUTE_REROUTE_HINT =
  "경로 생성 완료 · 다른 방향을 클릭하면 다시 탐색합니다";

/** 목표 거리 참고 원 — 금지 구역이 아닌 눈금 안내 */
export const DISTANCE_AUTO_ROUTE_REFERENCE_CIRCLE_HINT =
  "참고 — 실제 도로 거리는 방향에 따라 다릅니다";

export function formatDistanceAutoRouteShortfallMessage(
  targetKm: number,
  distanceMeters: number,
): string {
  const deficitM = Math.max(0, Math.round(targetKm * 1000 - distanceMeters));
  const actualKm = distanceMeters / 1000;
  return `목표 ${targetKm.toFixed(1)} km 에 ${deficitM} m 모자란 ${actualKm.toFixed(2)} km 로 만들었습니다.`;
}

export function formatDistanceAutoRouteOfferedMessage(
  directRoadMeters: number,
  targetKm: number,
): string {
  const directKm = directRoadMeters / 1000;
  return `클릭 지점까지는 도로로 ${directKm.toFixed(1)} km 입니다. 목표 ${targetKm.toFixed(1)} km 지점에서 종료했습니다.`;
}


/** 거리·방향 자동 Route 모드 checkbox 접근 가능 이름 */
export const DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA =
  "거리와 방향으로 Route 찾기";

/** 거리·방향 자동 Route 모드 checkbox 시각 label */
export const DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL = "거리";

export const DISTANCE_AUTO_ROUTE_KM_MIN = 0.5;
export const DISTANCE_AUTO_ROUTE_KM_MAX = 120;
export const DISTANCE_AUTO_ROUTE_KM_STEP = 0.5;

/**
 * 목표 거리 칩(5A-R2 §4.2) — 슬라이더를 **대체**한다.
 * 실내 주행에서 실제로 자주 쓰는 구간에 몰아 넣는다. 그 밖은 `±` 버튼과 숫자 입력으로.
 */
export const DISTANCE_AUTO_ROUTE_CHIP_KM: readonly number[] = [1, 3, 5, 10, 20];

/** 기본 목표 거리(km) — 이어 달리기 루프가 핵심이라 짧게 여러 번이 낫다(5A-R2 §4.4) */
export const DISTANCE_AUTO_ROUTE_DEFAULT_KM = 5;

/**
 * 거리 슬라이더 **구간별 스냅**(5A-R1 §4.2).
 *
 * 문제는 눈금 크기가 아니라 **범위**였다. `0.5 ~ 120 km` 를 0.5 눈금으로 나누면 240 칸이고,
 * 폰 팝업의 슬라이더 폭이 200 px 남짓이라 **한 칸이 1 px 미만**이다 — 손가락으로 특정
 * 값을 고르는 것이 물리적으로 불가능하다.
 *
 * 정밀도를 **실제 주행이 일어나는 짧은 구간에 몰아준다.**
 *
 * | 구간 | 스냅 | 칸 수 |
 * |---|---:|---:|
 * | 0.5 ~ 10 km | 0.5 km | 20 |
 * | 10 ~ 30 km | 5 km | 4 |
 * | 30 ~ 120 km | 10 km | 9 |
 * | | | **33** |
 *
 * 폰에서 한 칸이 약 6 px 이 된다. ± 버튼과 숫자 입력은 지금처럼 0.5 km 미세 조정을 맡으므로
 * 스냅이 굵어져도 원하는 값을 못 넣는 일은 없다.
 */
export const DISTANCE_AUTO_ROUTE_SNAP_BANDS: ReadonlyArray<{ upToKm: number; stepKm: number }> = [
  { upToKm: 10, stepKm: 0.5 },
  { upToKm: 30, stepKm: 5 },
  { upToKm: DISTANCE_AUTO_ROUTE_KM_MAX, stepKm: 10 },
];

/** 슬라이더가 취할 수 있는 값 목록 — 오름차순, 중복 없음 */
export function distanceAutoRouteSliderStops(): number[] {
  const stops: number[] = [DISTANCE_AUTO_ROUTE_KM_MIN];
  for (const band of DISTANCE_AUTO_ROUTE_SNAP_BANDS) {
    // 각 구간은 **자기 눈금 격자**에서 시작한다 — 앞 구간의 끝에 앞 구간 눈금을 더하면
    // 10.5·15.5 같은 어정쩡한 값이 나온다.
    const first = Math.ceil((stops[stops.length - 1]! - 1e-9) / band.stepKm) * band.stepKm;
    for (let v = first; v <= band.upToKm + 1e-9; v += band.stepKm) {
      const rounded = Math.round(v * 10) / 10;
      if (rounded > stops[stops.length - 1]! + 1e-9) stops.push(rounded);
    }
  }
  const max = DISTANCE_AUTO_ROUTE_KM_MAX;
  if (stops[stops.length - 1] !== max) stops.push(max);
  return stops;
}

/** 임의 km 를 슬라이더 눈금 중 가장 가까운 값으로 맞춘다(동률이면 작은 쪽) */
export function snapDistanceAutoRouteTargetKm(km: number): number {
  const stops = distanceAutoRouteSliderStops();
  const n = Number(km);
  if (!Number.isFinite(n)) return DISTANCE_AUTO_ROUTE_KM_MIN;
  if (n <= stops[0]!) return stops[0]!;
  if (n >= stops[stops.length - 1]!) return stops[stops.length - 1]!;
  let best = stops[0]!;
  let bestDiff = Infinity;
  for (const s of stops) {
    const d = Math.abs(s - n);
    if (d < bestDiff - 1e-9) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

export function validateDistanceAutoRouteTargetKm(
  km: number,
): { ok: true; km: number } | { ok: false; message: string } {
  if (!Number.isFinite(km)) {
    return { ok: false, message: "목표 거리를 입력하세요." };
  }
  if (km < DISTANCE_AUTO_ROUTE_KM_MIN || km > DISTANCE_AUTO_ROUTE_KM_MAX) {
    return {
      ok: false,
      message: `목표 거리는 ${DISTANCE_AUTO_ROUTE_KM_MIN}~${DISTANCE_AUTO_ROUTE_KM_MAX} km 입니다.`,
    };
  }
  return { ok: true, km };
}

/** 네트워크·CORS·미배포 함수 등 fetch 수준 연결 실패 */
export const DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE =
  "자동 경로 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.";

function isNetworkFetchFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.trim();
  if (msg === "Failed to fetch" || msg === "NetworkError when attempting to fetch resource.") {
    return true;
  }
  if (error instanceof TypeError && /fetch|network|load failed/i.test(msg)) {
    return true;
  }
  return false;
}

export function formatDistanceAutoRouteClientError(error: unknown): string {
  if (isNetworkFetchFailure(error)) {
    return DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "목표거리와 적합한 경로를 찾지 못했습니다.";
}

export function isDistanceAutoRouteServerUnavailableMessage(message: string): boolean {
  return message === DISTANCE_AUTO_ROUTE_SERVER_UNAVAILABLE;
}
