import { useRef } from "react";
import { createPortal } from "react-dom";
import type { RecentTrailEntry } from "../../lib/trail/recentTrails";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import { useDialogFocus } from "../ui/useDialogFocus";
import "./TrailHubPanel.css";

type Props = {
  entry: RecentTrailEntry;
  /** 시작점(m)을 받아 주행을 시작한다 — 이어서 = 내 진행, 처음부터 = 0 */
  onStart: (offsetMeters: number) => void;
  onLeave: () => void;
  onClose: () => void;
};

/** `useTrailRecent` 의 선택 상태를 그대로 받아 띄운다(App 배선 한 줄). */
export function TrailStartChoiceHost(props: {
  recent: {
    startChoice: RecentTrailEntry | null;
    setStartChoice: (v: RecentTrailEntry | null) => void;
    resumeOffsetRef: { current: number | null };
  };
  onStartRide: () => void;
  onLeave: () => void;
}) {
  const { startChoice, setStartChoice, resumeOffsetRef } = props.recent;
  if (!startChoice) return null;
  return (
    <TrailStartChoice
      entry={startChoice}
      onStart={(offset) => {
        resumeOffsetRef.current = offset;
        setStartChoice(null);
        props.onStartRide();
      }}
      onLeave={() => {
        setStartChoice(null);
        props.onLeave();
      }}
      onClose={() => setStartChoice(null)}
    />
  );
}

const km = (m: number) => (Math.max(0, m) / 1000).toFixed(1);

/**
 * 같은 Trail 에서 다시 주행 시작 — 이어서 / 처음부터(2026-11-05 Chief 시안 ③·⑥, D4).
 * 이 Trail 에서 달린 적이 없으면 뜨지 않는다(호출 측이 판단).
 */
export function TrailStartChoice({ entry, onStart, onLeave, onClose }: Props) {
  const props = {
    trailLabel: `Trail ${formatTrailDisplayNumber(entry.displayNumber)}${entry.regionLabel ? ` · ${entry.regionLabel}` : ""}`,
    progressMeters: entry.progressMeters,
    routeMeters: entry.routeMeters,
    completed: entry.completed,
    onResume: () => onStart(entry.progressMeters),
    onRestart: () => onStart(0),
    onLeave,
    onClose,
  };
  const ref = useRef<HTMLDivElement>(null);
  useDialogFocus(true, ref);
  return createPortal(
    <div className="oc-modal-overlay trail-leave-confirm-overlay" onClick={props.onClose}>
      <div
        ref={ref}
        className="trail-leave-confirm trail-start-choice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="trail-start-choice-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            props.onClose();
          }
        }}
      >
        <div className="trail-start-choice__head">
          <h2 id="trail-start-choice-title" className="trail-leave-confirm__title">
            {props.trailLabel}
          </h2>
          {props.completed ? <span className="trail-start-choice__done">완주</span> : null}
          <span className="trail-start-choice__spacer" />
          <button type="button" className="trail-start-choice__close" aria-label="닫기" onClick={props.onClose}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {props.completed ? (
          <p className="trail-leave-confirm__msg">이 Trail 은 이미 끝까지 달렸어요. 다시 달리면 처음부터 시작해요.</p>
        ) : (
          <p className="trail-start-choice__progress">
            <span className="trail-start-choice__num">{km(props.progressMeters)}</span>
            <span className="trail-start-choice__unit">km</span>
            <span className="trail-start-choice__of">/ {km(props.routeMeters)} km 까지 달렸어요</span>
          </p>
        )}
        <div className="trail-leave-confirm__btns">
          {props.completed ? (
            <>
              <button type="button" className="trail-leave-confirm__btn trail-leave-confirm__btn--primary" onClick={props.onRestart}>
                처음부터 다시 달리기
              </button>
              <button type="button" className="trail-leave-confirm__btn" onClick={props.onLeave}>
                Trail 나가기
              </button>
            </>
          ) : (
            <>
              <button type="button" className="trail-leave-confirm__btn trail-leave-confirm__btn--primary" onClick={props.onResume}>
                {km(props.progressMeters)} km부터 이어 달리기
              </button>
              <button type="button" className="trail-leave-confirm__btn" onClick={props.onRestart}>
                처음부터
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
