import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  fetchCourseActivity,
  type CourseActivitySnapshot,
} from "../lib/firestoreCourseActivity";
import { COURSE_ACTIVITY_POLL_MS } from "../lib/rideSyncPolicy";

export type UseCourseActivityOptions = {
  configured: boolean;
  user: User | null;
  courseId: string | null;
  /** 포그라운드·코스가 있을 때만 폴링 */
  enabled: boolean;
};

/**
 * 코스 단위 activity aggregate — `onSnapshot` 없이 저빈도 `getDoc`.
 */
export function useCourseActivity(options: UseCourseActivityOptions) {
  const { configured, user, courseId, enabled } = options;
  const [activity, setActivity] = useState<CourseActivitySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const cid = courseId?.trim();
    if (!configured || !user || !cid) {
      setActivity(null);
      setError(null);
      return;
    }
    try {
      setError(null);
      const row = await fetchCourseActivity(cid);
      setActivity(row);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setActivity(null);
    }
  }, [configured, user, courseId]);

  useEffect(() => {
    if (!enabled) {
      setActivity(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const tick = () => {
      void reload().then(() => {
        if (cancelled) return;
      });
    };
    tick();
    const id = window.setInterval(tick, COURSE_ACTIVITY_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled, reload]);

  return { activity, error, reload };
}
