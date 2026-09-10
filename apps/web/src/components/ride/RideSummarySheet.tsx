import { useState, useEffect, useRef } from "react";
import { validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
import { progressPercentLabel, type RideEndResult } from "../../lib/rideEndResult";
import { useRideConquestResult } from "../../hooks/useRideConquestResult";
import { getRideSaveStatusLabel, getSavedRouteProgressStatusLabel } from "../../lib/rideStatusCopy";
import {
  formatNewRoadHero,
  formatNewRoadSubtitle,
  formatConquestStatusCopy,
} from "../../lib/rideSessionPreview";
import { RideSessionTracePreview } from "./RideSessionTracePreview";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  distanceKm: string;
  avgKmh: string;
  caloriesEstimate: number;
  /**
   * 종료 결과(§3.5) — 모든 유효 Ride 가 채운다. 미완주면 이전→신규 진행률을,
   * 완주·ad-hoc·Publication Ride 면 다음 출발점을 보여 준다. null 이면 진행·출발점 블록만 생략.
   */
  result?: RideEndResult | null;
  /** F3: 현재 로그인 사용자 uid (conquest result ownership 체크) */
  userId?: string | null;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
  /** 미완주 SavedRoute — 전체 진행률 변화(이전→이번) */
  savedRouteProgress?: {
    fromPct: number;
    toPct: number;
    routeName: string | null;
  } | null;
  /** 저장 길이 제한 */
  maxNameLength: number;
  /** 자동 제안 이름(출발→도착·거리) — 입력란 초기값으로 미리 채운다. 지명 비동기 도착 시 갱신될 수 있음 */
  suggestedName?: string;
  onSaveAdhoc: (name: string, confirmUpdate?: boolean) => Promise<void> | void;
  onDismissAdhoc: () => void;
  onClose: () => void;
  /** 마지막 종료 지점에서 새 Route 연결 — 시트를 닫고 출발점을 고정한다 */
  onExtendFromEnd?: () => void;
  /** 미완료 쿼터 초과로 저장이 막혔을 때 상위에 알림(→ 시트 닫고 「내 경로」 대기 탭 유도) */
  onIncompleteQuotaBlocked?: (message: string) => void;
  /**
   * RIDE-CLAIM-RESULT-1: 이미 로드된 내 도로망 geometries.
   * 세션 bounds 클리핑은 preview lib 에서 수행. 새 조회 없음.
   */
  conquestTraceGeometries?: Array<{ type: string; coordinates: number[][] }> | null;
};

/**
 * 주행 종료 후 하단 시트.
 * - 도착 여부·ad-hoc 여부로 노출을 제한하지 않는다 — 폐기되지 않은 **모든 유효 Ride** 가 연다(§3.5).
 * - §3.1 순서: 새 도로 hero → SVG 미리보기 → 오늘 통계 → 진행률 → 다음 출발점 → CTA
 */
