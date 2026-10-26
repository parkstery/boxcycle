# 지시 80 — 위치 선택 전 다음 주행·후속 카드 게이트

| 항목 | 값 |
|---|---|
| 날짜 | 2026-10-26 |
| 실행자 | Cursor Developer |
| 범위 | `App.tsx` idle 후속 카드 표시 조건만 |

## 현상

실앱에서 `EntryLocationDialog`('어디에서 시작할까요?')와 `NextRideCard`('이어 가기')가 **동시** 렌더링된다.

## Chief 계약

1. **최초 사용자**: 위치 선택창만 먼저, 이어가기 카드는 절대 없음.
2. **기존 게스트·등록 사용자**: 위치 상태가 `checking` / `choice` / `locating`이면 위치 선택창만, 다음 주행·첫 주행 후속 카드는 숨김. `ready` 이후에만 후속 카드를 평가·표시.
3. 브라우저 위치가 이미 허용되어 자동 `ready`면 위치 선택창 없이 이어가기만 가능.
4. **두 창 동시 표시는 모든 상태에서 금지.**

## 금지

- UI 모양·문구·위치권한 로직·이어가기 후보 산정·Firebase 데이터 변경
- 기존 시험 기대값 완화
- `localhost:5000` 종료·재시작
- dirty 보존 파일·git worktree/restore/clean/stash/브랜치/커밋/푸시/배포

## 구현 방향

`App.tsx`에 **단일 명시적 게이트**(`idleFollowUpCardsEligible` 등)를 두고 `nextRideCardVisible`·`firstRideIntroVisible`에 동일 적용.

## 회귀 시험 (필수)

- resume 후보가 있어도 `entryLocationPrompt`이면 카드 없음, `ready` 후 표시 가능 구조
- 후보 없는 최초 사용자는 resume 카드 조건과 양립
- prompt와 후속 카드 동시 노출 불가(소스 계약)

## 검증

새 회귀시험, 변경 파일 eslint, `npx tsc -b --noEmit`, `npm run test:quick`, 관련 e2e 또는 불가 사유, code-tidy/dep/doc/diff-check.
