import { useCallback, useEffect, useState } from "react";
import { sanitizeRoomId } from "../lib/firestoreLobby";
import { readRoomIdFromLocation, replaceRoomInUrl } from "../lib/roomUrl";

/**
 * 로비 방 ID와 `?room=` URL 동기화. `popstate` 시 둘 다 갱신.
 * 메뉴 닫기 등 UI 오케스트레이션은 호출 측에서 `applyRoomFromDraft` 뒤에 붙인다.
 */
export function useAppRoom() {
  const [roomId, setRoomId] = useState(readRoomIdFromLocation);
  const [roomDraft, setRoomDraft] = useState(readRoomIdFromLocation);

  useEffect(() => {
    const onPop = () => {
      const next = readRoomIdFromLocation();
      setRoomId(next);
      setRoomDraft(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const applyRoomFromDraft = useCallback(() => {
    const next = sanitizeRoomId(roomDraft);
    setRoomDraft(next);
    setRoomId(next);
    replaceRoomInUrl(next);
  }, [roomDraft]);

  return { roomId, setRoomId, roomDraft, setRoomDraft, applyRoomFromDraft };
}
