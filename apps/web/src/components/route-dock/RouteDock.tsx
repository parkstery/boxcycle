import { useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { cadenceChipView } from "../../lib/sensor/cadenceSensorUi";
import { isRouteDockVisible, routeDockUiPolicy } from "../../lib/route/routeDockUiPolicy";
import { sensorChipSlotView } from "../../lib/route/sensorChipSlot";
import { CadenceHudChip, type CadenceChipBinding } from "../maphud/CadenceHudChip";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "./RouteDock.css";
/* LED 클래스(hud-cadence__led*) — CadenceHudChip 이 묶은 CSS. 접힌 캐럿 LED 가 재사용한다. */
import "../maphud/CadenceHudChip.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeLoading: boolean;
  canStartRide: boolean;
  /**
   * 경로는 잡혔는데 센서·체험 속도를 아직 안 고른 상태. 센서 칩을 깜빡여 다음 할 일을
   * 가리킨다(2026-09-18 Chief). 판정은 App 이 한다 — dock 은 `routeGeometry` 를 모른다.
   */
  sensorAttention?: boolean;
  /** 주행 시작. `fromStart=true` 면 재개 후보를 무시하고 처음부터(§9.5.5 단위7) */
  onStartRide: (fromStart?: boolean) => void;
  /** 주행 중 → 일시정지 */
  onPauseRide: () => void;
  /** 일시정지 → 재개 */
  onResumeRide: () => void;
  /** 주행 종료(결과 시트로) */
  onEndRide: () => void;
  /** 로드된 미완주 저장 경로의 재개 후보 진행률(0..1). null=재개 불가(선택 UI 미표시) */
  resumeRatio?: number | null;
  /** 이어달리기 슬롯 명시 종료. null=표시 안 함 */
  onAbandonResume?: (() => void) | null;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  editLocked?: boolean;
  /**
   * 케이던스 센서 칩(UI-DECLUTTER-SENSOR-6A). null 이면 미표시.
   * Go 의 사전조건인 「주행 입력 준비」가 센서 시트에 있으므로 준비물을 Go 와 한 시선에 둔다.
   */
  cadence?: CadenceChipBinding | null;
};

const STOP_KIND_LABEL: Record<RouteDockStop["kind"], string> = {
  start: "S",
  waypoint: "·",
  end: "E",
};

