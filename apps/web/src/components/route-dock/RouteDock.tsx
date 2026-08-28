import { useEffect, useState } from "react";
import type { RideUiStage } from "../../hooks/useRideUiStage";
import { SAVED_ROUTE_NAME_MAX, validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
import type { RouteDockStop, RouteDockStopId } from "./useRouteDockStops";
import "./RouteDock.css";

export type RouteDockProps = {
  stage: RideUiStage;
  stops: RouteDockStop[];
  routeLoading: boolean;
  canStartRide: boolean;
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
    canSaveRoute,
    onSaveCurrentRoute,
    onStartRide,
    resumeRatio = null,
    onClearRoute,
    onRemoveStop,
    onFocusStop,
    editLocked = false,
    onIncompleteQuotaBlocked,
  } = props;

  const visible = stage === "setup" || stage === "ready-to-start" || stage === "riding" || stage === "paused";
  const [expanded, setExpanded] = useState(true);
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

  useEffect(() => {
    if (visible && stops.length > 0) setExpanded(true);
  }, [visible, stops.length]);

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

  /**
   * 주행이 시작돼도 패널을 자동 축소하지 않는다 — 출발·도착 주소를 계속 보여준다.
   * (이전엔 주행 중 헤더·경유지 목록을 숨기고 속도 슬라이더만 남겼음: "운동 축 다이어트")
   */
  const ridingDiet = false;

  return (
    <div
      className={`route-dock-anchor${expanded ? " route-dock-anchor--open" : ""}`}
      aria-label="경로 설정"
    >
      <div className="route-dock__shell">
        <button
          type="button"
          className="route-dock__caret hud-glass"
          aria-expanded={expanded}
          aria-label={expanded ? "경로 패널 접기" : "경로 패널 펼치기"}
          title={expanded ? "접기" : "펼치기"}
          onClick={() => setExpanded((v) => !v)}
        >
          <span className="route-dock__caret-name" aria-hidden>
            경로
          </span>
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
        </button>

        <div
          className="route-dock__panel hud-glass"
          hidden={!expanded}
          aria-hidden={!expanded}
        >
        {!ridingDiet ? (
          <header className="route-dock__head">
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
          </header>
        ) : null}

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

        {!ridingDiet && saveOpen ? (
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

        {!ridingDiet ? (
          <ul className="route-dock__stops" role="list">
            {stops.length === 0 ? (
              <li className="route-dock__stops-empty">지도를 탭해 출발·도착 설정</li>
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
                    disabled={editLocked}
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
  );
}
