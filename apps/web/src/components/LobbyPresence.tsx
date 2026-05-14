import type { User } from "firebase/auth";
import { isLobbyMemberActive, LOBBY_STALE_MS, type LobbyMemberRow } from "../lib/firestoreLobby";
import "./LobbyPresence.css";

type LobbyPresenceProps = {
  user: User;
  roomId: string;
  /** 부모 `useLobbyRoomSession` 스냅샷 */
  rows?: LobbyMemberRow[] | null;
  error: string | null;
};

export function LobbyPresence({ user, roomId, rows, error: presenceError }: LobbyPresenceProps) {
  const safeRows = rows ?? [];
  const active = safeRows.filter((r) => isLobbyMemberActive(r.lastSeenAtMs));

  return (
    <section className="lobby-presence" aria-label="로비 접속자">
      <div className="lobby-presence__head">
        <strong>실시간 로비</strong>
        <span className="lobby-presence__meta">
          방 ID: <code>{roomId}</code> · 활동 기준 {Math.round(LOBBY_STALE_MS / 1000)}초
        </span>
      </div>
      <p className="lobby-presence__count">
        접속 중(추정): <strong>{active.length}</strong>명
        {safeRows.length !== active.length ? (
          <span className="lobby-presence__stale-hint">
            {" "}
            (문서 {safeRows.length}건 중 비활성 제외)
          </span>
        ) : null}
      </p>
      {active.length > 0 ? (
        <ul className="lobby-presence__list">
          {active.map((r) => (
            <li key={r.uid}>
              {r.displayName ?? r.uid}
              {r.uid === user.uid ? <span className="lobby-presence__you"> (나)</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="lobby-presence__empty">아직 표시할 활성 접속자가 없습니다.</p>
      )}
      {presenceError ? (
        <p className="lobby-presence__err" title={presenceError}>
          로비 동기화 오류: {presenceError}
        </p>
      ) : null}
    </section>
  );
}
