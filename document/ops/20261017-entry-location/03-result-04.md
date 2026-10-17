# 결과04 — 인트로 버튼만 구현

| 항목 | 내용 |
|---|---|
| 문서 유형 | record — 교대 기록 |
| 최초 작성 | 2026-10-17 |
| 상태 | IN_PROGRESS — 중간 단계. 최종 완료 아님 |
| 독자 | AI |
| 연결 문서 | [지시04](02-task-04.md) |

## 편집 파일

- `apps/web/scripts/ride-verify/entry-contract.mjs`
- `apps/web/src/components/auth/AppIntroScreen.tsx`
- `apps/web/src/components/auth/AppIntroScreen.css`

다른 파일은 편집하지 않았다. 기존 dirty는 보존했다. 커밋·푸시·배포 없음.

## 작업 내용

1. `app-intro` 계약을 두 콜백 `onStartGuest: () => void`, `onLogin: () => void`와 버튼 「게스트로 시작」「로그인」, 각 `onClick` 연결로 바꿨다. 인자 없는 컴포넌트 앵커는 제거했다.
2. `app-intro-gate`에서 2초 자동 전환 앵커(`APP_INTRO_DURATION_MS`, `setTimeout`, `clearTimeout`, `[showAppIntro]`)를 삭제했다. 메모리 dismiss, 소개 조건, 게스트 카드 이후 조건은 남겼다. App 연결 앵커는 `소개에 게스트 콜백`, `소개에 로그인 콜백`으로 기록했다.
3. `AppIntroScreen`은 위 두 props만 받고, support 문구 아래 actions에 두 버튼을 둔다. 부수효과·인증·타이머는 없다. 사진·문구·출처는 그대로다.
4. 게스트 버튼은 teal(`#0f766e`) 주 버튼, 로그인은 남색 테두리 보조 버튼이다. 최소 높이 44px, 폭은 내용 기준이다. 버튼은 기존 스크롤 칸 안에 있어 좁은 가로 화면에서 본문 스크롤과 우하단 출처를 유지한다.

## 숨기지 않는 실패

`apps/web/src/App.tsx` 3425행은 여전히 `<AppIntroScreen />`이다. `onStartGuest`·`onLogin`을 넘기지 않는다. 따라서 `app-intro-gate`의 두 연결 앵커는 다음 단계가 App을 연결하기 전까지 소스와 맞지 않는다. App.tsx는 이번 단계에서 수정하지 않았다.

## 시험

미실행. 다음 단계의 App 연결 전이라 빌드·브라우저·서버·`verify-selectors`·e2e를 돌리지 않았다. 통과·실패 수치는 없다.
