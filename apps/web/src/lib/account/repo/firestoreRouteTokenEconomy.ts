/**
 * Route Token 경제 설정 문서 — `config/routeTokenEconomy` 의 **유일한 읽는 자리**.
 *
 * 2026-09-26 (Phase 6-D2): 같은 문서·같은 필드를 **두 모듈이 각자** 구독하고 있었다
 * (`routeTokenEconomyClient` 의 React 훅 · `mountRouteTokenPopupFeedback` 의 명령형 마운트).
 *
 * 어긋나면 조용하다는 것이 문제다 — 경로나 필드 이름이 한쪽에서만 바뀌면 다른 쪽은
 * 기본값 `generateCostBase = 0` 으로 떨어지고, **0 은 「차감·잔액 표시를 끈다」는
 * 정상 상태와 구분되지 않는다**(지시07). 기능이 조용히 사라지고 의도로 보인다.
 * 셀 ID 3중 복제(Phase 5 §4-1)와 같은 모양이다.
 */
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebaseFirestore, isFirebaseConfigured } from "../../firebase/app";

/** 시드와 동기 — 문서가 없을 때·구독 전 기본값 */
export const ROUTE_TOKEN_ECONOMY_DEFAULT_GENERATE_COST_BASE = 0;

/** 문서가 없거나 값이 이상하면 기본값. 음수·소수는 잘라 낸다 */
export function normalizeGenerateCostBase(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw)
    ? Math.max(0, Math.floor(raw))
    : ROUTE_TOKEN_ECONOMY_DEFAULT_GENERATE_COST_BASE;
}

/**
 * 생성 비용 구독. Firebase 가 없으면 `null` — 호출자는 구독하지 않은 것으로 다룬다.
 * 오류도 기본값으로 흘린다(종전 두 소비자의 동작 그대로).
 */
export function subscribeRouteTokenGenerateCostBase(
  onCostBase: (costBase: number) => void,
): (() => void) | null {
  if (!isFirebaseConfigured()) return null;
  return onSnapshot(
    doc(getFirebaseFirestore(), "config", "routeTokenEconomy"),
    (snap) => onCostBase(normalizeGenerateCostBase(snap.exists() ? snap.data()?.generateCostBase : undefined)),
    () => onCostBase(ROUTE_TOKEN_ECONOMY_DEFAULT_GENERATE_COST_BASE),
  );
}
