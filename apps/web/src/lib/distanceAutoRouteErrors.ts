/** 지도 방향 선택 안내 — 클릭 거리가 아닌 방향만 사용 */
export const DISTANCE_AUTO_ROUTE_DIRECTION_HINT =
  "지도에서 원하는 주행 방향을 선택하세요. 클릭한 지점까지의 거리가 아니라 방향만 사용합니다.";

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
