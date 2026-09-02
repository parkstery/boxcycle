import { useState } from "react";
import { validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import { isIncompleteQuotaError } from "../../lib/tierQuota";
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
};

/**
 * 주행 종료 후 하단 시트.
 * - 도착 토스트(arrivalCompleted) + ad-hoc 저장 안내(adhocSaveAvailable) 를 한 곳에 통합.
 * - 닫기는 스크림 탭 또는 「닫기」 버튼.
 */
export function RideSummarySheet(props: RideSummarySheetProps) {
  const suggested = props.suggestedName ?? "";
  const [name, setName] = useState(suggested);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** ad-hoc 미저장 상태에서 닫기를 시도하면 곧바로 닫지 않고 확인을 한 번 더 받는다. */
  const [confirmingClose, setConfirmingClose] = useState(false);
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

  /** 스크림·「닫기」 공통 진입점. 저장 기회가 살아 있으면 먼저 경고를 띄운다. */
  function requestClose() {
    if (busy) return;
    if (props.adhocSaveAvailable) {
      setConfirmingClose(true);
      return;
    }
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
          {props.arrivalCompleted ? <span className="ride-summary__badge">도착</span> : null}
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

        {props.conquestLine ? (
          <p className="ride-summary__conquest" role="status" aria-live="polite">
            ⚑ {props.conquestLine}
          </p>
        ) : null}

        {props.savedRouteProgress ? (
          <p className="ride-summary__progress" role="status">
            전체 진행 {props.savedRouteProgress.fromPct}% → {props.savedRouteProgress.toPct}%
            {props.savedRouteProgress.routeName
              ? ` · ${props.savedRouteProgress.routeName}`
              : ""}
            <br />
            다음 출발점이 저장되었습니다
          </p>
        ) : null}

        {props.adhocSaveAvailable ? (
          <>
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
                  className="ride-summary__btn ride-summary__btn--primary"
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
                  onClick={() => {
                    if (confirmingClose) {
                      props.onDismissAdhoc();
                    } else {
                      setConfirmingClose(true);
                    }
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

            {confirmingClose ? (
              <div className="ride-summary__confirm" role="alertdialog" aria-live="assertive">
                <p className="ride-summary__confirm-msg">
                  내 경로로 저장하지 않습니까? 지금 닫으면 이 주행을 목록에 남길 수 없습니다.
                  위에서 이름을 입력해 저장하거나, 「저장 안 함」을 다시 누르면 닫힙니다.
                </p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
