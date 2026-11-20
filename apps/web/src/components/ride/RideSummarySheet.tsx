import { useState, useEffect, useRef } from "react";
import { validateSavedRouteName } from "../../lib/route/repo/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/account/tierQuota";
import { progressPercentLabel, type RideEndResult } from "../../lib/ride/rideEndResult";
import { useRideConquestResult } from "../../hooks/useRideConquestResult";
import type { RideConquestResult } from "../../lib/ride/rideConquestResult";
import { getRideSaveStatusLabel, getSavedRouteProgressStatusLabel } from "../../lib/ride/rideStatusCopy";
import { formatNewRoadHero, formatConquestStatusCopy } from "../../lib/ride/rideSessionPreview";
import { formatCaloriesEstimateLabel } from "../../lib/ride/caloriesEstimate";
import type { RideStory } from "../../lib/ride/rideStory";
import { formatRideIntervalClock } from "../../lib/ride/rideInterval";
import type { IntervalWorkoutRecord } from "../../lib/ride/intervalWorkout";
import type { RideRankChangeLine } from "../leaderboard/leaderboardLiveRank";

import { useDialogFocus } from "../ui/useDialogFocus";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  riderName?: string;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  avgKmh: string;
  /** null = 미산정. result.caloriesEstimate 가 있으면 그쪽 우선 */
  caloriesEstimate: number | null;
  /**
   * 주행 스토리(2026-10-07 Chief) — 숫자보다 먼저 사람에게 건네는 한 줄 + 사실 한 줄.
   * null 이면 줄을 그리지 않는다.
   */
  story?: RideStory | null;
  /** 미산정 시 체중·체력 설정 진입 */
  onOpenCalorieSettings?: () => void;
  /**
   * 체중·체력이 이미 저장돼 있으면 미산정(센서 없음 등)이어도 설정 버튼을 띄우지 않는다 —
   * 주행마다 다시 묻지 않기(2026-10-08 Chief).
   */
  calorieProfileComplete?: boolean;
  /**
   * 게스트일 때만 — Google 연결(등록) 권유(2026-10-09 Chief: 게스트는 짧고 강한 경험 뒤 등록으로).
   * 주행 직후가 가장 강한 순간이다. 연결은 같은 uid 를 유지하므로 이번 주행·내 도로망이 그대로 남는다.
   */
  onGuestLinkGoogle?: () => void;
  /**
   * 종료 결과(§3.5) — 모든 유효 Ride 가 채운다. 미완주면 이전→신규 진행률을 보여 준다.
   * null 이면 진행률 배지만 생략.
   */
  result?: RideEndResult | null;
  /** F3: 현재 로그인 사용자 uid (conquest result ownership 체크) */
  userId?: string | null;
  /** 최근 신규 도로 임시 강조를 서버 판정과 연결한다. */
  onConquestResult?: (recordId: string, result: RideConquestResult) => void;
  /** conquestResult 구독이 60초 timeout 된 경우 최근 강조를 제거한다. */
  onConquestTimeout?: (recordId: string) => void;
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
  /** 미완료 쿼터 초과로 저장이 막혔을 때 상위에 알림(→ 시트 닫고 「내 경로」 대기 탭 유도) */
  onIncompleteQuotaBlocked?: (message: string) => void;
  /** 이번 주 순위 변화 한 줄 — 탭하면 큰 리더보드 */
  rankChange?: RideRankChangeLine | null;
  onOpenLeaderboard?: () => void;
  /** 사용자가 느낀 강도. workoutId 는 이 주행 안의 개별 인터벌 수행 ID다. */
  onIntervalFeedback?: (workoutId: string, effort: "easier" | "as-planned" | "harder") => void | Promise<void>;
  /**
   * RIDE-CLAIM-RESULT-1: 이미 로드된 내 도로망 geometries.
   * 세션 bounds 클리핑은 preview lib 에서 수행. 새 조회 없음.
   */
};