export function RideSummarySheet(props: RideSummarySheetProps) {
  const suggested = props.suggestedName ?? "";
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 같은 경로가 이미 있어 "업데이트하시겠습니까?" 확인을 기다리는 중. */
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  // RIDE-CLAIM-RESULT-1: UI-level delay/timeout tracking (15s delayed, 60s timed-out)
  const [isDelayed, setIsDelayed] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // F3: rides/{serverRideId}.conquestResult 구독
  const result = props.result ?? null;
  const conquestResult = useRideConquestResult({
    serverRideId: result?.serverRideId,
    userId: props.userId,
    localRecordId: result?.recordId ?? "",
  });

  // UI delay 타이머 — serverRideId 가 바뀔 때만 재시작한다.
  // positive/confirmed_zero 에서는 formatConquestStatusCopy 가 null 을 반환하므로
  // isDelayed/isTimedOut 값이 있어도 UI 에 노출되지 않는다.
  const serverRideId = result?.serverRideId;

  useEffect(() => {
    if (!serverRideId) return;

    // 15초 → delayed (타이머 콜백에서 setState — 비동기, 허용됨)
    const t15 = setTimeout(() => setIsDelayed(true), 15000);
    // 60초 → timed out
    const t60 = setTimeout(() => setIsTimedOut(true), 60000);
    delayTimerRef.current = t15;
    timeoutTimerRef.current = t60;
    return () => {
      clearTimeout(t15);
      clearTimeout(t60);
      // cleanup 에서의 setState 는 허용됨 — serverRideId 변경 시 상태 초기화
      setIsDelayed(false);
      setIsTimedOut(false);
    };
  }, [serverRideId]);

  // R2: F4 persistence status (independent axes)
  const rideSaveStatus = result?.rideSaveStatus ?? "n/a";
  const savedRouteProgressStatus = result?.savedRouteProgressStatus ?? "n/a";

  // 제안 이름이 갱신되면(지명 비동기 도착 등), 사용자가 아직 손대지 않은 경우에만 따라간다.
  const [prevSuggested, setPrevSuggested] = useState(suggested);
  if (suggested !== prevSuggested) {
    setPrevSuggested(suggested);
    if (name === prevSuggested) setName(suggested);
  }

  if (!props.open) return null;

  const routeCompleted = Boolean(result?.routeCompleted);
  /** 미완주 저장 경로 주행 — 이전→신규 진행률을 보여 줄 수 있는 경우 */
  const showProgressLine = Boolean(result && result.savedRouteId && !routeCompleted);
  const hasNextStart = Boolean(result?.anchorLngLat);

  // RIDE-CLAIM-RESULT-1: 새 도로 conquest 표시 로직
  const newRoadHero = formatNewRoadHero(conquestResult.newMeters, conquestResult.status);
  const newRoadSubtitle = formatNewRoadSubtitle(conquestResult.newMeters, conquestResult.status);
  const conquestStatusCopy = formatConquestStatusCopy(
    conquestResult.status,
    isDelayed,
    isTimedOut,
  );

  // 저장 중(serverRideId 없음)이면 conquest hero 블록을 표시하지 않음
  const showConquestBlock = Boolean(result);

  function requestClose() {
    if (busy) return;
    props.onClose();
  }

  async function commitSave(confirmUpdate = false) {
    if (busy) return;
    let normalized: string;
    try {
      normalized = validateSavedRouteName(name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await props.onSaveAdhoc(normalized, confirmUpdate);
      setName("");
      setConfirmingUpdate(false);
    } catch (e) {
      if (isIncompleteQuotaError(e)) {
        setName("");
        setConfirmingUpdate(false);
        setError(null);
        props.onIncompleteQuotaBlocked?.(e.message);
      } else if (
        e && typeof e === "object" && (e as { code?: string }).code === "saved-route-duplicate"
      ) {
        setConfirmingUpdate(true);
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ride-summary" role="region" aria-label="주행 결과">
      <button
        type="button"
        className="ride-summary__scrim"
        aria-label="닫기"
        title="Close"
        onClick={requestClose}
      />
      <div className="ride-summary__sheet" role="dialog" aria-labelledby="ride-summary-title">
        <div className="ride-summary__handle" aria-hidden />
        <div className="ride-summary__head">
          <h2 id="ride-summary-title" className="ride-summary__title">
            주행 결과
          </h2>
          {props.arrivalCompleted || routeCompleted ? (
            <span className="ride-summary__badge">도착</span>
          ) : null}
          <button
            type="button"
            className="ride-summary__close"
            title="Close"
            aria-label="닫기"
            onClick={requestClose}
          >
            닫기
          </button>
        </div>

        {/* §3.1 새 도로 hero (conquest 결과) */}
        {showConquestBlock ? (
          <div className="ride-summary__conquest-hero" aria-live="polite">
            {newRoadHero ? (
              <>
                <div className="ride-summary__conquest-label">새 도로</div>
                <strong className="ride-summary__conquest-value">{newRoadHero}</strong>
                {newRoadSubtitle ? (
                  <p className="ride-summary__conquest-subtitle">{newRoadSubtitle}</p>
                ) : null}
              </>
            ) : conquestStatusCopy ? (
              <p className="ride-summary__conquest-status">
                {conquestStatusCopy}
                {isTimedOut ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="ride-summary__conquest-retry"
                      onClick={() => {
                        setIsDelayed(false);
                        setIsTimedOut(false);
                        // 구독 재활성화: serverRideId key 가 변하지 않으므로 localRecordId 를 통해 hook 이 재구독
                        // RideConquestSubscription 은 같은 key에 activate()를 재호출하면 재구독한다
                        // 이를 트리거하기 위해 result key 를 강제 re-subscribe 할 수 없으므로
                        // 15/60s timer 만 초기화한다 — 실제 Firestore 재구독은 hook 의 서버 ID 변경 없이는 불가.
                        // BLOCK: useRideConquestResult hook 에 forceRetry() API 가 없으므로
                        // 이 "다시 확인" 버튼은 타이머 상태만 초기화. 추후 hook에 재구독 신호 추가 필요.
                      }}
                    >
                      다시 확인
                    </button>
                  </>
                ) : null}
              </p>
            ) : newRoadSubtitle ? (
              <p className="ride-summary__conquest-subtitle">{newRoadSubtitle}</p>
            ) : null}
          </div>
        ) : null}

        {/* §3.2 SVG 미리보기 */}
        {result?.sessionPathLngLat ? (
          <RideSessionTracePreview
            sessionPathLngLat={result.sessionPathLngLat}
            conquestTraces={props.conquestTraceGeometries}
          />
        ) : null}

        {/* 오늘 거리 hero (기존 스타일 유지, 보조로 이동) */}
        <div className="ride-summary__hero">
          <span className="ride-summary__hero-k">오늘</span>
          <strong className="ride-summary__hero-v">{props.distanceKm} km</strong>
        </div>

        <div className="ride-summary__substats">
          <span className="ride-summary__substat">{props.elapsedLabel}</span>
          <span className="ride-summary__substat">{props.avgKmh} km/h</span>
          <span className="ride-summary__substat">{props.caloriesEstimate} kcal</span>
        </div>

        {showProgressLine && result ? (
          <p className="ride-summary__progress" aria-label="전체 진행">
            전체 진행 {progressPercentLabel(result.previousProgressRatio)}% →{" "}
            <strong>{progressPercentLabel(result.progressRatio)}%</strong>
          </p>
        ) : null}
        {routeCompleted ? (
          <p className="ride-summary__progress">경로를 완주했습니다</p>
        ) : null}
        {/* Codex -02 Fix 2: 다음 출발점 저장 성공 시에만 표시 (rideSaveStatus 기준) */}
        {hasNextStart && rideSaveStatus === "success" ? (
          <p className="ride-summary__nextstart">다음 출발점이 저장되었습니다</p>
        ) : null}

        {/* R2: F4 persistence status (independent axes) */}
        {rideSaveStatus !== "n/a" || savedRouteProgressStatus !== "n/a" ? (
          <div className="ride-summary__status" aria-live="polite">
            {getRideSaveStatusLabel(rideSaveStatus) != null ? (
              <span
                className={`ride-summary__status-item ride-summary__status-item--${rideSaveStatus}`}
              >
                {getRideSaveStatusLabel(rideSaveStatus)}
              </span>
            ) : null}
            {getSavedRouteProgressStatusLabel(savedRouteProgressStatus) != null ? (
              <span
                className={`ride-summary__status-item ride-summary__status-item--${savedRouteProgressStatus}`}
              >
                {getSavedRouteProgressStatusLabel(savedRouteProgressStatus)}
              </span>
            ) : null}
          </div>
        ) : null}

        {hasNextStart && props.onExtendFromEnd ? (
          <div className="ride-summary__form-btns ride-summary__form-btns--next">
            <button
              type="button"
              className="ride-summary__btn ride-summary__btn--primary"
              title="New route from here"
              disabled={busy}
              onClick={props.onExtendFromEnd}
            >
              {routeCompleted ? "끝점에서 새 경로" : "지금 새 경로 연결"}
            </button>
          </div>
        ) : null}

        {props.adhocSaveAvailable ? (
          <>
            {/*
              ad-hoc 저장은 보조 액션이다 — 저장하지 않아도 Ride 기록과 다음 출발점은 남는다.
            */}
            <div className="ride-summary__form">
              <input
                type="text"
                className="ride-summary__input"
                placeholder={`경로 이름 (최대 ${props.maxNameLength}자)`}
                maxLength={props.maxNameLength}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="ride-summary__form-btns">
                <button
                  type="button"
                  className="ride-summary__btn ride-summary__btn--ghost"
                  title="Save to my routes"
                  onClick={() => void commitSave()}
                  disabled={busy}
                >
                  {busy ? "저장 중…" : "내 경로로 저장"}
                </button>
                <button
                  type="button"
                  className="ride-summary__btn ride-summary__btn--ghost"
                  title="Skip saving"
                  onClick={props.onDismissAdhoc}
                  disabled={busy}
                >
                  저장 안 함
                </button>
              </div>
            </div>
            {error ? <p className="ride-summary__err">{error}</p> : null}

            {confirmingUpdate ? (
              <div className="ride-summary__confirm" role="alertdialog" aria-live="assertive">
                <p className="ride-summary__confirm-msg">
                  저장된 경로 — 업데이트할까요?
                </p>
                <div className="ride-summary__form-btns">
                  <button
                    type="button"
                    className="ride-summary__btn ride-summary__btn--primary"
                    onClick={() => void commitSave(true)}
                    disabled={busy}
                  >
                    {busy ? "업데이트 중…" : "예 · 업데이트"}
                  </button>
                  <button
                    type="button"
                    className="ride-summary__btn ride-summary__btn--ghost"
                    onClick={() => setConfirmingUpdate(false)}
                    disabled={busy}
                  >
                    아니오 · 유지
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
