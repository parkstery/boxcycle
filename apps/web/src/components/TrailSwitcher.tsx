import { DEFAULT_TRAIL_ID, sanitizeTrailId } from "../lib/firestoreTrail";
import { TRAILHEAD_LABEL, TRAIL_LABEL } from "../lib/productTerms";
import "./TrailSwitcher.css";

type TrailSwitcherProps = {
  trailDraft: string;
  onDraftChange: (value: string) => void;
  activeTrailId: string;
  onApply: () => void;
  /** 기본 Trail(`default`) = Trailhead 허브 */
  onGoTrailhead: () => void;
};

export function TrailSwitcher(props: TrailSwitcherProps) {
  const sanitizedDraft = sanitizeTrailId(props.trailDraft);
  const sanitizedActive = sanitizeTrailId(props.activeTrailId);
  const canApply = sanitizedDraft !== sanitizedActive;
  const onTrailhead = sanitizedActive === DEFAULT_TRAIL_ID;

  return (
    <div className="trail-switcher" aria-label={`${TRAIL_LABEL} · ${TRAILHEAD_LABEL}`}>
      <div className="trail-switcher__row trail-switcher__row--trailhead">
        <button
          type="button"
          className="trail-switcher__trailhead-btn"
          disabled={onTrailhead}
          title={
            onTrailhead
              ? `현재 ${TRAILHEAD_LABEL} Trail (${DEFAULT_TRAIL_ID})입니다`
              : `${TRAILHEAD_LABEL}(기본 Trail ${DEFAULT_TRAIL_ID})로 이동`
          }
          onClick={props.onGoTrailhead}
        >
          {TRAILHEAD_LABEL}
        </button>
      </div>
      <div className="trail-switcher__row">
        <span className="trail-switcher__kicker">{TRAIL_LABEL}</span>
        <input
          className="trail-switcher__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder={DEFAULT_TRAIL_ID}
          value={props.trailDraft}
          title="영문·숫자·_- 만 1–64자 (잘못된 값은 기본 Trail)"
          onChange={(e) => props.onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (canApply) props.onApply();
            }
          }}
        />
        <button
          type="button"
          className="trail-switcher__btn"
          disabled={!canApply}
          title={canApply ? "이 Trail로 이동" : "현재 적용된 Trail입니다"}
          onClick={props.onApply}
        >
          이동
        </button>
      </div>
    </div>
  );
}

/** @deprecated `TrailSwitcher` */
export function RoomSwitcher(props: {
  roomDraft: string;
  onDraftChange: (value: string) => void;
  activeRoomId: string;
  onApply: () => void;
}) {
  return (
    <TrailSwitcher
      trailDraft={props.roomDraft}
      onDraftChange={props.onDraftChange}
      activeTrailId={props.activeRoomId}
      onApply={props.onApply}
      onGoTrailhead={() => {
        props.onDraftChange(DEFAULT_TRAIL_ID);
        props.onApply();
      }}
    />
  );
}