export function RouteDock(props: RouteDockProps) {
  const {
    stage,
    stops,
    routeLoading,
    canStartRide,
    sensorAttention = false,
    onStartRide,
    onPauseRide,
    onResumeRide,
    onEndRide,
    resumeRatio = null,
    onRemoveStop,
    onFocusStop,
    editLocked = false,
    cadence = null,
  } = props;

  const visible = isRouteDockVisible(stage);
  /*
   * 경로가 없는 첫 화면(`idle`)에서는 접힌 채로 뜬다 — dock 이 여기까지 보이게 된 이유는
   * 센서 칩 한 줄을 실으려는 것이지 빈 패널을 펼쳐 지도를 가리려는 게 아니다.
   */
  const [expanded, setExpanded] = useState(() => stops.length > 0);
  /** 이어 달리기 — true 면 처음부터 다시(기본은 저장 지점부터 재개). */
  const [restartFromZero, setRestartFromZero] = useState(false);
  // 재개 후보가 바뀌면(다른 경로 로드 등) 선택을 기본값(이어달리기)으로 리셋.
  // effect 대신 이전값 비교(React 권장) — set-state-in-effect 회피.
  const [prevResumeRatio, setPrevResumeRatio] = useState(resumeRatio);
  if (resumeRatio !== prevResumeRatio) {
    setPrevResumeRatio(resumeRatio);
    setRestartFromZero(false);
  }

  const dockUi = routeDockUiPolicy(stage, editLocked);
  const { isActiveRide, ridingDiet, hideStopsList, lockStopEditing } = dockUi;

  /*
   * 주행 시작 시 자동 접힘은 없다(2026-09-28 Chief). 접어 버리면 멈추려는 사용자가
   * 종료 버튼을 찾지 못한다 — 접는 판단은 사용자에게 맡긴다.
   */
  const autoExpandKey = `${visible}:${stops.length}:${isActiveRide}:${stage}`;
  const [prevAutoExpandKey, setPrevAutoExpandKey] = useState(autoExpandKey);
  if (autoExpandKey !== prevAutoExpandKey) {
    setPrevAutoExpandKey(autoExpandKey);
    if (visible && stops.length > 0 && !isActiveRide) setExpanded(true);
    // 경로를 모두 지워 첫 화면으로 돌아오면 다시 접는다
    else if (stage === "idle" && stops.length === 0) setExpanded(false);
  }

  if (!visible) return null;

  /*
   * 접힘 형태와 센서 자리는 **한 판정**에서 나온다 — `lib/route/sensorChipSlot`.
   * 인라인으로 두면 09-23 처럼 모듈과 조용히 갈라진다(2026-09-26 통합).
   *
   * 주행 중 접힘(20260923-minimap 지시01 §3): 센서 칩(텍스트)을 빼고 캐럿 폭만 남긴다.
   * LED 는 셰브런 자리에. 펼치면 칩+셰브런 복귀. 주행 전 접힘에서는 칩을 유지
   * (센서 설정 입구 — sensorChipSlot 2026-09-16 사고).
   *
   * 첫 화면(idle) — 「SENSOR」 텍스트가 보이는 칩 대신, 주행 중 접힘과 같은 형태로
   * 캐럿 폭에 LED 만 남긴다(지시04 §A, 2026-09-23 미니맵 라운드 형태 재사용 — D7).
   * 경유지가 하나라도 잡히면(stage 가 idle 을 벗어나면) 즉시 원래 칩+캐럿으로 돌아간다.
   * 펼쳐 봐야 빈 목록뿐이라 펼침 대신 **눌러서 바로 센서 시트를 연다**(§A3 동작 유지).
   */
  const sensorView = sensorChipSlotView({ stage, hasCadence: Boolean(cadence), expanded });
  const { rideCollapsed, preRouteCollapsed } = sensorView;
  const showSensorChip = sensorView.slot === "route-dock-chip";
  const caretSensorView =
    cadence && sensorView.slot === "route-dock-caret"
      ? cadenceChipView(cadence.state, isActiveRide)
      : null;
  const caretAriaLabel = preRouteCollapsed
    ? caretSensorView
      ? `센서 설정 열기 · ${caretSensorView.ariaLabel}`
      : "센서 설정 열기"
    : expanded
      ? "경로 패널 접기"
      : caretSensorView
        ? `경로 패널 펼치기 · ${caretSensorView.ariaLabel}`
        : "경로 패널 펼치기";
  const onCaretClick = () => {
    if (preRouteCollapsed && cadence) {
      cadence.onOpen();
      return;
    }
    setExpanded((v) => !v);
  };

  /*
   * 주행 제어(Go · 일시정지 · 종료) — 2026-09-28 Chief.
   * 종전 이 자리에 있던 「내 경로로 저장」·「삭제」는 각각 주행 결과 시트와 경로 설정
   * 팝업이 이미 갖고 있어 중복이었다. 비운 자리를 주행 제어가 받는다.
   *
   * 세 버튼은 **항상 같은 자리에 같은 순서로** 그린다(조건부 렌더 대신 disabled).
   * 버튼이 들고 나면 위치가 흔들려 「몸이 기억하는 종료 버튼」이 성립하지 않는다.
   *
   * 같은 버튼이 두 벌이던 HUD 우하단 FAB 은 함께 제거했다(2026-09-28 Chief) — 그래서
   * 여기가 주행 제어의 유일한 자리이고, 표준 이름(주행 시작·일시정지·주행 종료)을 쓴다.
   * ⚠️ 못 쓰는 상황에서도 **DOM 에 남아 있다**(disabled). 「주행 종료 버튼이 보이면
   *    주행 중」으로 판정하지 말 것 — e2e 는 `isEnabled()` 로 본다.
   */
  const paused = stage === "paused";
  const riding = stage === "riding";
  const goDisabled = paused
    ? false
    : !(stage === "ready-to-start" && canStartRide && !routeLoading && !editLocked);

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}${
        rideCollapsed ? " route-dock-anchor--ride-collapsed" : ""
      }${preRouteCollapsed ? " route-dock-anchor--caret-only" : ""}`}
      aria-label="경로 설정"
    >
      <div className="route-dock__shell">
        <button
          type="button"
          className="route-dock__caret hud-glass"
          aria-expanded={preRouteCollapsed ? (cadence?.open ?? false) : expanded}
          aria-label={caretAriaLabel}
          title={preRouteCollapsed ? "센서 설정" : expanded ? "접기" : "펼치기"}
          onClick={onCaretClick}
        >
          {caretSensorView ? (
            <span
              className={`route-dock__caret-led hud-cadence__led hud-cadence__led--${caretSensorView.led}${
                caretSensorView.pulsing ? " hud-cadence__led--pulse" : ""
              }`}
              aria-hidden
            />
          ) : (
            <svg
              className="route-dock__caret-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              aria-hidden
            >
              {expanded ? (
                <path
                  d="M14 6l-6 6 6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <path
                  d="M10 6l6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
        </button>

        <div className="route-dock__body">
        {/*
          첫 행 — **접히는 본문 바깥**. 센서 칩이 왼쪽에 앉고 주행 제어가 그 오른쪽.
          「경로(caret) → 센서 → Go」가 한 줄로 읽힌다.
          칩을 세로로 세우지 않는 이유: 전용 컬럼을 만들면 그 아래가 통째로 빈 채
          dock 폭만 넓어져 지도를 더 가린다(2026-09-16 Chief 지적).
          헤더를 `route-dock__panel` 안에 두지 않는 이유: 접었을 때 칩까지 같이 사라져
          rpm·연결 신호가 끊긴다(지시서 §3.1).
          단, 주행 중+접힘에서는 칩 대신 캐럿 LED 로 연결만 표시(지시01 §3) —
          rpm 은 펼친 뒤 칩에서 본다.
        */}
        <div className="route-dock__top">
          {showSensorChip && cadence ? (
            <CadenceHudChip
              placement="dock"
              state={cadence.state}
              riding={isActiveRide}
              open={cadence.open}
              onOpen={cadence.onOpen}
              attention={sensorAttention && !isActiveRide}
            />
          ) : null}
        {expanded ? (
          <header className="route-dock__head">
            {/* 주행 제어는 줄의 **오른쪽 끝** — SENSOR 바로 옆에 붙이지 않는다(2026-09-18 Chief).
                CSS order 대신 DOM 순서를 그대로 둬 키보드 순서도 보이는 대로 간다. */}
            <div className="route-dock__transport" role="group" aria-label="주행 제어">
              <button
                type="button"
                className="route-dock__go route-dock__transport-btn"
                disabled={goDisabled}
                aria-label={paused ? "재개" : "주행 시작"}
                title={paused ? "Resume" : "Start ride"}
                onClick={() => (paused ? onResumeRide() : onStartRide(restartFromZero))}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
                  <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className="route-dock__transport-btn route-dock__transport-btn--pause"
                disabled={!riding}
                aria-label="일시정지"
                title="Pause"
                onClick={onPauseRide}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
                  <rect x="7" y="5.5" width="3.6" height="13" rx="1.1" fill="currentColor" />
                  <rect x="13.4" y="5.5" width="3.6" height="13" rx="1.1" fill="currentColor" />
                </svg>
              </button>
              <button
                type="button"
                className="route-dock__transport-btn route-dock__transport-btn--stop"
                disabled={!isActiveRide}
                aria-label="주행 종료"
                title="Stop ride"
                onClick={onEndRide}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden focusable="false">
                  <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" fill="currentColor" />
                </svg>
              </button>
            </div>
          </header>
        ) : null}
        </div>

        <div
          className="route-dock__panel hud-glass"
          hidden={!expanded}
          aria-hidden={!expanded}
        >
        {!ridingDiet && stage === "ready-to-start" && resumeRatio != null ? (
          <div className="route-dock__resume" role="radiogroup" aria-label="이어 달리기">
            <label className="route-dock__resume-option">
              <input
                type="radio"
                name="route-dock-resume"
                checked={!restartFromZero}
                onChange={() => setRestartFromZero(false)}
              />
              <span>
                {Math.round(resumeRatio * 100)}% 지점부터 <strong>이어달리기</strong>
              </span>
            </label>
            <label className="route-dock__resume-option">
              <input
                type="radio"
                name="route-dock-resume"
                checked={restartFromZero}
                onChange={() => setRestartFromZero(true)}
              />
              <span>처음부터</span>
            </label>
            {props.onAbandonResume ? (
              <button
                type="button"
                className="route-dock__abandon-resume"
                onClick={props.onAbandonResume}
              >
                이어달리기 종료
              </button>
            ) : null}
          </div>
        ) : null}

        {!hideStopsList ? (
          <ul className="route-dock__stops" role="list">
            {stops.length === 0 ? (
              isActiveRide ? null : (
                <li className="route-dock__stops-empty">지도를 탭해 출발·도착 설정</li>
              )
            ) : (
              stops.map((stop, index) => (
                <li key={stop.id}>
                  <button
                    type="button"
                    className="route-dock__stop"
                    onClick={() => onFocusStop(stop)}
                    title="지도에서 보기"
                  >
                    <span
                      className={`route-dock__stop-dot route-dock__stop-dot--${stop.kind}`}
                      aria-hidden
                    >
                      {stop.kind === "waypoint"
                        ? String((stop.waypointIndex ?? index) + 1)
                        : STOP_KIND_LABEL[stop.kind]}
                    </span>
                    <span
                      className="route-dock__stop-label"
                      title={stop.loading ? undefined : stop.label}
                    >
                      {stop.loading ? "주소 불러오는 중…" : stop.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="route-dock__stop-remove"
                    disabled={lockStopEditing}
                    aria-label={`${stop.kind === "start" ? "출발" : stop.kind === "end" ? "도착" : "경유"} 삭제`}
                    title={`${stop.kind === "start" ? "출발" : stop.kind === "end" ? "도착" : "경유"} 삭제`}
                    onClick={() => onRemoveStop(stop.id)}
                  >
                    ✕
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}

        </div>
        </div>
      </div>
    </div>
  );
}
