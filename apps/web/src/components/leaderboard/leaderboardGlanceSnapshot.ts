import type { LeaderboardResponse } from "../../services/leaderboardApi";
import { leaderboardEntriesToLiveRows } from "./leaderboardLiveRank";

export function buildGlanceLiveRows(snapshot: LeaderboardResponse | null) {
  if (!snapshot) return [];
  return leaderboardEntriesToLiveRows(snapshot.top, snapshot.me.around);
}
