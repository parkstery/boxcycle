import { snapshotHudCompanionDiag } from "./hudCompanionDiag";

/** DEV 전용 — `window.__rtwHudDiag()` 로 ①~⑥ 스냅샷. production 에는 안 붙는다. */
export function installHudCompanionDebug(): void {
  if (typeof window === "undefined") return;
  const host = window.location.hostname;
  const local = host === "127.0.0.1" || host === "localhost";
  if (!import.meta.env.DEV && !local) return;
  (
    window as Window & {
      __rtwHudDiag?: typeof snapshotHudCompanionDiag;
    }
  ).__rtwHudDiag = snapshotHudCompanionDiag;
}
