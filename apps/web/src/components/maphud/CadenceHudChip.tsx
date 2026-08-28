import { cadenceChipView, type CadenceHudState } from "../../lib/cadenceSensorUi";

export type CadenceHudChipProps = {
  state: CadenceHudState;
  /** `riding`·`paused` — 이때만 칩에 RPM 이 나온다 */
  riding: boolean;
  /** 센서 상세 설정이 열려 있는가 */
  open: boolean;
  onOpen: () => void;
};

/**
 * HUD 우상단 케이던스 상태 칩 — 계정 칩 왼쪽.
 * LED(연결 여부)와 짧은 텍스트만 보여 주고, 장치명·오류·액션은 상세 설정이 소유한다.
 */
export function CadenceHudChip({ state, riding, open, onOpen }: CadenceHudChipProps) {
  const view = cadenceChipView(state, riding);
  return (
    <button
      type="button"
      className={`hud-cadence ${open ? "hud-cadence--open" : ""}`}
      aria-label={view.ariaLabel}
      aria-expanded={open}
      title="Cadence sensor"
      onClick={onOpen}
    >
      <span
        className={`hud-cadence__led hud-cadence__led--${view.led}${
          view.pulsing ? " hud-cadence__led--pulse" : ""
        }`}
        aria-hidden
      />
      <span className="hud-cadence__text">{view.text}</span>
    </button>
  );
}
