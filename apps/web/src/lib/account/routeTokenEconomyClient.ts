/**
 * Route Token 경제 — 클라이언트 파생.
 * 진실은 Firestore `config/routeTokenEconomy`(시드: document/config-routeTokenEconomy.seed.json).
 * 지시07: generateCostBase===0 이면 차감·부족 문구·잔액 표시를 끈다(코드 삭제 아님).
 */
import { useEffect, useState } from "react";
import {
  ROUTE_TOKEN_ECONOMY_DEFAULT_GENERATE_COST_BASE,
  subscribeRouteTokenGenerateCostBase,
} from "./repo/firestoreRouteTokenEconomy";

/** 시드와 동기 — Firestore 문서가 없을 때·구독 전 기본값 */
export const ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT: { generateCostBase: number } = {
  generateCostBase: ROUTE_TOKEN_ECONOMY_DEFAULT_GENERATE_COST_BASE,
};

declare global {
  interface Window {
    /** DEV 전용 — 캡처 A2(비용 1 복원 증명). 운영 빌드에서는 무시. */
    __rtwForceGenerateCostBase?: number;
  }
}

export function isRouteTokenGenerateMetered(generateCostBase: number): boolean {
  return Math.max(0, Math.floor(generateCostBase)) > 0;
}

function readDevForceCost(): number | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const v = window.__rtwForceGenerateCostBase;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : null;
}

/**
 * 생성 비용(개). Firestore 구독 + DEV 강제 오버라이드.
 */
export function useRouteTokenGenerateCostBase(): number {
  const [cost, setCost] = useState<number>(ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT.generateCostBase);

  useEffect(() => {
    // 문서를 읽는 자리는 repo 하나다 — 두 곳이 각자 읽으면 어긋나도 조용하다.
    const apply = (costBase: number) => {
      const forced = readDevForceCost();
      setCost(forced != null ? forced : costBase);
    };

    const unsub = subscribeRouteTokenGenerateCostBase(apply);
    // Firebase 미설정이면 종전처럼 아무것도 걸지 않는다(DEV 폴링도 포함) — 동작 보존.
    if (!unsub) return;

    // DEV 오버라이드 폴링(캡처 스크립트가 window 값을 바꿀 때)
    let timer: ReturnType<typeof setInterval> | null = null;
    if (import.meta.env.DEV) {
      timer = setInterval(() => {
        const forced = readDevForceCost();
        if (forced != null) setCost(forced);
      }, 400);
    }

    return () => {
      unsub();
      if (timer) clearInterval(timer);
    };
  }, []);

  return cost;
}
