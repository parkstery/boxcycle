import type { TrailInstance } from "../../lib/trail/repo/firestoreTrailInstance";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import { shortTrailPlace, trailDisplayName, trailKmLabel, trailRiderCount, trailRowLabel } from "./trailGlance";

export const TRAIL_GLANCE_LIMIT = 10;

type Props = {
  trails: TrailInstance[];
  activeTrailId: string;
  rideSessionActive: boolean;
  loading: boolean;
  error: string | null;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
};

/**
 * 지도 오른쪽 목록의 「Trail」 탭(Chief 11-02: 순위와 같은 줄 목록, 10줄).
 * 주행 중엔 합류가 막혀 있어 인원만 보이고, 대기 중엔 줄 끝이 합류 버튼이다.
 */
export function TrailGlanceList({ trails, activeTrailId, rideSessionActive, loading, error, onJoinTrail }: Props) {
  if (loading && trails.length === 0) return <p className="lb-glance__outline lb-glance__hint">불러오는 중…</p>;
  if (error && trails.length === 0) return <p className="lb-glance__outline lb-glance__hint" title={error}>{error}</p>;
  if (trails.length === 0) return <p className="lb-glance__outline lb-glance__hint">지금 달리는 Trail이 없어요</p>;
  const shown = trails.slice(0, TRAIL_GLANCE_LIMIT);
  const more = trails.length - shown.length;
  return (
    <>
      <ol className="lb-glance__list lb-glance__list--trail">
        {shown.map((t) => {
          const current = rideSessionActive && t.id === activeTrailId;
          const km = trailKmLabel(t);
          const riders = trailRiderCount(t);
          const name = trailDisplayName(t);
          return (
            <li key={t.id} className={`lb-glance__row lb-glance__row--trail${current ? " lb-glance__row--me" : ""}`}
              aria-current={current ? "true" : undefined} aria-label={current ? trailRowLabel(t) : undefined}>
              <span className="lb-glance__outline lb-glance__trail-no">{formatTrailDisplayNumber(t.displayNumber)}</span>
              <span className={`lb-glance__outline lb-glance__name${current ? " lb-glance__outline--hero" : ""}`} title={name}>{shortTrailPlace(name)}</span>
              <span className={`lb-glance__outline lb-glance__km${current ? " lb-glance__outline--hero" : ""}`}>
                {km ?? "—"} <span className="lb-glance__km-unit">km</span>
              </span>
              {current ? (
                <span className="lb-glance__outline lb-glance__trail-status"><span className="lb-glance__live-dot" aria-hidden />주행 중</span>
              ) : rideSessionActive ? (
                <span className="lb-glance__outline lb-glance__trail-status">{riders != null && riders > 0 ? `${riders}명` : ""}</span>
              ) : (
                <button type="button" className="lb-glance__join" title="이 Trail에 합류"
                  aria-label={`${trailRowLabel(t)} — 합류`} onClick={() => onJoinTrail(t.id, t.publicationId)}>
                  {riders != null && riders > 0 ? `${riders}명 · 합류` : "합류"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {more > 0 ? <p className="lb-glance__outline lb-glance__footer">외 {more}개</p> : null}
    </>
  );
}
