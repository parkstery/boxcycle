import { DEFAULT_LOBBY_ROOM_ID, sanitizeRoomId } from "../lib/firestoreLobby";
import "./RoomSwitcher.css";

type RoomSwitcherProps = {
  roomDraft: string;
  onDraftChange: (value: string) => void;
  /** 현재 적용된 방(정규화됨) — HUD·presence 기준 */
  activeRoomId: string;
  onApply: () => void;
  /** 로비 presence 가 실제 반영되는지(로그인·Firebase 설정) */
  presenceSyncPossible: boolean;
};

/** MENU 상단: 접속 방 ID 변경 — `?room=` 과 동기화. */
export function RoomSwitcher(props: RoomSwitcherProps) {
  const sanitizedDraft = sanitizeRoomId(props.roomDraft);
  const sanitizedActive = sanitizeRoomId(props.activeRoomId);
  const canApply = sanitizedDraft !== sanitizedActive;

  return (
    <div className="room-switcher" aria-label="접속 방">
      <div className="room-switcher__row">
        <span className="room-switcher__kicker">방</span>
        <input
          className="room-switcher__input"
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={64}
          placeholder={DEFAULT_LOBBY_ROOM_ID}
          value={props.roomDraft}
          title="영문·숫자·_- 만 1–64자 (잘못된 값은 기본 방)"
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
          className="room-switcher__btn"
          disabled={!canApply}
          title={canApply ? "이 방으로 이동" : "현재 적용된 방입니다"}
          onClick={props.onApply}
        >
          이동
        </button>
      </div>
      <p className="room-switcher__hint">
        URL <code>?room=</code> 과 동기화 · 빈 값·잘못된 값은 <strong>{DEFAULT_LOBBY_ROOM_ID}</strong>
      </p>
      {!props.presenceSyncPossible ? (
        <p className="room-switcher__note">로그인·Firebase 연결 시 접속자 목록이 이 방 기준으로 갱신됩니다.</p>
      ) : null}
    </div>
  );
}
