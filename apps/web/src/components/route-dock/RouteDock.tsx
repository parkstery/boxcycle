import { useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { cadenceChipView } from "../../lib/cadenceSensorUi";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isRouteDockVisible, routeDockUiPolicy } from "../../lib/routeDockUiPolicy";
import { CadenceHudChip, type CadenceChipBinding } from "../maphud/CadenceHudChip";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
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
  canSaveRoute: boolean;
  onSaveCurrentRoute: (name: string, confirmUpdate?: boolean) => Promise<void> | void;
  /** 주행 시작. `fromStart=true` 면 재개 후보를 무시하고 처음부터(§9.5.5 단위7) */
  onStartRide: (fromStart?: boolean) => void;
  /** 로드된 미완주 저장 경로의 재개 후보 진행률(0..1). null=재개 불가(선택 UI 미표시) */
  resumeRatio?: number | null;
  onClearRoute: () => void;
  onRemoveStop: (id: RouteDockStopId) => void;
  onFocusStop: (stop: RouteDockStop) => void;
  editLocked?: boolean;
  /**
   * 케이던스 센서 칩(UI-DECLUTTER-SENSOR-6A). null 이면 미표시.
   * Go 의 사전조건인 「주행 입력 준비」가 센서 시트에 있으므로 준비물을 Go 와 한 시선에 둔다.
   */
  cadence?: CadenceChipBinding | null;
  /** 미완료 쿼터 초과로 저장이 막혔을 때 상위에 알림(→「내 경로」 대기 탭 유도) */
  onIncompleteQuotaBlocked?: (message: string) => void;
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
    canSaveRoute,
    onSaveCurrentRoute,
    onStartRide,
    resumeRatio = null,
    onClearRoute,
    onRemoveStop,
    onFocusStop,
    editLocked = false,
    cadence = null,
    onIncompleteQuotaBlocked,
  } = props;

  const visible = isRouteDockVisible(stage);
  /*
   * 경로가 없는 첫 화면(`idle`)에서는 접힌 채로 뜬다 — dock 이 여기까지 보이게 된 이유는
   * 센서 칩 한 줄을 실으려는 것이지 빈 패널을 펼쳐 지도를 가리려는 게 아니다.
   */
  const [expanded, setExpanded] = useState(() => stops.length > 0);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDraft, setSaveDraft] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** 같은 경로가 이미 있어 "업데이트하시겠습니까?" 확인을 기다리는 중. */
  const [saveConfirmUpdate, setSaveConfirmUpdate] = useState(false);
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
  const { isActiveRide, ridingDiet, preRideCompact, hideEditActions, hideStopsList, lockStopEditing } =
    dockUi;

  const [prevIsActiveRide, setPrevIsActiveRide] = useState(isActiveRide);
  if (isActiveRide !== prevIsActiveRide) {
    setPrevIsActiveRide(isActiveRide);
    if (dockUi.autoCollapse) {
      setExpanded(false);
      setSaveOpen(false);
    }
  }

  const autoExpandKey = `${visible}:${stops.length}:${isActiveRide}:${stage}`;
  const [prevAutoExpandKey, setPrevAutoExpandKey] = useState(autoExpandKey);
  if (autoExpandKey !== prevAutoExpandKey) {
    setPrevAutoExpandKey(autoExpandKey);
    if (visible && stops.length > 0 && !isActiveRide) setExpanded(true);
    // 경로를 모두 지워 첫 화면으로 돌아오면 다시 접는다
    else if (stage === "idle" && stops.length === 0) setExpanded(false);
  }

  async function commitSave(confirmUpdate = false) {
    if (saveBusy) return;
    let normalizedName: string;
    try {
      normalizedName = validateSavedRouteName(saveDraft);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSaveBusy(true);
    setSaveError(null);
    try {
      await onSaveCurrentRoute(normalizedName, confirmUpdate);
      setSaveOpen(false);
      setSaveDraft("");
      setSaveConfirmUpdate(false);
    } catch (e) {
      // 미완료 쿼터 초과: 인라인 에러 대신 저장 폼을 닫고 「내 경로」 대기 탭으로 유도한다.
      if (isIncompleteQuotaError(e)) {
        setSaveOpen(false);
        setSaveDraft("");
        setSaveConfirmUpdate(false);
        setSaveError(null);
        onIncompleteQuotaBlocked?.(e.message);
      } else if (
        // 같은 경로가 이미 있으면 "업데이트하시겠습니까?" 확인을 띄운다.
        e && typeof e === "object" && (e as { code?: string }).code === "saved-route-duplicate"
      ) {
        setSaveConfirmUpdate(true);
      } else {
        setSaveError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSaveBusy(false);
    }
  }
  if (!visible) return null;

  /*
   * 주행 중 접힘(20260923-minimap 지시01 §3): 센서 칩(텍스트)을 빼고 캐럿 폭만 남긴다.
   * LED 는 셰브런 자리에. 펼치면 칩+셰브런 복귀. 주행 전 접힘에서는 칩을 유지
   * (센서 설정 입구 — sensorChipSlot 2026-09-16 사고).
   */
  const rideCollapsed = isActiveRide && !expanded;
  const showSensorChip = Boolean(cadence) && !rideCollapsed;
  const caretSensorView = cadence && rideCollapsed ? cadenceChipView(cadence.state, true) : null;
  const caretAriaLabel = expanded
    ? "경로 패널 접기"
    : caretSensorView
      ? `경로 패널 펼치기 · ${caretSensorView.ariaLabel}`
      : "경로 패널 펼치기";

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}${
        rideCollapsed ? " route-dock-anchor--ride-collapsed" : ""
      }`}
      aria-label="경로 설정"
    >
      <div className="route-dock__shell">
        <button
          type="button"
          className="route-dock__caret hud-glass"
          aria-expanded={expanded}
          aria-label={caretAriaLabel}
          title={expanded ? "접기" : "펼치기"}
          onClick={() => setExpanded((v) => !v)}
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
          첫 행 — **접히는 본문 바깥**. 센서 칩이 왼쪽에 앉고 Go·저장·삭제가 그 오른쪽.
          「경로(caret) → 센서 → Go」가 한 줄로 읽힌다.
          칩을 세로로 세우지 않는 이유: 전용 컬럼을 만들면 그 아래가 통째로 빈 채
          dock 폭만 넓어져 지도를 더 가린다(2026-09-16 Chief 지적).
          헤더를 `route-dock__panel` 안에 두지 않는 이유: 주행 중 자동 접힘 상태에서
          칩까지 같이 사라져 rpm·연결 신호가 끊긴다(지시서 §3.1).
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
        {expanded && !ridingDiet ? (
          <header className="route-dock__head">
          {!hideEditActions ? (
            <div className="route-dock__head-actions">
              {!saveOpen ? (
                <button
                  type="button"
                  className="route-dock__save-trigger"
                  disabled={!canSaveRoute || editLocked}
                  title="Save as my route"
                  onClick={() => {
                    setSaveError(null);
                    setSaveDraft("");
                    setSaveOpen(true);
                  }}
                >
                  내 경로로 저장
                </button>
              ) : null}
              <button
                type="button"
                className="route-dock__icon-btn"
                disabled={editLocked || stops.length === 0}
                aria-label="경로 전체 삭제"
                title="경로 전체 삭제"
                onClick={onClearRoute}
              >
                삭제
              </button>
            </div>
          ) : null}
          {/* Go 는 줄의 **오른쪽 끝** — SENSOR 바로 옆에 붙이지 않는다(2026-09-18 Chief).
              CSS order 대신 DOM 순서를 옮겨 키보드 순서도 보이는 대로 간다. */}
          {stage === "ready-to-start" ? (
            <button
              type="button"
              className="route-dock__go"
              disabled={!canStartRide || routeLoading || editLocked}
              aria-label="주행 시작"
              title="Start ride"
              onClick={() => onStartRide(restartFromZero)}
            >
              Go
            </button>
          ) : null}
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
          </div>
        ) : null}

        {!ridingDiet && !preRideCompact && saveOpen ? (
          <div className="route-dock__save-form">
            <div className="route-dock__save-head">
              <label className="route-dock__save-label" htmlFor="route-dock-save-name">
                경로 이름
              </label>
              <div className="route-dock__save-actions">
                <button
                  type="button"
                  className="route-dock__save-commit"
                  disabled={saveBusy}
                  title="경로 저장"
                  onClick={() => void commitSave()}
                >
                  {saveBusy ? "저장 중…" : "저장"}
                </button>
                <button
                  type="button"
                  className="route-dock__save-cancel"
                  disabled={saveBusy}
                  title="저장 취소"
                  onClick={() => {
                    setSaveOpen(false);
                    setSaveDraft("");
                    setSaveError(null);
                  }}
                >
                  취소
                </button>
              </div>
            </div>
            <input
              id="route-dock-save-name"
              className="route-dock__save-input"
              type="text"
              maxLength={SAVED_ROUTE_NAME_MAX}
              value={saveDraft}
              placeholder="예: 한강"
              autoFocus
              onChange={(e) => setSaveDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitSave();
                if (e.key === "Escape") {
                  setSaveOpen(false);
                  setSaveDraft("");
                  setSaveError(null);
                }
              }}
            />
            {saveError ? (
              <p className="route-dock__save-error" role="alert">
                {saveError}
              </p>
            ) : null}
            {saveConfirmUpdate ? (
              <div className="route-dock__save-confirm" role="alertdialog">
                <p className="route-dock__save-confirm-msg">
                  저장된 경로 — 업데이트할까요?
                </p>
                <div className="route-dock__save-actions">
                  <button
                    type="button"
                    className="route-dock__save-commit"
                    disabled={saveBusy}
                    title="Update existing"
                    onClick={() => void commitSave(true)}
                  >
                    {saveBusy ? "업데이트 중…" : "예 · 업데이트"}
                  </button>
                  <button
                    type="button"
                    className="route-dock__save-cancel"
                    disabled={saveBusy}
                    title="Keep previous"
                    onClick={() => setSaveConfirmUpdate(false)}
                  >
                    아니오 · 유지
                  </button>
                </div>
              </div>
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
