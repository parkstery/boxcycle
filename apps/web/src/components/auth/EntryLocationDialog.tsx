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

/** 한 칸 판(디자인 규칙): 이름표 → 제목 → 한 줄 설명 → 주 버튼 + 보조 버튼 */
export function EntryLocationDialog({ phase, permission, onChooseRome, onChooseCurrent }: EntryLocationDialogProps) {
  if (phase === "idle" || phase === "ready") return null;
  const note =
    phase === "checking" ? "위치 권한을 확인하고 있어요." :
    phase === "locating" ? "현재 위치를 찾고 있어요." :
    "고른 곳 주변의 실제 도로가 지도에 펼쳐져요.";
  return <div className="entry-location" role="dialog" aria-label={TITLE}>
    <div className="entry-location__card" onPointerDown={keepMapStill} onTouchStart={keepMapStill}>
      <span className="entry-location__label">출발 위치</span>
      <h2 className="entry-location__title">{TITLE}</h2>
      <p className="entry-location__body" role={phase === "choice" ? undefined : "status"}>{note}</p>
      <div className="entry-location__actions">
        {phase === "choice" ? <button type="button" className="entry-location__button entry-location__button--primary" aria-label={CURRENT_LABEL} onClick={onChooseCurrent}>
            <svg className="entry-location__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/></svg>{CURRENT_LABEL}
          </button> : null}
        <button type="button" className="entry-location__button" aria-label={ROME_LABEL} data-place="로마" onClick={onChooseRome}>{ROME_LABEL}</button>
      </div>
      {phase === "choice" && permission === "denied" ? <p role="status" className="entry-location__status">위치가 막혀 있어요. 브라우저 사이트 설정에서 위치를 허용해 주세요.</p> : null}
    </div>
  </div>;
}
