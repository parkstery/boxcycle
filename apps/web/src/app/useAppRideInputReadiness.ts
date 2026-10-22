import { useCallback, useEffect, useMemo, useState } from "react";
import { useBleCrankRpm } from "../hooks/useBleCrankRpm";
import { resolveRideTargetSpeedKmh, type RideInputMode } from "../lib/sensor/cadenceRideInput";
import { resolveRideInputReadiness } from "../lib/sensor/cadenceSensorUi";

/** 주행 입력(수동 속도·BLE 케이던스) 상태와 준비 판정 — 훅 순서는 App 원문 그대로 */
export function useAppRideInputReadiness() {
  /** 체험(T0) 입력 — 슬라이더가 정한 값. cadence 모드에서는 목표 속도에 쓰이지 않는다. */
  const [manualSpeedKmh, setManualSpeedKmh] = useState(5);
  /**
   * 주행 입력 모드. 센서 연결 성공은 `cadence` 로 전환하지만, 단절·정지는
   * 절대 `manual` 로 자동 복귀시키지 않는다 — 페달링 없이 전진하는 실패를 막는다.
   */
  const [rideInputMode, setRideInputMode] = useState<RideInputMode>("manual");
  const bleCrankRpm = useBleCrankRpm();
  const bleSensorConnected = bleCrankRpm.uiState === "connected";
  /**
   * 「센서 없음」(체험 속도)로 시작할 준비가 됐는가. 이게 false 면 Go 가 잠긴다.
   *
   * 2026-09-28 Chief: **기본값을 「센서 없음」으로 둔다.** 종전에는 false 로 시작해
   * 센서 시트를 한 번 열어 고르기 전에는 Go 가 잠겼는데(「선택하지 않은 체험 주행 금지」),
   * 주행 시험마다 그 한 바퀴를 도느라 시간이 샜다. 센서를 연결하면 `cadence` 로 올라가고,
   * 단절·정지에서 `manual` 로 자동 복귀하지 않는 보호는 그대로다.
   */
  const [manualInputChosen, setManualInputChosen] = useState(true);
  /** 이번 연결에서 유효 크랭크 샘플을 한 번이라도 받았는가(이후 0rpm 이어도 유지) */
  const [cadenceSampleSeen, setCadenceSampleSeen] = useState(false);
  const switchRideInputToManual = useCallback(() => {
    setManualInputChosen(true);
    setRideInputMode("manual");
  }, []);
  const switchRideInputToCadence = useCallback(() => setRideInputMode("cadence"), []);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __rtwSetRideInputMode?: (m: RideInputMode) => void }).__rtwSetRideInputMode =
      setRideInputMode;
    return () => {
      delete (window as unknown as { __rtwSetRideInputMode?: (m: RideInputMode) => void }).__rtwSetRideInputMode;
    };
  }, []);
  // 센서 연결 성공 = cadence 전환. effect 대신 이전값 비교(React 권장) — set-state-in-effect 회피.
  const [prevBleUiState, setPrevBleUiState] = useState(bleCrankRpm.uiState);
  if (bleCrankRpm.uiState !== prevBleUiState) {
    setPrevBleUiState(bleCrankRpm.uiState);
    if (bleCrankRpm.uiState === "connected") setRideInputMode("cadence");
    // 연결이 아닌 상태로 나가면 「이번 연결의 샘플 확인」은 무효 — 준비 완료도 풀린다.
    if (bleCrankRpm.uiState !== "connected") setCadenceSampleSeen(false);
  }
  // 유효 샘플 1회 = cadence 준비 완료. 0rpm(정지)도 crankRpm !== null 이라 유지된다.
  if (bleSensorConnected && bleCrankRpm.crankRpm != null && !cadenceSampleSeen) {
    setCadenceSampleSeen(true);
  }
  const rideInputReadiness = resolveRideInputReadiness({
    mode: rideInputMode,
    manualChosen: manualInputChosen,
    uiState: bleCrankRpm.uiState,
    cadenceSampleSeen,
  });
  /** 현재 입력 모드가 만든 목표 속도 — 실제 적용 속도는 램핑 후 `rideMetrics.appliedSpeedKmh` */
  const rideTargetSpeedKmh = useMemo(
    () =>
      resolveRideTargetSpeedKmh({
        mode: rideInputMode,
        manualSpeedKmh,
        crankRpm: bleCrankRpm.crankRpm,
        sensorConnected: bleSensorConnected,
      }),
    [rideInputMode, manualSpeedKmh, bleCrankRpm.crankRpm, bleSensorConnected],
  );
  return {
    manualSpeedKmh,
    setManualSpeedKmh,
    rideInputMode,
    bleCrankRpm,
    switchRideInputToManual,
    switchRideInputToCadence,
    rideInputReadiness,
    rideTargetSpeedKmh,
  };
}
