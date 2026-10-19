import { browserLocalPersistence, type Persistence } from "firebase/auth";

/**
 * 브라우저를 닫아도 인증을 남긴다. 탭만 유지되는 session 지속성은 쓰지 않는다.
 * Node 의 firebase/auth 는 두 브라우저 지속성을 같은 메모리 구현으로 바꾸므로, 여기서는 이름 계약으로 구분한다.
 */
export const AUTH_PERSISTENCE_CONTRACT = "browserLocal" as const;
export const AUTH_BROWSER_PERSISTENCE: Persistence = browserLocalPersistence;

export function authPersistenceSurvivesBrowserClose(
  contract: "browserLocal" | "browserSession" = AUTH_PERSISTENCE_CONTRACT,
): boolean {
  return contract === "browserLocal";
}
