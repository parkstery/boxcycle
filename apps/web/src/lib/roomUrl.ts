import { DEFAULT_LOBBY_ROOM_ID, sanitizeRoomId } from "./firestoreLobby";

export function readRoomIdFromLocation(): string {
  return sanitizeRoomId(new URLSearchParams(window.location.search).get("room"));
}

export function replaceRoomInUrl(roomId: string): void {
  const r = sanitizeRoomId(roomId);
  const url = new URL(window.location.href);
  if (r === DEFAULT_LOBBY_ROOM_ID) {
    url.searchParams.delete("room");
  } else {
    url.searchParams.set("room", r);
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", next);
}
