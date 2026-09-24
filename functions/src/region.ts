/**
 * Cloud Functions 배포 리전의 단일 진실.
 *
 * 왜 — 2026-09-24 구조 감사 H5. `asia-northeast3` 이 functions 23개 파일에 각각
 * 적혀 있었다(`const REGION = ...` 4곳 + `region:` 인라인 25곳). 일부만 바꾸면
 * **함수마다 다른 리전에 배포되고**, 클라이언트는 한쪽만 찾는다 — 호출이 404 로
 * 떨어지는데 코드에는 아무 문제가 없어 보인다.
 *
 * ⚠ 이 값을 바꾸면 **함수 주소가 바뀐다.** 기존 함수를 지우고 새로 만드는 마이그레이션이
 * 되므로, 클라이언트(`apps/web/src/app/env.ts` 의 `VITE_FUNCTIONS_REGION`)와 같이
 * 옮기고 배포 순서를 정한 뒤에만 건드려라.
 */
export const REGION = "asia-northeast3";
