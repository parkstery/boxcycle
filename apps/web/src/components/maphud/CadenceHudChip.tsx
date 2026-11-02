import { cadenceChipView, type CadenceHudState } from "../../lib/sensor/cadenceSensorUi";
import "./CadenceHudChip.css";

/** 센서 칸이 필요로 하는 최소 결선 — 상태 + 상세 설정 열기(App 은 하나만 만든다). */
export type CadenceChipBinding = {
  state: CadenceHudState;
  open: boolean;
  onOpen: () => void;
};

/**
 * Chief 11-02 v4(B단계): 계기판 맨 앞 칸 — 위 「RPM」, 아래 LED + 페달 회전수(센서 신호가 없으면 「--」).
 * 폭은 고정이라 숫자가 바뀌어도 오른쪽 계기가 밀리지 않는다. 누르면 센서 상세 설정.
 * 접근성 이름은 칩과 같은 「케이던스 센서: …」(`cadenceChipView`).
 */
export function CadenceMetricCell({
  state,
  riding,
  open,
  onOpen,
  attention = false,
}: CadenceChipBinding & { riding: boolean; attention?: boolean }) {
  const view = cadenceChipView(state, riding);
  const rpm =
    state.uiState === "connected" && state.crankRpm != null ? String(Math.max(0, Math.round(state.crankRpm))) : "--";
  return (
    <button
      type="button"
      className={`hud-metrics__cell hud-metrics__cell--sensor${open ? " hud-metrics__cell--sensor-open" : ""}${
        attention ? " hud-metrics__cell--sensor-attention" : ""
      }`}
      aria-label={view.ariaLabel}
      aria-expanded={open}
      title={view.ariaLabel}
      data-led={view.led}
      onClick={onOpen}
    >
      <span className="hud-metrics__label">RPM</span>
      <span className="hud-metrics__value hud-metrics__value--sensor">
        <span
          className={`hud-cadence__led hud-cadence__led--${view.led}${view.pulsing ? " hud-cadence__led--pulse" : ""}`}
          aria-hidden
        />
        <span className="hud-metrics__sensor-rpm">{rpm}</span>
      </span>
    </button>
  );
}
