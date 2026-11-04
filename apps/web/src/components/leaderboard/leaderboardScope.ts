/**
 * 순위 범위 버튼(Chief 11-04 A안) — 기간 버튼과 같은 꼴, 누를 때마다 세계 → 대륙 → 국가.
 * 거리 판이고 대표 국가가 있을 때만 고를 수 있다. 개척 판의 지역은 도로 기준(G5)이라 아직 세계만.
 * 처음은 세계(지금과 같음), 마지막으로 고른 범위를 기기에 기억한다.
 */
import type { LeaderboardScope } from "../../services/leaderboardApi";
import { homeCountryLabel } from "../../lib/identity/homeCountry";

const LEADERBOARD_SCOPE_STORAGE_KEY = "rtw.leaderboard.scope";
const ORDER: LeaderboardScope[] = ["world", "continent", "country"];

const CONTINENT_LABELS: Record<string, string> = {
  AS: "아시아",
  EU: "유럽",
  AF: "아프리카",
  NA: "북아메리카",
  SA: "남아메리카",
  OC: "오세아니아",
  AN: "남극",
};

export function nextLeaderboardScope(current: LeaderboardScope): LeaderboardScope {
  return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]!;
}

export function canPickLeaderboardScope(board: "distance" | "pioneer", homeCountry: string | null): boolean {
  return board === "distance" && homeCountry != null;
}

/** 실제로 요청할 범위 — 고를 수 없으면 세계 */
export function effectiveLeaderboardScope(
  chosen: LeaderboardScope,
  board: "distance" | "pioneer",
  homeCountry: string | null,
): LeaderboardScope {
  return canPickLeaderboardScope(board, homeCountry) ? chosen : "world";
}

/** 버튼 글자. 대륙 코드는 응답(scopeCode)으로 알고, 오기 전에는 「대륙」 */
export function leaderboardScopeLabel(
  scope: LeaderboardScope,
  homeCountry: string | null,
  continentCode: string | null,
): string {
  if (scope === "country" && homeCountry) return homeCountryLabel(homeCountry);
  if (scope === "continent") return (continentCode && CONTINENT_LABELS[continentCode]) || "대륙";
  return "세계";
}

export function loadLeaderboardScope(): LeaderboardScope {
  try {
    const v = localStorage.getItem(LEADERBOARD_SCOPE_STORAGE_KEY);
    return v === "continent" || v === "country" ? v : "world";
  } catch {
    return "world";
  }
}

export function saveLeaderboardScope(scope: LeaderboardScope): void {
  try {
    localStorage.setItem(LEADERBOARD_SCOPE_STORAGE_KEY, scope);
  } catch {
    // 저장 못 해도 이번 창에서는 그대로 쓴다
  }
}
