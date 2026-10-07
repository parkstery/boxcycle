import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../lib/firebase/functionsEmulatorUrl";

/**
 * 경로 Functions 미리 깨우기 — cold start 를 사용자가 End·방향을 고르는 사이에 숨긴다.
 *
 * 실측(2026-10-07): GET 으로 컨테이너만 띄우면 첫 실요청이 여전히 ~2.3초(이후 ~1초)였다.
 * 첫 요청이 치르는 Firestore·Auth 지연 초기화까지 끝내려고 인증된 `{ data: { warm: true } }`
 * 를 보낸다. 서버는 읽기만 하고 토큰은 차감하지 않는다.
 * Cloud Run 이 유휴 인스턴스를 내리기 전(~15분) 주기로만 다시 보낸다.
 */
export type RouteFunctionName = "getMapboxDirections" | "getDistanceAutoRoute";

const PREWARM_INTERVAL_MS = 5 * 60_000;
const lastPrewarmAtMs = new Map<RouteFunctionName, number>();

export function prewarmRouteFunctions(user: User, ...names: RouteFunctionName[]): void {
  const now = Date.now();
  const due = names.filter((name) => {
    const last = lastPrewarmAtMs.get(name);
    return last === undefined || now - last >= PREWARM_INTERVAL_MS;
  });
  if (due.length === 0) return;
  for (const name of due) lastPrewarmAtMs.set(name, now);

  void (async () => {
    let idToken: string;
    try {
      idToken = await user.getIdToken();
    } catch {
      for (const name of due) lastPrewarmAtMs.delete(name);
      return;
    }
    for (const name of due) {
      let url: string;
      try {
        url = functionsHttpUrl(name);
      } catch {
        continue;
      }
      void fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ data: { warm: true } }),
      }).catch(() => {
        lastPrewarmAtMs.delete(name);
      });
    }
  })();
}
