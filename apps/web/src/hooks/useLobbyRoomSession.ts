import { startTransition, useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { FirestoreError } from "firebase/firestore";
import {
  deleteLobbyPresence,
  subscribeLobbyMembers,
  touchLobbyPresence,
  upsertLobbyPresence,
  type LobbyMemberRow,
} from "../lib/firestoreLobby";
import { LOBBY_PRESENCE_HEARTBEAT_ACTIVE_MS } from "../lib/rideSyncPolicy";

/** 로비 방 1곳에 대한 upsert·스냅샷·하트비트 — 단일 구독용(App + 표시 컴포넌트 공유) */
export function useLobbyRoomSession(opts: {
  user: User | null | undefined;
  roomId: string;
  enabled: boolean;
  /** false면 멤버 스냅샷·하트비트만 중단 — members 문서는 유지(가시성 토글로 delete 반복 방지) */
  pageVisible: boolean;
}): { rows: LobbyMemberRow[]; error: string | null } {
  const [rows, setRows] = useState<LobbyMemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = opts.user ?? null;

  /** 로비 이탈(비활성·uid·방 변경) 시에만 members 문서 삭제 — pageVisible 과 분리 */
  useEffect(() => {
    if (!opts.enabled || !opts.user) return;
    const uid = opts.user.uid;
    const rid = opts.roomId;
    return () => {
      void deleteLobbyPresence(uid, rid).catch(() => {
        /* 방 전환·비활성 시 무시 */
      });
    };
  }, [opts.enabled, opts.user?.uid, opts.roomId]);

  useEffect(() => {
    if (!opts.enabled || !opts.user || !opts.pageVisible) {
      startTransition(() => {
        setRows([]);
        setError(null);
      });
      return;
    }

    const user = opts.user;
    const { roomId } = opts;
    let cancelled = false;
    startTransition(() => setError(null));

    void upsertLobbyPresence(user, roomId).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!cancelled) setError(message);
    });

    const unsub = subscribeLobbyMembers(
      roomId,
      (next) => {
        startTransition(() => setRows(next));
      },
      (err: FirestoreError) => {
        if (!cancelled) setError(err.message);
      },
    );

    const timer = window.setInterval(() => {
      const u = userRef.current;
      if (!u) return;
      void touchLobbyPresence(u, roomId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(message);
      });
    }, LOBBY_PRESENCE_HEARTBEAT_ACTIVE_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsub();
    };
  }, [opts.enabled, opts.roomId, opts.user?.uid, opts.pageVisible]);

  if (!opts.enabled || !opts.user || !opts.pageVisible) {
    return { rows: [], error: null };
  }
  return { rows, error };
}
