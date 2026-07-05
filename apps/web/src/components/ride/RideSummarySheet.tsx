import { useState } from "react";
import { validateSavedRouteName } from "../../lib/firestoreSavedRoutes";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  distanceKm: string;
  avgKmh: string;
  caloriesEstimate: number;
  /** Conquest — 「새 영토 +N · 개척 M」 한 줄. CF 집계 완료 시 반응형 갱신, null=없음/집계 전 */
  conquestLine?: string | null;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
  /** 저장 길이 제한 */
  maxNameLength: number;
  onSaveAdhoc: (name: string, confirmUpdate?: boolean) => Promise<void> | void;
  onDismissAdhoc: () => void;
  onClose: () => void;
};

/**
 * 주행 종료 후 하단 시트.
 * - 도착 토스트(arrivalCompleted) + ad-hoc 저장 안내(adhocSaveAvailable) 를 한 곳에 통합.
 * - 닫기는 스크림 탭 또는 「닫기」 버튼.
 */
export function RideSummarySheet(props: RideSummarySheetProps) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** ad-hoc 미저장 상태에서 닫기를 시도하면 곧바로 닫지 않고 확인을 한 번 더 받는다. */
  const [confirmingClose, setConfirmingClose] = useState(false);
  /** 같은 경로가 이미 있어 "업데이트하시겠습니까?" 확인을 기다리는 중. */
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

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
      // 같은 경로가 이미 있으면 "업데이트하시겠습니까?" 확인을 띄운다.
      if (e && typeof e === "object" && (e as { code?: string }).code === "saved-route-duplicate") {
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
        <div className="ride-summary__stats">
          <div className="ride-summary__stat">
            <span className="ride-summary__k">시간</span>
            <strong className="ride-summary__v">{props.elapsedLabel}</strong>
          </div>
          <div className="ride-summary__stat">
            <span className="ride-summary__k">거리</span>
            <strong className="ride-summary__v">{props.distanceKm} km</strong>
          </div>
          <div className="ride-summary__stat">
            <span className="ride-summary__k">평속</span>
            <strong className="ride-summary__v">{props.avgKmh} km/h</strong>
          </div>
          <div className="ride-summary__stat">
            <span className="ride-summary__k">칼로리</span>
            <strong className="ride-summary__v">{props.caloriesEstimate} kcal</strong>
          </div>
        </div>

        {props.conquestLine ? (
          <p className="ride-summary__conquest" role="status" aria-live="polite">
            🏴 {props.conquestLine}
          </p>
        ) : null}

        {props.adhocSaveAvailable ? (
          <>
            <p className="ride-summary__policy">
              자동 저장은 없습니다. 목록에 남기려면 이름을 입력한 뒤 저장하세요.
            </p>
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
                  이미 저장된 경로입니다. 업데이트하시겠습니까?
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
