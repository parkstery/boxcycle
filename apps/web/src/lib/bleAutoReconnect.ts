/** Web Bluetooth 자동 재연결의 순수 정책. React·GATT 호출은 훅이 담당한다. */

export const BLE_RECONNECT_BASE_MS = 500;
export const BLE_RECONNECT_MAX_MS = 10_000;

/** 0.5s → 1s → 2s → 4s → 8s → 최대 10s 지수 백오프. */
export function bleReconnectDelayMs(attempt: number): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return Math.min(BLE_RECONNECT_MAX_MS, BLE_RECONNECT_BASE_MS * 2 ** safeAttempt);
}

/**
 * `navigator.bluetooth.getDevices()`가 돌려준 이 origin의 허용 장치 중 자동 복원할 대상을 고른다.
 *
 * CYCPLUS 한 대가 명확하면 우선한다. 그 외에는 허용 장치가 정확히 한 대일 때만 고른다.
 * 여러 후보 중 임의 연결하면 다른 BLE 기기를 잡을 수 있으므로 chooser로 사용자 선택을 받는다.
 */
export function selectGrantedCadenceDevice<T extends { readonly name?: string }>(
  devices: readonly T[],
): T | null {
  const cycplusplus = devices.filter((device) => /^CYCPLUS\b/i.test(device.name?.trim() ?? ""));
  if (cycplusplus.length === 1) return cycplusplus[0];
  if (cycplusplus.length > 1) return null;
  return devices.length === 1 ? devices[0] : null;
}
