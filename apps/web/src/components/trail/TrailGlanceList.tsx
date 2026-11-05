import type { TrailInstance } from "../../lib/trail/repo/firestoreTrailInstance";
import { formatTrailDisplayNumber } from "../../lib/trail/trailDisplayNumber";
import { formatRemainingMinutes, type RecentTrailEntry } from "../../lib/trail/recentTrails";
import { shortTrailPlace, trailDisplayName, trailKmLabel, trailRiderCount, trailRowLabel } from "./trailGlance";

/** F1(2026-11-05 Chief): 오른쪽 목록은 5개까지 — 나머지는 「Trail 찾기」 */
const TRAIL_GLANCE_LIMIT = 5;

type Props = {
  trails: TrailInstance[];
  activeTrailId: string;
  rideSessionActive: boolean;
  loading: boolean;
  error: string | null;
  onJoinTrail: (trailId: string, listingPublicationId?: string | null) => void;
  /** 「최근 내가 달린 Trail」 — 나온 지 10분 안(2026-11-05 Chief D5, 시안 ①). 주행 중엔 숨긴다 */
  recent?: ReadonlyArray<RecentTrailEntry & { remainingMs: number }>;
  /** 「대한민국」·「전 세계」 — 지금 달리는 Trail 머리말. 주행 중엔 null */
  scopeLabel?: string | null;
  /** 「Trail 찾기 ›」(시안 ⑦) */
  onOpenFinder?: () => void;
};

function FinderButton({ onOpenFinder }: { onOpenFinder?: () => void }) {
  if (!onOpenFinder) return null;
  return (
    <button type="button" className="lb-glance__finder" onClick={onOpenFinder}>
      Trail 찾기 ›
    </button>
  );
}

const km1 = (m: number) => (Math.max(0, m) / 1000).toFixed(1);

function RecentTrailRows({ recent, onJoinTrail }: { recent: NonNullable<Props["recent"]>; onJoinTrail: Props["onJoinTrail"] }) {
  return (
    <>
      <p className="lb-glance__outline lb-glance__section">최근 내가 달린 Trail</p>
      <ol className="lb-glance__list lb-glance__list--trail lb-glance__list--recent">
        {recent.map((t) => {
          const name = t.regionLabel?.trim() || `Trail ${formatTrailDisplayNumber(t.displayNumber)}`;
          return (
            <li key={t.trailId} className="lb-glance__row lb-glance__row--trail lb-glance__row--recent lb-glance__row--joinable"
              onClick={() => onJoinTrail(t.trailId, t.publicationId)}>
              <span className="lb-glance__outline lb-glance__trail-no">{formatTrailDisplayNumber(t.displayNumber)}</span>
              <span className="lb-glance__recent-name" title={name}>
                <span className="lb-glance__outline lb-glance__name">{shortTrailPlace(name)}</span>
                <span className="lb-glance__recent-sub">
                  {t.completed ? "완주" : `내 진행 ${km1(t.progressMeters)} / ${km1(t.routeMeters)} km`}
                </span>
              </span>
              <span className="lb-glance__recent-left">{formatRemainingMinutes(t.remainingMs)}</span>
              <button type="button" className="lb-glance__join lb-glance__join--primary" title="이 Trail 에 다시 들어가기"
                aria-label={`${name} — 다시 들어가기`}
                onClick={(e) => { e.stopPropagation(); onJoinTrail(t.trailId, t.publicationId); }}>
                다시 들어가기
              </button>
            </li>
          );
        })}
      </ol>
      <p className="lb-glance__outline lb-glance__footer">아무도 달리지 않는 Trail 은 10분 동안 여기에 남아요. 나만 보여요.</p>
    </>
  );
}

/**
 * 지도 오른쪽 목록의 「Trail」 탭(Chief 11-02: 순위와 같은 줄 목록, 10줄).
 * 주행 중엔 합류가 막혀 있어 인원만 보이고, 대기 중엔 줄 끝이 합류 버튼이다.
 */
export function TrailGlanceList({ trails, activeTrailId, rideSessionActive, loading, error, onJoinTrail, recent, scopeLabel, onOpenFinder }: Props) {
  const recentRows = !rideSessionActive && recent && recent.length > 0 ? <RecentTrailRows recent={recent} onJoinTrail={onJoinTrail} /> : null;
  if (trails.length === 0) {
    const msg = loading ? "불러오는 중…" : error ? error : "지금 달리는 Trail이 없어요";
    return (
      <>
        <p className="lb-glance__outline lb-glance__hint" title={error ?? undefined}>{msg}</p>
        {recentRows}
        <FinderButton onOpenFinder={onOpenFinder} />
      </>
    );
  }
  const shown = trails.slice(0, TRAIL_GLANCE_LIMIT);
  const more = trails.length - shown.length;
  return (
    <>
      {scopeLabel ? <p className="lb-glance__outline lb-glance__section">지금 달리는 Trail · {scopeLabel} · 사람 많은 순</p> : null}
      <ol className="lb-glance__list lb-glance__list--trail">
        {shown.map((t) => {
          const current = rideSessionActive && t.id === activeTrailId;
          const km = trailKmLabel(t);
          const riders = trailRiderCount(t);
          const name = trailDisplayName(t);
          const joinable = !rideSessionActive;
          return (
            <li key={t.id}
              className={`lb-glance__row lb-glance__row--trail${current ? " lb-glance__row--me" : ""}${joinable ? " lb-glance__row--joinable" : ""}`}
              aria-current={current ? "true" : undefined} aria-label={current ? trailRowLabel(t) : undefined}
              // 11-04 Chief 「지금 달리는 trail 에서 클릭하면 참여가 가능했었으나 현재는 안 된다」 —
              // 폰 가로에서 줄 끝 「합류」 단추가 오른쪽 지도 조작(맵 스타일 원)에 덮여 눌리지 않았다.
              // 줄 전체를 누르면 합류한다(단추는 키보드·접근성 이름용으로 그대로 둔다).
              onClick={joinable ? () => onJoinTrail(t.id, t.publicationId) : undefined}>
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
                  aria-label={`${trailRowLabel(t)} — 합류`} onClick={(e) => { e.stopPropagation(); onJoinTrail(t.id, t.publicationId); }}>
                  {riders != null && riders > 0 ? `${riders}명 · 합류` : "합류"}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {more > 0 ? <p className="lb-glance__outline lb-glance__footer">외 {more}개</p> : null}
      {recentRows}
      <FinderButton onOpenFinder={onOpenFinder} />
    </>
  );
}
