import type { User } from "firebase/auth";
import { isTrailMemberActive, TRAIL_PRESENCE_STALE_MS, type TrailMemberRow } from "../../lib/firestoreTrail";
import "./TrailheadPresence.css";

type TrailheadPresenceProps = {
  user: User;
  trailId: string;
  rows?: TrailMemberRow[] | null;
  error: string | null;
};

export function TrailheadPresence({ user, trailId, rows, error: presenceError }: TrailheadPresenceProps) {
  const safeRows = rows ?? [];
  const active = safeRows.filter((r) => isTrailMemberActive(r.lastSeenAtMs));

  return (
    <section className="trailhead-presence" aria-label="Trailhead 접속자">
      <div className="trailhead-presence__head">
        <strong>Trailhead · 이 Trail</strong>
        <span className="trailhead-presence__meta">
          Trail ID: <code>{trailId}</code> · 활동 기준 {Math.round(TRAIL_PRESENCE_STALE_MS / 1000)}초
        </span>
      </div>
      <p className="trailhead-presence__count">
        접속 중(추정): <strong>{active.length}</strong>명
        {safeRows.length !== active.length ? (
          <span className="trailhead-presence__stale-hint">
            {" "}
            (문서 {safeRows.length}건 중 비활성 제외)
          </span>
        ) : null}
      </p>
      {active.length > 0 ? (
        <ul className="trailhead-presence__list">
          {active.map((r) => (
            <li key={r.uid}>
              {r.displayName ?? r.uid}
              {r.uid === user.uid ? <span className="trailhead-presence__you"> (나)</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="trailhead-presence__empty">아직 표시할 활성 접속자가 없습니다.</p>
      )}
      {presenceError ? (
        <p className="trailhead-presence__err" title={presenceError}>
          Trailhead 동기화 오류: {presenceError}
        </p>
      ) : null}
    </section>
  );
}