/** 종료 평가를 다른 주행에 승계하지 않도록 상위에서 recordId를 key로 준다. */
function IntervalWorkoutSummary({ workouts, onFeedback }: {
  workouts: IntervalWorkoutRecord[];
  onFeedback?: RideSummarySheetProps["onIntervalFeedback"];
}) {
  const [feedback, setFeedback] = useState<"easier" | "as-planned" | "harder" | null>(() => workouts[workouts.length - 1]?.feedback ?? null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const meaningful = workouts.filter((workout) => workout.elapsedSec > 0);
  if (meaningful.length === 0) return null;
  const completed = meaningful.filter((workout) => workout.status === "completed").length;
  const elapsedSec = meaningful.reduce((sum, workout) => sum + workout.elapsedSec, 0);
  const knownCalories = meaningful.filter((workout) => workout.caloriesEstimate != null);
  const calories = knownCalories.reduce((sum, workout) => sum + workout.caloriesEstimate!, 0);
  const lastWorkout = meaningful[meaningful.length - 1]!;
  const submitFeedback = async (effort: "easier" | "as-planned" | "harder") => {
    if (!onFeedback || feedbackBusy) return;
    const previous = feedback;
    setFeedback(effort);
    setFeedbackBusy(true);
    setFeedbackError(false);
    try {
      await onFeedback(lastWorkout.id, effort);
    } catch {
      setFeedback(previous);
      setFeedbackError(true);
    } finally {
      setFeedbackBusy(false);
    }
  };
  return (
    <section className="ride-summary__interval" aria-label="인터벌 수행 결과">
      <p className="ride-summary__interval-result">
        <strong>인터벌</strong><span>프로그램 완료 {completed}/{meaningful.length}회 · 수행 {formatRideIntervalClock(elapsedSec)}</span>
      </p>
      <p className="ride-summary__interval-calories">
        {knownCalories.length > 0
          ? `선택 강도 기준 추정 ${Math.round(calories)} kcal${knownCalories.length < meaningful.length ? " · 일부 구간 미산정" : ""}`
          : "칼로리 미산정 · 페달 활동시간과 체중이 필요해요"}
      </p>
      {onFeedback ? (
        <fieldset className="ride-summary__interval-feedback">
          <legend>{meaningful.length > 1 ? "마지막 인터벌은 어땠나요? (선택)" : "오늘 인터벌은 어땠나요? (선택)"}</legend>
          <div>
            {([
              { id: "easier", label: "목표보다 편했어요" },
              { id: "as-planned", label: "목표와 비슷했어요" },
              { id: "harder", label: "목표보다 힘들었어요" },
            ] as const).map((option) => (
              <button key={option.id} type="button" aria-pressed={feedback === option.id} disabled={feedbackBusy}
                onClick={() => void submitFeedback(option.id)}>{option.label}</button>
            ))}
          </div>
          {feedbackBusy ? <p role="status">체감 평가를 저장하고 있어요</p> : null}
          {feedbackError ? <p role="alert">체감 평가를 저장하지 못했어요. 다시 선택해 주세요.</p> : null}
        </fieldset>
      ) : null}
    </section>
  );
}

/**
 * 주행 종료 후 하단 시트.
 * - 도착 여부·ad-hoc 여부로 노출을 제한하지 않는다 — 폐기되지 않은 **모든 유효 Ride** 가 연다(§3.5).
 * - 닉네임·주행 이야기·출발/도착 두 줄·저장 폼을 단일 열로 표시한다.
 *   수치 계기는 기존 HUD에서 유지하며, 추가 안내가 많으면 결과 창 안에서 스크롤한다.
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
  const resultRecordId = result?.recordId;
  const onConquestResult = props.onConquestResult;
  const onConquestTimeout = props.onConquestTimeout;
  const conquestResult = useRideConquestResult({
    serverRideId: result?.serverRideId,
    userId: props.userId,
    localRecordId: result?.recordId ?? "",
  });
  const latestConquestResultRef = useRef(conquestResult);
  useEffect(() => {
    latestConquestResultRef.current = conquestResult;
  }, [conquestResult]);

  useEffect(() => {
    if (!resultRecordId) return;
    onConquestResult?.(resultRecordId, conquestResult);
  }, [conquestResult, onConquestResult, resultRecordId]);

  // UI delay 타이머 — serverRideId 가 바뀔 때만 재시작한다.
  // positive/confirmed_zero 에서는 formatConquestStatusCopy 가 null 을 반환하므로
  // isDelayed/isTimedOut 값이 있어도 UI 에 노출되지 않는다.
  const serverRideId = result?.serverRideId;

  useEffect(() => {
    if (!serverRideId) return;

    // 15초 → delayed (타이머 콜백에서 setState — 비동기, 허용됨)
    const t15 = setTimeout(() => setIsDelayed(true), 15000);
    // 60초 → timed out
    const t60 = setTimeout(() => {
      setIsTimedOut(true);
      const latest = latestConquestResultRef.current.status;
      // 서버 확정 결과는 timeout이 덮어쓰지 않는다. 아직 미확정인 경우에만
      // 낙관적으로 그린 최근 도로를 정리한다.
      if (
        resultRecordId &&
        latest !== "positive" &&
        latest !== "confirmed_zero"
      ) {
        onConquestTimeout?.(resultRecordId);
      }
    }, 60000);
    delayTimerRef.current = t15;
    timeoutTimerRef.current = t60;
    return () => {
      clearTimeout(t15);
      clearTimeout(t60);
      // cleanup 에서의 setState 는 허용됨 — serverRideId 변경 시 상태 초기화
      setIsDelayed(false);
      setIsTimedOut(false);
    };
  }, [onConquestTimeout, resultRecordId, serverRideId]);

  // R2: F4 persistence status (independent axes)
  const rideSaveStatus = result?.rideSaveStatus ?? "n/a";
  const savedRouteProgressStatus = result?.savedRouteProgressStatus ?? "n/a";

  // 제안 이름이 갱신되면(지명 비동기 도착 등), 사용자가 아직 손대지 않은 경우에만 따라간다.
  const [prevSuggested, setPrevSuggested] = useState(suggested);
  if (suggested !== prevSuggested) {
    setPrevSuggested(suggested);
    if (name === prevSuggested) setName(suggested);
  }

  const onClose = props.onClose;
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialogFocus(props.open, sheetRef);
  useEffect(() => {
    if (!props.open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || busy) return;
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, props.open]);

  if (!props.open) return null;

  const routeCompleted = Boolean(result?.routeCompleted);
  /** 미완주 저장 경로 주행 — 이전→신규 진행률을 보여 줄 수 있는 경우 */
  const showProgressLine = Boolean(result && result.savedRouteId && !routeCompleted);

  const displayConquest = conquestResult.status === "none" && result?.conquest
    ? result.conquest : conquestResult;
  const newRoadHero = formatNewRoadHero(displayConquest.newMeters, displayConquest.status);
  const conquestStatusCopy = formatConquestStatusCopy(displayConquest.status, isDelayed, isTimedOut);
  const endedCopy = routeCompleted || props.arrivalCompleted ? "완주했어요." : "주행을 마쳤어요.";
  // 확정 수치를 사용한다. 확인 전에는 늘어난 거리를 단정하지 않는다.
  const headline = newRoadHero
    ? `${endedCopy} 내 도로망이 ${newRoadHero} km 더 늘어났어요.`
    : endedCopy;
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
      <div
        ref={sheetRef}
        className="ride-summary__sheet"
        role="dialog"
        aria-labelledby="ride-summary-title"
      >
        <div className="ride-summary__cols">
          <div className="ride-summary__col ride-summary__col--detail">
            <div
              className={[
                "ride-summary__head",
                props.adhocSaveAvailable ? "" : "ride-summary__head--with-close",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="ride-summary__head-left">
                <h2 id="ride-summary-title" className="ride-summary__title">
                  주행 결과

                </h2>
                {!routeCompleted && showProgressLine && result ? (
                  <span className="ride-summary__heroes-badge" aria-label="전체 진행">
                    {progressPercentLabel(result.previousProgressRatio)}% →{" "}
                    {progressPercentLabel(result.progressRatio)}%
                  </span>
                ) : null}
              </div>
              {props.riderName ? <span className="ride-summary__rider" title={props.riderName}>{props.riderName}</span> : null}
              {props.adhocSaveAvailable ? null : (
                <button
                  type="button"
                  className="ride-summary__close"
                  title="닫기"
                  aria-label="닫기"
                  onClick={requestClose}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>

        <div className="ride-summary__story" aria-live="polite">
          <p className="ride-summary__story-headline">{headline}</p>
          {conquestStatusCopy ? <p className="ride-summary__conquest-status">
            {conquestStatusCopy}
            {isTimedOut ? <button type="button" className="ride-summary__conquest-retry" onClick={() => {
              setIsDelayed(false); setIsTimedOut(false);
            }}>다시 확인</button> : null}
          </p> : null}
        </div>
        {props.rankChange && props.onOpenLeaderboard ? (
          <button
            type="button"
            className="ride-summary__rank-line"
            onClick={props.onOpenLeaderboard}
          >
            {props.rankChange.kind === "guest-projected" ? (
              <>
                회원이라면 이번 주 예상{" "}
                <strong className="ride-summary__rank-num">{props.rankChange.projectedRank}</strong>위
              </>
            ) : props.rankChange.kind === "member-change" ? (
              <>
                이번 주 순위{" "}
                <span className="ride-summary__rank-muted">{props.rankChange.beforeRank}</span>위 →{" "}
                <strong className="ride-summary__rank-num">{props.rankChange.afterRank}</strong>위
                <span className="ride-summary__rank-up">▲{props.rankChange.delta}</span>
                {props.rankChange.gapToFirstKm != null ? (
                  <span className="ride-summary__rank-gap">
                    1위까지{" "}
                    <strong className="ride-summary__rank-num-sm">
                      {props.rankChange.gapToFirstKm.toFixed(1)} km
                    </strong>
                  </span>
                ) : null}
              </>
            ) : (
              <>
                이번 주 <strong className="ride-summary__rank-num">{props.rankChange.rank}</strong>위
                그대로
                {props.rankChange.gapToFirstKm != null ? (
                  <span className="ride-summary__rank-gap">
                    1위까지{" "}
                    <strong className="ride-summary__rank-num-sm">
                      {props.rankChange.gapToFirstKm.toFixed(1)} km
                    </strong>
                  </span>
                ) : null}
              </>
            )}
          </button>
        ) : null}

        <div className="ride-summary__substats">
          {(() => {
            const kcal =
              result?.caloriesEstimate !== undefined
                ? result.caloriesEstimate
                : props.caloriesEstimate;
            const label = formatCaloriesEstimateLabel(kcal);
            const signalGap = Boolean(result?.caloriesMeta?.signalGap);
            if (kcal == null) {
              if (props.calorieProfileComplete || !props.onOpenCalorieSettings) return null;
              return (
                <span
                  className="ride-summary__substat ride-summary__substat--calorie"
                  title={props.calorieProfileComplete ? "케이던스 센서가 연결된 주행만 산정합니다" : undefined}
                >
                  <span className="ride-summary__substat-label">칼로리</span>
                  <span className="ride-summary__substat-metric">
                    {props.calorieProfileComplete ? "센서 주행 후 표시" : "체중·체력 입력 후 표시"}
                  </span>
                  {(
                    <button
                      type="button"
                      className="ride-summary__calorie-setup"
                      onClick={props.onOpenCalorieSettings}
                    >
                      체중·체력 설정
                    </button>
                  )}
                </span>
              );
            }
            return (
              <span
                className="ride-summary__substat"
                title={
                  signalGap
                    ? "추정 총 운동 에너지 · 센서 끊김 구간 미산정"
                    : "추정 총 운동 에너지"
                }
              >
                <span className="ride-summary__substat-label">칼로리</span>
                <span className="ride-summary__substat-metric">
                  추정 {label} kcal{signalGap ? " · 누락" : ""}
                </span>
              </span>
            );
          })()}
          {/* R2: F4 persistence status (independent axes) — 독립 줄 대신 보조 수치 줄에 합류 */}
          {rideSaveStatus !== "n/a" || savedRouteProgressStatus !== "n/a" ? (
            <span className="ride-summary__substat ride-summary__status" aria-live="polite">
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
            </span>
          ) : null}
        </div>

        {result?.intervalWorkouts?.length ? (
          <IntervalWorkoutSummary key={result.recordId} workouts={result.intervalWorkouts} onFeedback={props.onIntervalFeedback} />
        ) : null}

        {props.onGuestLinkGoogle ? (
          <div className="ride-summary__guest-cta" role="group" aria-label="기록 지키기">
            <span className="ride-summary__guest-cta-copy">
              회원 등록하면 이번 주행과 내 도로망이 그대로 이어지고, 다른 기기에서도 볼 수 있어요.
            </span>
            <button
              type="button"
              className="ride-summary__btn ride-summary__btn--primary ride-summary__guest-cta-btn"
              onClick={props.onGuestLinkGoogle}
            >
              Google 연결
            </button>
          </div>
        ) : null}

        {result?.hasRoute ? (
          <div className="ride-summary__route" aria-label="주행 경로">
            <div className="ride-summary__point"><span className="ride-summary__badge" aria-label="출발">S</span><span className="ride-summary__address" title={result.startPlaceLabel ?? undefined}>{result.startPlaceLabel || "출발 지점"}</span></div>
            <div className="ride-summary__point"><span className="ride-summary__badge ride-summary__badge--end" aria-label="도착">E</span><span className="ride-summary__address" title={result.endPlaceLabel ?? undefined}>{result.endPlaceLabel || "도착 지점"}</span></div>
          </div>
        ) : null}
        {props.adhocSaveAvailable ? (
          <>
            {/*
              ad-hoc 저장은 보조 액션이다 — 저장하지 않아도 Ride 기록과 다음 출발점은 남는다.
              경로명은 일반 텍스트처럼 표시하고, 화면 폭과 관계없이 저장 버튼 윗줄에 둔다.
            */}
            <div className="ride-summary__form">
              <label className="ride-summary__name-label" htmlFor="ride-summary-route-name">경로명</label>
              <input
                id="ride-summary-route-name"
                type="text"
                className="ride-summary__input"
                aria-label="저장할 경로 이름"
                title={name}
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
                {/*
                  2026-09-27 — 「저장 안 함」이 **시트를 닫는다.**
                  종전에는 저장 행만 사라지고 시트가 남아, 누른 사람이 「아무 일도 안 일어났다」고
                  느꼈다(자동 시험도 여기서 닫히기를 기다리다 죽었다). 「이 주행을 경로로 남기지
                  않는다」는 결정은 그 자체로 결말이므로, 닫는 것까지가 한 동작이다.
                  ⚠️ Ride 기록과 다음 출발점은 그대로 남는다 — 지워지는 것은 「내 경로로 저장」뿐이다.
                */}
                <button
                  type="button"
                  className="ride-summary__btn ride-summary__btn--ghost"
                  title="Skip saving and close"
                  onClick={() => {
                    props.onDismissAdhoc();
                    requestClose();
                  }}
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
      </div>
    </div>
  );
}
