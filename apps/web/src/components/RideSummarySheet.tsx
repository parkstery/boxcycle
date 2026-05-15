import { useState } from "react";
import { validateSavedRouteName } from "../lib/firestoreSavedRoutes";
import "./RideSummarySheet.css";

type RideSummarySheetProps = {
  open: boolean;
  arrivalCompleted: boolean;
  elapsedLabel: string;
  distanceKm: string;
  avgKmh: string;
  caloriesEstimate: number;
  /** ad-hoc(저장 안 한 채) 주행이 직전에 종료되어 「사용자 경로로 저장」 액션이 가능한 상태인지 */
  adhocSaveAvailable: boolean;
  /** 저장 길이 제한 */
  maxNameLength: number;
  onSaveAdhoc: (name: string) => Promise<void> | void;
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

  if (!props.open) return null;

  async function commitSave() {
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
      await props.onSaveAdhoc(normalized);
      setName("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
        onClick={props.onClose}
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
            onClick={props.onClose}
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
                  onClick={props.onDismissAdhoc}
                  disabled={busy}
                >
                  저장 안 함
                </button>
              </div>
            </div>
            {error ? <p className="ride-summary__err">{error}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
