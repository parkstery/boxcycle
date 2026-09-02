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

export function formatDistanceAutoRouteOfferedMessage(
  directRoadMeters: number,
  targetKm: number,
): string {
  const directKm = directRoadMeters / 1000;
  return `클릭 지점까지는 도로로 ${directKm.toFixed(1)} km 입니다. 목표 ${targetKm.toFixed(1)} km 지점에서 종료했습니다.`;
}

export function formatDistanceAutoRouteAdjustRetryLabel(directRoadMeters: number): string {
  const adjustedKm = Math.ceil(directRoadMeters / 100) / 10;
  return `${adjustedKm.toFixed(1)} km 로 늘려 클릭 지점까지 가기`;
}

/** 거리·방향 자동 Route 모드 checkbox 접근 가능 이름 */
export const DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_ARIA =
  "거리와 방향으로 Route 찾기";

/** 거리·방향 자동 Route 모드 checkbox 시각 label */
export const DISTANCE_AUTO_ROUTE_MODE_CHECKBOX_LABEL = "거리";

export const DISTANCE_AUTO_ROUTE_KM_MIN = 0.5;
export const DISTANCE_AUTO_ROUTE_KM_MAX = 120;
export const DISTANCE_AUTO_ROUTE_KM_STEP = 0.5;

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
