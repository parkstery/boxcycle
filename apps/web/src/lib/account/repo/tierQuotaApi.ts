/**
 * Tier quota 서버 검증 호출 — **원격 I/O 만**.
 *
 * 2026-09-26 (Phase 6-D4): 판정·타입·오류는 `account/tierQuota.ts` 에 그대로 두고
 * **fetch 한 덩어리만** 여기로 내렸다.
 *
 * 왜 이렇게 갈랐나 — 이 파일을 통째로 `repo/` 로 옮겨 봤더니 `account → firebase` 1건이
 * 사라지는 대신 `route → account/repo` 등 **2건이 생겼다**(위치만 바뀐 것). 호출하는 쪽이
 * 필요로 하는 것은 **「쿼터를 강제해 달라」는 정책 진입점**이지 저장소가 아니다
 * (repoAccess: 「식별자를 안다」와 「DB 를 읽는다」는 다르다). 그래서 진입점은 도메인에
 * 남기고, `firebase` 를 아는 부분만 repo 로 내렸다 — D3 의 2층 구조 그대로다.
 */
import type { User } from "firebase/auth";
import { functionsHttpUrl } from "../../firebase/functionsEmulatorUrl";

/** 서버 응답 원본. 해석은 호출자(`tierQuota`)가 한다 — 여기는 옮기기만 했다. */
export type TierQuotaHttpResponse<T> = {
  ok: boolean;
  json: { result?: T; error?: { message?: string } };
};

export async function postAssertTierQuota<T>(
  user: User,
  action: string,
): Promise<TierQuotaHttpResponse<T>> {
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Firebase 프로젝트가 설정되지 않았습니다.");
  }

  const url = functionsHttpUrl("assertTierQuotaHttp");
  const idToken = await user.getIdToken();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action }),
  });

  let json: { result?: T; error?: { message?: string } };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    throw new Error("quota 검증 응답을 읽을 수 없습니다.");
  }
  return { ok: res.ok, json };
}
