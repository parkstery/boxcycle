import { useState } from "react";

/**
 * 두 「주행」 버튼(경로 생성 창·우측 하단)이 함께 쓰는 펄스 번호(Chief 2026-10-26).
 *
 * 새 경로(완료 token)가 생기고 주행을 시작할 수 있게 되는 순간 한 번 오른다. 출발·도착, 수단 재탐색,
 * 거리·방향 탐색 모두 경로 token 이 새로 나오므로 같은 규칙을 탄다. 주행 입력이 아직 준비되지 않았으면
 * 준비되는 순간까지 미룬다 — 눌리지 않는 버튼을 펄싱하지 않는다. 0 은 「아직 펄스 없음」.
 */
export function useRideStartPulseKey(routeToken: object | null, startable: boolean): number {
  const [pulse, setPulse] = useState<{ token: object | null; key: number }>({ token: null, key: 0 });
  if (routeToken != null && startable && pulse.token !== routeToken) {
    setPulse({ token: routeToken, key: pulse.key + 1 });
  }
  return pulse.key;
}
