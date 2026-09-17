import { useState, useEffect, useRef } from "react";
import { validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
import { progressPercentLabel, type RideEndResult } from "../../lib/rideEndResult";
import { useRideConquestResult } from "../../hooks/useRideConquestResult";
import { getRideSaveStatusLabel, getSavedRouteProgressStatusLabel } from "../../lib/rideStatusCopy";
import { formatNewRoadHero, formatConquestStatusCopy } from "../../lib/rideSessionPreview";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  avgKmh: string;
  caloriesEstimate: number;
  /**
   * 종료 결과(§3.5) — 모든 유효 Ride 가 채운다. 미완주면 이전→신규 진행률을 보여 준다.
   * null 이면 진행률 배지만 생략.
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
  /** 미완료 쿼터 초과로 저장이 막혔을 때 상위에 알림(→ 시트 닫고 「내 경로」 대기 탭 유도) */
  onIncompleteQuotaBlocked?: (message: string) => void;
  /**
   * RIDE-CLAIM-RESULT-1: 이미 로드된 내 도로망 geometries.
   * 세션 bounds 클리핑은 preview lib 에서 수행. 새 조회 없음.
   */
};

/**
 * 주행 종료 후 하단 시트.
 * - 도착 여부·ad-hoc 여부로 노출을 제한하지 않는다 — 폐기되지 않은 **모든 유효 Ride** 가 연다(§3.5).
 * - 컴팩트 4행 구성: 헤더 → 2열 히어로(새 도로 + 오늘, 완주/진행률 배지) → 보조 수치(+저장 상태) → 저장 폼.
 *   스크롤 없이 가로 폰 화면 한 장에 들어가야 한다.
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

  // RIDE-CLAIM-RESULT-1: 새 도로 conquest 표시 로직
  const newRoadHero = formatNewRoadHero(conquestResult.newMeters, conquestResult.status);
  const conquestStatusCopy = formatConquestStatusCopy(
    conquestResult.status,
    isDelayed,
    isTimedOut,
  );

  // 저장 중(serverRideId 없음)이면 conquest hero 블록을 표시하지 않음
  const showConquestBlock = Boolean(result);
  /*
   * 내용이 실제로 있을 때만 새 도로 칸을 연다. `confirmed_zero`(새 도로 0m 확정)에서는
   * hero 도 statusCopy 도 null 이라, 설명문을 걷어낸 뒤로는 **테두리만 남은 빈 박스**가 됐다.
   * 「0 은 노출하지 않는다」는 기존 결정(50m 미만 미표시)을 뒤집지 않으려면 숫자를 채울 게
   * 아니라 칸 자체를 접는 것이 맞다 — 그러면 「오늘」이 1열로 자리를 넓혀 쓴다.
   */
  const hasConquestContent = showConquestBlock && Boolean(newRoadHero || conquestStatusCopy);
  /*
   * 「이번 주행」 세 값 — 주행거리 / 총거리 / 새 도로(2026-09-17 Chief).
   * 「오늘」(하루 누적)은 이 화면이 답할 질문이 아니다. 단위 km 는 헤더가 한 번만 말하고
   * 숫자에는 붙이지 않는다.
   *
   * 주행거리는 **경로상 누적 위치**다(세션 거리가 아니다, Chief 확정). 이어달리기로 경로
   * 중간부터 재개해 끝낸 경우에도 「완주 = 0.50 / 0.50」 이 성립해야 하고, 주행 중 상단
   * 계기판이 보여 주던 「누적 / 전체」와 같은 숫자여야 화면이 이어지기 때문이다.
   */
  const routeTotalKmNum = result ? result.routeDistanceMeters / 1000 : null;
  const riddenKmNum =
    result && Number.isFinite(result.progressRatio)
      ? (result.routeDistanceMeters * Math.max(0, Math.min(1, result.progressRatio))) / 1000
      : null;
  const distancePair =
    routeTotalKmNum != null && riddenKmNum != null && routeTotalKmNum > 0
      ? `${riddenKmNum.toFixed(2)} / ${routeTotalKmNum.toFixed(2)}`
      : null;

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
            {/* 단위는 여기서 한 번만 — 아래 숫자들엔 붙이지 않는다(2026-09-17 Chief) */}
            <span className="ride-summary__title-unit">km</span>
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

        {/* §3.1 2열 히어로 — 거리(주행/전체) + 새 도로(골드/보라 강조), 우측에 완주/진행률 배지 */}
        <div className="ride-summary__heroes">
          <div
            className={
              hasConquestContent && distancePair
                ? "ride-summary__heroes-main"
                : "ride-summary__heroes-main ride-summary__heroes-main--solo"
            }
          >
            {distancePair ? (
              <div className="ride-summary__hero">
                <span className="ride-summary__hero-k">거리</span>
                <strong className="ride-summary__hero-v" aria-label="주행 거리 / 경로 전체거리">
                  {distancePair}
                </strong>
              </div>
            ) : null}

            {hasConquestContent ? (
              <div className="ride-summary__conquest-hero" aria-live="polite">
                {newRoadHero ? (
                  <>
                    <div className="ride-summary__conquest-label">새 도로</div>
                    <strong className="ride-summary__conquest-value">{newRoadHero}</strong>
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
                ) : null}
              </div>
            ) : null}
          </div>

          {routeCompleted ? (
            <span className="ride-summary__heroes-badge ride-summary__heroes-badge--done">
              완주
            </span>
          ) : showProgressLine && result ? (
            <span className="ride-summary__heroes-badge" aria-label="전체 진행">
              {progressPercentLabel(result.previousProgressRatio)}% →{" "}
              {progressPercentLabel(result.progressRatio)}%
            </span>
          ) : null}
        </div>

        <div className="ride-summary__substats">
          <span className="ride-summary__substat">{props.elapsedLabel}</span>
          <span className="ride-summary__substat">{props.avgKmh} km/h</span>
          <span className="ride-summary__substat">{props.caloriesEstimate} kcal</span>
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

        {props.adhocSaveAvailable ? (
          <>
            {/*
              ad-hoc 저장은 보조 액션이다 — 저장하지 않아도 Ride 기록과 다음 출발점은 남는다.
              입력창 + 버튼 2개를 한 행으로 — 690px 가로 기준 한 줄, 좁으면 flex-wrap 으로 대응.
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
