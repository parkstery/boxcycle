/**
 * Trail 식별자 — **도메인 층**. 저장소보다 아래다.
 *
 * 왜 여기로 왔나 (Phase 5 D6) — 이 셋은 `trail/repo/firestoreTrail.ts` 안에 있었다.
 * 그래서 **Trail ID 를 다루려면 Firestore 저장소를 import 해야 했다.** 동행 전송
 * (`peerMotion`)은 RTDB 경로 `/trails/{trailId}/motion/{uid}` 때문에 Trail ID 를
 * 알아야 하는데, 그 때문에 저장소까지 끌어오게 됐다.
 *
 * **「식별자를 안다」와 「데이터베이스를 읽는다」는 다르다.** 전자는 허용하고 후자는
 * 막아야 D1(Trail 이 소유한 읽기 모델만)이 말이 된다. 그래서 식별자를 여기로 내렸다.
 *
 * 이 모듈은 아무것도 import 하지 않는다.
 */

/** URL·입장 시 기본 Trail ID (Firestore: `trails/default`) */
export const DEFAULT_TRAIL_ID = "default";

const TRAIL_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

/** Firestore `trails/{id}` 경로용 Trail ID. 허용되지 않으면 `default` */
export function sanitizeTrailId(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t || !TRAIL_ID_RE.test(t)) return DEFAULT_TRAIL_ID;
  return t;
}
