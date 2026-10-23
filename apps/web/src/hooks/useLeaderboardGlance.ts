import type { User } from "firebase/auth";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchLeaderboard, type LeaderboardResponse } from "../services/leaderboardApi";
import { settleUnlessCancelled } from "../components/ui/settleUnlessCancelled";

const REFRESH_MS = 5 * 60 * 1000;
const PANEL_STORAGE_KEY = "rtw-leaderboard-glance-open";

export type LeaderboardGlanceState = {
  /** 최신 fetch(실패 시 null, 조용히) */
  data: LeaderboardResponse | null;
  /** 주행 시작 시점에 고정한 응답 */
  atRideStart: LeaderboardResponse | null;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
  togglePanel: () => void;
};

function readPanelOpenDefault(): boolean {
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* ignore */
  }
  return false;
}

function writePanelOpen(open: boolean): void {
  try {
    localStorage.setItem(PANEL_STORAGE_KEY, open ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function useLeaderboardGlance(
  user: User | null | undefined,
  rideRunning: boolean,
): LeaderboardGlanceState {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [atRideStart, setAtRideStart] = useState<LeaderboardResponse | null>(null);
  const [panelOpen, setPanelOpenState] = useState(readPanelOpenDefault);
  const prevRunningRef = useRef(false);
  const dataRef = useRef<LeaderboardResponse | null>(null);
  const uidRef = useRef<string | null>(user?.uid ?? null);

  if (uidRef.current !== (user?.uid ?? null)) {
    uidRef.current = user?.uid ?? null;
    if (!user) {
      setData(null);
      setAtRideStart(null);
    }
  }

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const setPanelOpen = useCallback((open: boolean) => {
    setPanelOpenState(open);
    writePanelOpen(open);
  }, []);

  const togglePanel = useCallback(() => {
    setPanelOpenState((prev) => {
      const next = !prev;
      writePanelOpen(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    let dispose: () => void = () => {};
    // 숨겨진 탭에서는 부르지 않는다 — 다시 보일 때 visibilitychange 가 부른다
    const refresh = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      dispose();
      dispose = settleUnlessCancelled(fetchLeaderboard(user, "distance", "week"), (next) => {
        if (next.kind === "ready") setData(next.data);
      });
    };
    refresh();

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);

    intervalId = setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      dispose();
      document.removeEventListener("visibilitychange", onVisibility);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  useEffect(() => {
    if (rideRunning && !prevRunningRef.current) {
      const snap = dataRef.current;
      if (snap) setAtRideStart(snap);
    }
    prevRunningRef.current = rideRunning;
  }, [rideRunning]);

  return { data, atRideStart, panelOpen, setPanelOpen, togglePanel };
}
