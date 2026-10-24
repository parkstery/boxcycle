# 결과 25 — LocalFirstEntryCard 삭제 + 계정 패널 주행 기록 연결

2026-10-24 · Cursor CLI · 지시 [24-task-entry-card-history.md](./24-task-entry-card-history.md)

## 요약

- `LocalFirstEntryCard` 및 카드 전용 Ready Ride UI·`useReadyRide`·`lib/route/readyRide.ts` 제거.
- 계정 패널 「마지막 주행 ›」 → `RideHistoryPanel`(기본 `ACCOUNT_HISTORY_MODE = "panel"`). 인라인 펼침 목록 코드는 `inline` 모드로 유지.
- Chief 고정 1~9 미변경.

## 변경·삭제 파일

| 구분 | 경로 |
|------|------|
| 삭제 | `apps/web/src/components/ride/LocalFirstEntryCard.tsx`, `LocalFirstEntryCard.css` |
| 삭제 | `apps/web/src/hooks/useReadyRide.ts`, `apps/web/src/lib/route/readyRide.ts` |
| 삭제 | `apps/web/e2e/local-first-card-shots.spec.ts`, `guest-demo-ready-ride.spec.ts` |
| 수정 | `apps/web/src/App.tsx`, `components/UserInfoSheet.tsx`, `UserInfoSheet.css`, `RideHistoryPanel.tsx`, `components/ride/index.ts`, `MapBottomLeftStack.css`, `dep-layers.json` |
| 추가 | `apps/web/src/lib/account/accountHistoryMode.ts` |
| 수정 | `apps/web/scripts/ui-800x360/preview.tsx`, `apps/web/e2e/ui-800x360.spec.ts` |
| 증거 | `document/ops/20261023-ui-redesign/evidence/entry-card-history/*` (캡처·캡처 스크립트·`ui.log`) |

`apps/web/dev-tools.json` 의 `guest-demo-ready-ride` 항목은 삭제된 spec 을 가리킨다(이번 지시 범위 밖, `test:quick` 미포함).

## 카드와 함께 사라진 기능(앱 UI)

- 좌하단 「어디에서 첫 라이딩을 할까요?」 / 「첫 Ready Ride (km)」 카드 전체.
- 카드 안 **Ready Ride 거리 칩 2·3·5·10 km** 자동 경로 생성·생성 중 취소·「다른 경로」·실패 후 재시도.
- 카드 안 **현재 위치 확인**·**지역 검색**·**지역 해제**·**입문 경로** 링크(카드 경로만; MENU 입문·출발 위치 다이얼로그·지명 검색 `localFirst` 의도는 `App.tsx`에 유지).
- `useReadyRide` / `readyRide.ts` — **grep 결과 카드·App 전용**이었고, 삭제 후 `apps/web` 내 참조 0.

## 유지(grep 근거)

- `localFirstRegion`·`read/writeLocalFirstRegion`·`applyLocalFirstRegion`·입문 `placeSearchIntentRef` `localFirst` — `App.tsx`, `mapBootCenter.ts`, `guestAccountReset.ts`.
- `firstRideIntroVisible` — 카드 없이도 지역 복원 시 카메라 1회 프레이밍용 `useEffect`만 사용.

## 주행 기록 연결

- 상수: `apps/web/src/lib/account/accountHistoryMode.ts` → `ACCOUNT_HISTORY_MODE = "panel"`(기본).
- `panel`: 「마지막 주행 ›」 클릭 시 시트 내용을 `RideHistoryPanel`로 교체, 닫기·Escape → 계정 패널 복귀.
- `inline`: 기존 `#user-info-sheet-history-list` 펼침(코드 삭제 없음).
- **되돌리기**: `accountHistoryMode.ts`에서 `"panel"` → `"inline"` 한 줄만 변경.

프리뷰: `?state=account&historyPreview=1` 시 메모리 예시 주행 3건(`previewRideSessions`).

## 캡처

| 파일 | 설명 |
|------|------|
| `evidence/entry-card-history/before-account-inline-667x300.png` | 변경 전, 인라인 펼침(프리뷰) |
| `evidence/entry-card-history/before-account-inline-800x360.png` | 동일 800×360 |
| `evidence/entry-card-history/before-first-visit-card-800x360.png` | 변경 전 카드(에뮬레이터 실앱) |
| `evidence/entry-card-history/after-account-{667x300,800x360}.png` | 변경 후 계정 패널 |
| `evidence/entry-card-history/after-history-panel-{667x300,800x360}.png` | 주행 기록 판 |
| `evidence/entry-card-history/after-first-visit-800x360.png` | 카드 없는 ready 프리뷰 |

## 검증 (`C:\20.HDev\boxcycle\apps\web`)

| # | 명령 | 결과 |
|---|------|------|
| 1 | `npx tsc -b --noEmit` | 통과 |
| 2 | 변경 파일 `eslint` | 오류 0 (기존 warning만) |
| 3 | `npm run test:quick` | **1차** ride 묶음 3건 타임아웃(동시 5020 dev·부하). **단독** `node scripts/test-quick.mjs ride` → 통과 856/0. 전체 재실행은 미수행. |
| 4 | `node scripts/ride-verify/verify-selectors.mjs` | 통과 |
| 5 | `RTW_DEV_PORT=5020` harness + `npx playwright test ui-800x360 ui-redesign-batch1.spec.ts ui-redesign-batch2.spec.ts --workers=1 --retries=0` | 24 passed, 로그 `evidence/entry-card-history/ui.log` |
| 6 | 루트 `check-code-tidy.mjs`, `check-dep-direction.mjs --check`, `check-document-system.mjs`, `git diff --check` | 통과(`accountHistoryMode.ts` dep-layers 등재 후 dep-direction 통과) |

## 못 한 것 / 비고

- 실앱 `ride-entry` 에뮬레이터 시험 — Supervisor 담당(지시서).
- 커밋·푸시·worktree·restore·checkout·clean·stash 하지 않음. 포트 3000 서버 미종료.
- 작업용 5020 harness 는 결과 작성 전 종료함.

## Supervisor 인수 확인 — 2026-10-24 09:28 KST

- 후속 Chief 요청: [inline / panel 비교 파일](comparison-account-history.html) 작성. 기존 800×360·667×300 캡처와 코드 동작 차이 정리. inline 기록 0건 / panel 예시 3건으로 동일 데이터 비교가 아님을 명시. 제품 코드 변경 및 모드 전환 없음.
- Codex: Chief의 진행 상황·후속 과업 보고 요청으로 결과 파일·실제 작업 트리·모드 상수·캡처 9장 존재를 대조함. 화면 직접 검수 및 시험 재실행은 아직 수행하지 않았으며, **감리 승인 전**이다.
- 다음: diff·캡처·고정 목록 감리 → 실앱 에뮬레이터 `ride-entry` → 배포용 `ACCOUNT_HISTORY_MODE = "inline"` 전환 및 해당 모드 검증 → 승인된 커밋·푸시·호스팅 배포 → 운영 번들 대조. `panel` 유지/제거는 Chief 비교 결정 대기.
- 전체 quick 시험 미재실행과 삭제된 Ready Ride spec 관련 개발도구 설정 참조 정합성도 마감 시 확인한다.
