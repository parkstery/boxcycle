import type { PointerEvent, TouchEvent } from "react";
import type { EntryLocationPermission, EntryLocationPhase } from "../../lib/geo/entryLocation";
import "./EntryLocationDialog.css";

const TITLE = "어디에서 시작할까요?";
const CHECKING_BODY = "위치 권한을 확인하고 있습니다.";
const LOCATING_BODY = "현재 위치를 확인하고 있습니다.";
const CURRENT_LABEL = "내 위치 근처에서 시작";
const CURRENT_HINT = "(위치공유 필요)";
const ROME_LABEL = "앱 기본 위치에서 시작";

export type EntryLocationDialogProps = {
  phase: EntryLocationPhase;
  permission: EntryLocationPermission;
  onChooseRome: () => void;
  onChooseCurrent: () => void;
};

function keepMapStill(event: PointerEvent<HTMLDivElement> | TouchEvent<HTMLDivElement>) {
  event.stopPropagation();
}

function RomeButton({ onChooseRome }: { onChooseRome: () => void }) {
  return (
    <button type="button" className="entry-location__button" onClick={onChooseRome}>
      {ROME_LABEL}
    </button>
  );
}

/**
 * 지구본 위 위치 선택. ready·idle 에서는 아무것도 그리지 않는다.
 * 차단(denied)에서도 두 시작 버튼이 모두 활성이다 — 내 위치 근처는 다시 시도(클릭 한
 * 번당 요청 한 번), 앱 기본 위치는 콜로세움으로 확정한다. 차단 설명은 두지 않아
 * 카드 폭이 버튼에 맞는다.
 * ready 안내는 App 이 notice 로 보여주고, 이 대화상자는 선택·진행만 담당한다.
 */
export function EntryLocationDialog({
  phase,
  permission,
  onChooseRome,
  onChooseCurrent,
}: EntryLocationDialogProps) {
  if (phase === "idle" || phase === "ready") return null;

  let body: string | null = null;
  let showCurrent = true;
  if (phase === "checking") {
    body = CHECKING_BODY;
    showCurrent = false;
  } else if (phase === "locating") {
    body = LOCATING_BODY;
    showCurrent = false;
  } else if (permission === "denied") {
    body = null;
  }

  return (
    <div className="entry-location" role="dialog" aria-label={TITLE}>
      <div
        className="entry-location__card"
        onPointerDown={keepMapStill}
        onTouchStart={keepMapStill}
      >
        <h2 className="entry-location__title">{TITLE}</h2>
        {body ? <p className="entry-location__body">{body}</p> : null}
        <div className="entry-location__actions">
          {showCurrent ? (
            <button
              type="button"
              className="entry-location__button entry-location__button--primary"
              aria-label={CURRENT_LABEL}
              onClick={onChooseCurrent}
            >
              {CURRENT_LABEL}<span className="entry-location__button-hint">{CURRENT_HINT}</span>
            </button>
          ) : null}
          <RomeButton onChooseRome={onChooseRome} />
        </div>
      </div>
    </div>
  );
}
