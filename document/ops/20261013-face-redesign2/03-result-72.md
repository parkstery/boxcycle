# 결과72 — 지도 배경 앱 인트로

모델: Auto (Cursor agent router). session: 이 턴 프롬프트에 conversation id 없음. branch `main2`. HEAD `c818ed46c6c7c64a05a3430e464fc0bfa47861ed`. 커밋·푸시·배포 없음. 지시72 파일은 수정하지 않음. 작업 트리 `C:/20.HDev/boxcycle`. 참고 워크트리 `mobile-ui-redesign`은 읽기만 했다.

## 변경

- 신규 `apps/web/src/components/auth/AppIntroScreen.tsx`, `AppIntroScreen.css`. 참고 화면을 옮기고, 과거 승인 주석은 현재 연결 사실에 맞게 고쳤다. 좌측 포슬린 그라데이션, 빨간 점+RTW, RIDE THE WORLD, 남색 두 줄 `달린 길이,` / `내 도로망이 됩니다.`, 소개, 청록 `시작하기 →`. 자체 지도·타일·외부 이미지 없음.
- 스크롤 히트는 `width: min(46%, 26rem)` 좌측 본문만. 참고본은 스크롤이 가로 전체라 우측 지도 조작을 막는다. 왼쪽 여백은 `max(6vw, safe-area-left)`로 뷰포트 6%를 유지. 셸·하단 44px 예약 띠는 `pointer-events: none`. CTA `min-height: 44px`, `:focus-visible`, 낮은 높이 내부 스크롤+포커스 시 CTA 노출, safe-area, `prefers-reduced-motion`에서 입장 애니메이션 없음.
- `apps/web/src/App.tsx` 연결만. `introDismissed`는 `useState(false)` 메모리. `showAppIntro`는 `needsGuestEntry && !introDismissed && startScreenNotice !== "account-deleted" && !authSigningIn && !busy && !error`. CTA는 `setIntroDismissed(true)`만. 게스트 카드는 `needsGuestEntry && !showAppIntro`. 로그인·명시 로그아웃은 `needsGuestEntry`가 이미 거짓이라 기존 게이트가 남는다. 회전 안내(`RotateOverlay`, z-index 200)는 그대로.
- `apps/web/scripts/ride-verify/entry-contract.mjs`에 `app-intro`, `app-intro-gate` 추가. `apps/web/e2e/ride-entry.spec.ts` `enterAsGuest`는 소개 `시작하기` 다음 기존 `시작` 익명 인증. 그 뒤 코스·주행 시퀀스는 그대로.

`git diff --stat` (추적 파일): ride-entry.spec.ts +6/−1, entry-contract.mjs +28, App.tsx +15/−1. 신규 두 파일은 untracked.

## 검증

| 명령 | exit | 판정 |
|---|---|---|
| `apps/web`에서 `node scripts/ride-verify/verify-selectors.mjs` | 0 | PASS. 17단계 전부 유효 |
| `apps/web`에서 `npx tsc --noEmit` | 0 | PASS |
| `apps/web`에서 `npx eslint src/components/auth/AppIntroScreen.tsx src/App.tsx` | 0 | PASS (error 0). App.tsx 기존 `react-hooks/exhaustive-deps` 경고 7건(714, 1177, 1214, 1230, 1272, 1353, 2840). 이번 추가 줄 아님. AppIntroScreen 진단 없음 |

## 미실행·잔여

- 브라우저 화면·CTA→기존 카드·인증 예외·지도 조작은 미실행. 지시가 Supervisor 검수로 두고 별도 서버를 금지했다.
- `RIDE_VERIFY_LIVE` / `npm run test:e2e:ride` 미실행. Firebase 에뮬레이터 전제.
- 범위 밖: `ride-entry.spec.ts` 외 `enterAsGuest`(ride-continuation, rideEntryHelpers, 카메라·autoroute 등)는 소개를 닫지 않는다. 소개가 게스트 카드를 가리므로 그 spec을 돌리면 시작 다이얼로그를 기다리다 실패할 수 있다. 이번 소유 파일이 아니라 고치지 않았다.
