import { cadenceChipView, type CadenceHudState } from "../../lib/cadenceSensorUi";
import "./CadenceHudChip.css";

/**
 * 칩이 필요로 하는 최소 결선 — 상태 + 상세 설정 열기.
 * HUD 우상단과 RouteDock 이 같은 모양의 값을 넘긴다(App 은 하나만 만든다).
 */
export type CadenceChipBinding = {
  state: CadenceHudState;
  open: boolean;
  onOpen: () => void;
};

export type CadenceHudChipProps = CadenceChipBinding & {
  /** `riding`·`paused` — 이때만 칩에 RPM 이 나온다 */
  riding: boolean;
  /**
   * 그려지는 자리. 표시 내용은 같고 치수·테두리만 다르다.
   * `dock` 은 RouteDock 유리 틀 안이라 자기 배경을 벗는다.
   */
  placement?: "hud" | "dock";
};

/**
 * 케이던스 상태 칩 — LED(연결 여부)와 짧은 텍스트만 보여 주고,
 * 장치명·오류·액션은 센서 상세 설정(`CadenceSensorSheet`)이 소유한다.
 *
 * 자리는 `lib/sensorChipSlot.ts` 가 정한다 — 경로가 있으면 RouteDock,
 * 없으면(`idle` 등) HUD 우상단. 두 곳에 동시에 그리지 않는다.
 */
export function CadenceHudChip({
  state,
  riding,
  open,
  onOpen,
  placement = "hud",
}: CadenceHudChipProps) {
  const view = cadenceChipView(state, riding);
  return (
    <button
      type="button"
      className={`hud-cadence hud-cadence--${placement}${open ? " hud-cadence--open" : ""}`}
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
