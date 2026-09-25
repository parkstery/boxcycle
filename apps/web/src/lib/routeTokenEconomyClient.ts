/**
 * Route Token 경제 — 클라이언트 파생.
 * 진실은 Firestore `config/routeTokenEconomy`(시드: document/config-routeTokenEconomy.seed.json).
 * 지시07: generateCostBase===0 이면 차감·부족 문구·잔액 표시를 끈다(코드 삭제 아님).
 */
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getFirebaseFirestore, isFirebaseConfigured } from "./firebase/app";

/** 시드와 동기 — Firestore 문서가 없을 때·구독 전 기본값 */
export const ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT: { generateCostBase: number } = {
  generateCostBase: 0,
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
    if (!isFirebaseConfigured()) return;

    const apply = (raw: unknown) => {
      const forced = readDevForceCost();
      if (forced != null) {
        setCost(forced);
        return;
      }
      const n = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
      setCost(n ?? ROUTE_TOKEN_ECONOMY_CLIENT_DEFAULT.generateCostBase);
    };

    const db = getFirebaseFirestore();
    const unsub = onSnapshot(
      doc(db, "config", "routeTokenEconomy"),
      (snap) => {
        apply(snap.exists() ? snap.data()?.generateCostBase : undefined);
      },
      () => {
        apply(undefined);
      },
    );

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
