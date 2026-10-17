import type { PointerEvent, TouchEvent } from "react";
import type { EntryLocationPermission, EntryLocationPhase } from "../../lib/geo/entryLocation";
import "./EntryLocationDialog.css";

const TITLE = "어디에서 시작할까요?";
const SHARE_BODY =
  "위치를 공유하면 내 주변 지도에서 시작합니다. 공유하지 않아도 로마 콜로세움에서 시작할 수 있습니다.";
const DENIED_BODY =
  "위치 공유가 차단되어 있습니다. 내 주변에서 시작하려면 브라우저 설정에서 위치를 허용해 주세요.";
const CHECKING_BODY = "위치 권한을 확인하고 있습니다.";
const LOCATING_BODY = "현재 위치를 확인하고 있습니다.";
const CURRENT_LABEL = "내 위치에서 시작";
const ROME_LABEL = "콜로세움에서 시작";

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
 * 안내는 App 이 notice 로 보여주고, 이 대화상자는 선택·진행만 담당한다.
 */
export function EntryLocationDialog({
  phase,
  permission,
  onChooseRome,
  onChooseCurrent,
}: EntryLocationDialogProps) {
  if (phase === "idle" || phase === "ready") return null;

  let body = SHARE_BODY;
  let showCurrent = true;
  if (phase === "checking") {
    body = CHECKING_BODY;
    showCurrent = false;
  } else if (phase === "locating") {
    body = LOCATING_BODY;
    showCurrent = false;
  } else if (permission === "denied") {
    body = DENIED_BODY;
    showCurrent = false;
  }

  return (
    <div className="entry-location" role="dialog" aria-label={TITLE}>
      <div
        className="entry-location__card"
        onPointerDown={keepMapStill}
        onTouchStart={keepMapStill}
      >
        <h2 className="entry-location__title">{TITLE}</h2>
        <p className="entry-location__body">{body}</p>
        <div className="entry-location__actions">
          {showCurrent ? (
            <button
              type="button"
              className="entry-location__button entry-location__button--primary"
              onClick={onChooseCurrent}
            >
              {CURRENT_LABEL}
            </button>
          ) : null}
          <RomeButton onChooseRome={onChooseRome} />
        </div>
      </div>
    </div>
  );
}
