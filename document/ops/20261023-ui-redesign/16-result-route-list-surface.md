# 경로 목록 가독성 보완 — 결과·감리

2026-10-23 · 구현 Codex(작은 CSS 보완 직접) · Codex 토큰 한도로 보고 전 중단 → **Claude Code 인수·마감(23:40~)**. 상태: **LOCAL_VERIFIED — Chief 화면 확인 대기.** 커밋·푸시·배포 없음.

[지시](15-task-route-list-surface.md) · [이전·이후 비교](comparison-route-list-surface.html) · 증거 `evidence/route-list-surface/`

## 무엇이 바뀌었나

- 입문·퍼블릭·내 경로 목록(공용 `RouteListModalShell` map 레이아웃, `OfficialCourseListModal.css`)을 **흰 불투명 박스 + 어두운 글자**로 바꿨다. 지도 위 흰 윤곽선 글자·반투명·흐림(`backdrop-filter`)을 껐다.
- 주행 중 라이더 순위(`components/leaderboard/*`)는 손대지 않았다 — 투명 윤곽선 유지.
- 시안 07(투명 목록)보다 이 Chief 지시가 우선한다. 결정 로그에 한 줄 기록됨.
- 시험 `e2e/ui-redesign-batch1.spec.ts`: 세 목록 패널 배경 `rgb(255, 255, 255)`와 글자색 `rgb(23, 34, 56)`을 기존 시나리오에서 확인하도록 보강(윤곽선 제거는 CSS `text-shadow: none` 등으로 처리, 시험은 캡처로 확인).

## Codex 중단 시점까지 완료된 것 (로그로 확인)

| 명령 (실행 폴더 `C:\20.HDev\boxcycle\apps\web`) | 결과 |
|---|---|
| `RTW_DEV_PORT=5020` playwright `ui-800x360 ui-redesign-batch1` 1worker | PASS 18/18 — `evidence/route-list-surface/route-list-surface-ui.log` |
| 에뮬레이터 실앱 캡처 `ui-redesign-batch1-live` 첫 시도 | FAIL — 「No emulators to start」(임시 설정 파일 경로 문제, 시험 시작 전) — `route-list-surface-live.log` |
| 같은 시험, 임시 설정 `firebase.route-list-qa.json`(functions 5019) 으로 재실행 | PASS 1/1, auth·functions·firestore·database 에뮬레이터 — `route-list-surface-live-final.log`. 운영 Firebase 쓰기 없음 |

로그 3개는 처음 묶음 폴더 루트에 있던 것을 Claude Code 가 `evidence/route-list-surface/`로 옮겼다.

## Claude Code 마감 검증

Codex 로그 이후 소스 변경이 없어 화면 18·실앱 1 시험은 다시 돌리지 않았다. 빠져 있던 정적·단위 검사만 하위 에이전트로 실행했다.

| 명령 (실행 폴더) | 결과 |
|---|---|
| `npx tsc -b --noEmit` (`apps\web`) | PASS |
| `npx eslint src/components/ride/RouteListModalShell.tsx e2e/ui-redesign-batch1.spec.ts` (`apps\web`) | PASS 오류0·경고0 |
| `npm run test:quick` (`apps\web`) | PASS 1354/1354 |
| `node scripts/ride-verify/verify-selectors.mjs` (`apps\web`) | PASS 19단계 |
| `node scripts/check-code-tidy.mjs` (루트) | PASS 기준선 이내(exports185·types44·duplicates7·반복18줄) |
| `node scripts/check-dep-direction.mjs --check` (루트) | PASS 위반0·순환0 |
| `node scripts/check-document-system.mjs` (루트) | PASS 346문서·깨진 링크0 |
| `git diff --check` (루트) | PASS |

보존 JSON SHA256 `4CAFA2A2…378179F` 그대로, 추적 증거 PNG 변경 없음.

## 감리 (Claude Code, 캡처 직접 확인)

- 실앱 800×360 입문·퍼블릭(빈 목록)·내 경로(빈 목록), 프리뷰 667×300 내 경로(항목·관리 도구)를 직접 봤다. 네 장 모두 흰 판이 지도를 완전히 가리고 글자가 검정·남색으로 읽힌다. 선택 행 연파랑, 탭·검색·정렬·닫기 대비 충분.
- 667×300 에서는 관리 도구 줄 때문에 목록이 두 행만 보인다(안쪽 스크롤). 이번 지시 범위 밖이며 기존 배치 그대로다.
- 판정: **PASS** (Chief 화면 확인 대기).

## 남은 것

- 저장소 루트의 비추적 임시 파일 `firebase.route-list-qa.json`은 이번 실앱 캡처용 에뮬레이터 설정이다. 커밋 대상이 아니다. Chief 확인 후 지운다.
- 묶음 1·2·로그인 복구와 함께 Chief 화면 확인 → 선별 커밋·푸시. 배포는 별도 승인.
