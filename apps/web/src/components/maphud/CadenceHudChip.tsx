import { cadenceChipView, type CadenceHudState } from "../../lib/sensor/cadenceSensorUi";
import "./CadenceHudChip.css";

/*
 * 칩 표시 문구 — 2026-10-20 지시01(§3): 「SENSOR」 대신 **센서**.
 * `lib/sensor/cadenceSensorUi.ts` 의 `CHIP_IDLE_TEXT` 는 sensor-ui-contract
 * 계약 시험(scripts/sensor-cadence)이 보는 값이어서 그 파일은 건드리지 않았다.
 * 접근성 계약(`view.ariaLabel` — 「케이던스 센서: …」)은 이미 한국어이므로 변경
 * 대상이 아니다. 여기서는 **화면 표시만** 매핑해 lib 계약과 화면 문구를 분리 둔다.
 */
const SENSOR_IDLE_LABEL = "SENSOR";

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
  /**
   * 경로가 잡혔는데 아직 센서·체험 속도를 안 고른 상태 — 칩을 깜빡여 다음 할 일을 가리킨다
   * (2026-09-18 Chief). 준비가 끝나면 안내는 소음이 되므로 스스로 꺼진다.
   */
  attention?: boolean;
};

/**
 * 케이던스 상태 칩 — LED(연결 여부)와 짧은 텍스트만 보여 주고,
 * 장치명·오류·액션은 센서 상세 설정(`CadenceSensorSheet`)이 소유한다.
 *
 * 자리는 `lib/route/sensorChipSlot.ts` 가 정한다 — 펼친 RouteDock 한 곳.
 * 접힘·무경로는 dock LED 가 패널을 열고, 칩은 펼친 뒤에만 그린다.
 */
export function CadenceHudChip({
  state,
  riding,
  open,
  onOpen,
  placement = "hud",
  attention = false,
}: CadenceHudChipProps) {
  const view = cadenceChipView(state, riding);
  const chipText = view.text === SENSOR_IDLE_LABEL ? "센서" : view.text;
  return (
    <button
      type="button"
      className={`hud-cadence hud-cadence--${placement}${open ? " hud-cadence--open" : ""}${
        attention ? " hud-cadence--attention" : ""
      }`}
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
      <span className="hud-cadence__text">{chipText}</span>
    </button>
  );
}
