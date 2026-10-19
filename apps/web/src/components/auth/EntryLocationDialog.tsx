import type { PointerEvent, TouchEvent } from "react";
import type { EntryLocationPermission, EntryLocationPhase } from "../../lib/geo/entryLocation";
import "./EntryLocationDialog.css";

const TITLE = "어디에서 시작할까요?";
const CURRENT_LABEL = "내 위치";
const ROME_LABEL = "기본 위치";

export type EntryLocationDialogProps = {
  phase: EntryLocationPhase;
  permission: EntryLocationPermission;
  onChooseRome: () => void;
  onChooseCurrent: () => void;
  onPosition: (lng: number, lat: number) => void;
};
function keepMapStill(event: PointerEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) { event.stopPropagation(); }

export function EntryLocationDialog({ phase, permission, onChooseRome, onChooseCurrent }: EntryLocationDialogProps) {
  if (phase === "idle" || phase === "ready") return null;
  return <div className="entry-location" role="dialog" aria-label={TITLE}>
    <div className="entry-location__card" onPointerDown={keepMapStill} onTouchStart={keepMapStill}>
      <h2 className="entry-location__title"><span aria-hidden="true">🧭</span>{TITLE}</h2>
      {phase === "checking" ? <p className="entry-location__body">위치 권한을 확인하고 있습니다.</p> : null}
      {phase === "locating" ? <p className="entry-location__body">현재 위치를 확인하고 있습니다.</p> : null}
      <div className="entry-location__actions">
        {phase === "choice" ? <button type="button" className="entry-location__button entry-location__button--primary" aria-label={CURRENT_LABEL} onClick={onChooseCurrent}>
            <svg className="entry-location__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" fill="currentColor"/><circle cx="12" cy="9" r="2.5" fill="#2563eb"/></svg>{CURRENT_LABEL}
          </button> : null}
        <button type="button" className="entry-location__button" onClick={onChooseRome}><svg className="entry-location__icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/><path d="M4 12h16M12 4c4 4.5 4 11.5 0 16-4-4.5-4-11.5 0-16Z" stroke="currentColor" strokeWidth="1.5"/></svg>{ROME_LABEL}</button>
      </div>
      {phase === "choice" && permission === "denied" ? <p role="status" className="entry-location__status">위치가 차단되어 있습니다. 브라우저 사이트 설정에서 위치를 허용한 뒤 다시 시도해 주세요.</p> : null}
    </div>
  </div>;
}
