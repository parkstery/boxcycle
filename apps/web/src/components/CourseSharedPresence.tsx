import { startTransition, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  deleteCoursePresence,
  isCourseMemberActive,
  subscribeCourseMembers,
  touchCoursePresence,
  upsertCoursePresence,
  type CourseMemberRow,
} from "../lib/firestoreCoursePresence";
import { LOBBY_STALE_MS } from "../lib/firestoreLobby";
import "./LobbyPresence.css";

type CourseSharedPresenceProps = {
  user: User;
  courseId: string;
  title?: string;
};

export function CourseSharedPresence({ user, courseId, title }: CourseSharedPresenceProps) {
  const [rows, setRows] = useState<CourseMemberRow[]>([]);
  const [presenceError, setPresenceError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startTransition(() => setPresenceError(null));

    void upsertCoursePresence(user, courseId).catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (!cancelled) setPresenceError(message);
    });

    const unsub = subscribeCourseMembers(
      courseId,
      (next) => {
        startTransition(() => setRows(next));
      },
      (err) => {
        if (!cancelled) setPresenceError(err.message);
      },
    );

    const timer = window.setInterval(() => {
      void touchCoursePresence(user, courseId).catch((e: unknown) => {
        const message = e instanceof Error ? e.message : String(e);
        if (!cancelled) setPresenceError(message);
      });
    }, 25_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsub();
      void deleteCoursePresence(user.uid, courseId).catch(() => {
        /* 코스 전환·언마운트 시 무시 */
      });
    };
  }, [user, courseId]);

  const active = rows.filter((r) => isCourseMemberActive(r.lastSeenAt));

  return (
    <section className="lobby-presence" aria-label="입문 코스 동시 주행자">
      <div className="lobby-presence__head">
        <strong>입문 코스 동행</strong>
        <span className="lobby-presence__meta">
          {title ? `${title} · ` : null}
          <code>{courseId}</code> · 활동 기준 {Math.round(LOBBY_STALE_MS / 1000)}초
        </span>
      </div>
      <p className="lobby-presence__count">
        주행 중(추정): <strong>{active.length}</strong>명
        {rows.length !== active.length ? (
          <span className="lobby-presence__stale-hint">
            {" "}
            (문서 {rows.length}건 중 비활성 제외)
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
        <p className="lobby-presence__empty">아직 표시할 활성 주행자가 없습니다.</p>
      )}
      {presenceError ? (
        <p className="lobby-presence__err" title={presenceError}>
          동행 동기화 오류: {presenceError}
        </p>
      ) : null}
    </section>
  );
}
