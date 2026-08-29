import { useState } from "react";
import { validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
import { progressPercentLabel, type RideEndResult } from "../../lib/rideEndResult";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  distanceKm: string;
  avgKmh: string;
  caloriesEstimate: number;
  /** Conquest — 「새 도로 +N km」 한 줄. CF 집계 완료 시 반응형 갱신, null=없음/집계 전 */
  conquestLine?: string | null;
  /**
   * 종료 결과(§3.5) — 모든 유효 Ride 가 채운다. 미완주면 이전→신규 진행률을,
   * 완주·ad-hoc·Publication Ride 면 다음 출발점을 보여 준다. null 이면 진행·출발점 블록만 생략.
   */
  result?: RideEndResult | null;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
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
};

/**
 * 주행 종료 후 하단 시트.
 * - 도착 여부·ad-hoc 여부로 노출을 제한하지 않는다 — 폐기되지 않은 **모든 유효 Ride** 가 연다(§3.5).
 * - 미완주면 「전체 진행 31% → 43%」, 완주면 「경로를 완주했습니다」, 그리고 다음 출발점을 알린다.
 * - ad-hoc 저장은 **보조** 액션이다. 저장하지 않아도 다음 출발점은 남으므로 경고하지 않는다.
 */
export function RideSummarySheet(props: RideSummarySheetProps) {
  const suggested = props.suggestedName ?? "";
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 같은 경로가 이미 있어 "업데이트하시겠습니까?" 확인을 기다리는 중. */
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  // 제안 이름이 갱신되면(지명 비동기 도착 등), 사용자가 아직 손대지 않은 경우에만 따라간다.
  // effect 대신 이전 값과 비교(React 권장) — 편집 중 덮어쓰기·불필요 리렌더 회피.
  const [prevSuggested, setPrevSuggested] = useState(suggested);
  if (suggested !== prevSuggested) {
    setPrevSuggested(suggested);
    if (name === prevSuggested) setName(suggested);
  }

  if (!props.open) return null;

  const result = props.result ?? null;
  const routeCompleted = Boolean(result?.routeCompleted);
  /** 미완주 저장 경로 주행 — 이전→신규 진행률을 보여 줄 수 있는 경우 */
  const showProgressLine = Boolean(result && result.savedRouteId && !routeCompleted);
  const hasNextStart = Boolean(result?.anchorLngLat);

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
      // 미완료 쿼터 초과: 시트를 닫고 「내 경로」 대기 탭으로 유도(상위에서 처리).
      if (isIncompleteQuotaError(e)) {
        setName("");
        setConfirmingUpdate(false);
        setError(null);
        props.onIncompleteQuotaBlocked?.(e.message);
      } else if (
        // 같은 경로가 이미 있으면 "업데이트하시겠습니까?" 확인을 띄운다.
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
        {hasNextStart ? (
          <p className="ride-summary__nextstart">다음 출발점이 저장되었습니다</p>
        ) : null}

        {props.conquestLine ? (
          <p className="ride-summary__conquest" role="status" aria-live="polite">
            ⚑ {props.conquestLine}
          </p>
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
              「지금 닫으면 잃는다」 경고는 제거했다(§3.5).
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
