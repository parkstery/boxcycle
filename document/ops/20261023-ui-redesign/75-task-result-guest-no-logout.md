# 지시75·결과 — 게스트에게 로그아웃을 주지 않는다(Claude Code 직접)

2026-10-25 KST · Supervisor Claude Code 가 지시·구현·감리를 모두 맡음. 외부 실행자 없음.

## Chief 결정(10-25)

> 게스트는 로그아웃 기능을 제공하지 않는게 나을 것 같지 않아? 한 사람이 여러 게스트 계정을 생산할 우려가 커. … 지금 여기 쌓인 게스트 계정의 상당수는 의도한게 아니라 로그아웃으로 쌓인 거야. … 게스트도 로그아웃의 개념을 나갔다 들어올 수 있다고 생각할 텐데 나가면 나중에 새로운 게스트로 시작하는 경험은 좋은 방식이 아니라고 생각해.

→ 「함께 넣어」: 묶음3~5 배포에 같이 싣는다.

## 배경(Claude Code 확인)

- 10-19 이후 게스트 「로그아웃」은 `endAppUse` — Firebase 세션을 남기고 시작 메뉴로 돌린다. 같은 기기·브라우저에서 「게스트로 시작」하면 같은 uid 로 돌아온다(`hooks/useAppAuth.ts`).
- 그래도 버튼 이름은 「나갔다 다시 들어오기」로 읽히고, 다른 브라우저·시크릿 창·데이터 삭제 뒤엔 새 게스트가 된다. 10-09 정책(로그아웃 = 삭제 후 새 게스트) 시절에는 누를 때마다 새 계정이 생겼다.
- 매일 03:15 KST `guestLifecycleSweep` 가 30일 미활동 게스트를 지운다(변경 없음).

## 바꾼 것

| 파일 | 내용 |
|---|---|
| `apps/web/src/components/UserInfoSheet.tsx` | `showLogout = props.user != null && !props.isGuest` — 게스트 계정 패널에 로그아웃 없음, 「회원 등록」만. Google 계정은 그대로 |
| `apps/web/e2e/guest-lifecycle.spec.ts` | `endSession` — 낡은 「종료」 버튼 클릭(10-23 이름 변경 뒤 이미 맞지 않던 시험) 대신 ① 게스트 패널에 로그아웃 0개 확인 ② 옛 빌드가 남긴 「이용 종료」 표시 `boxcycle_app_use_ended_v1` 를 세우고 새로고침. 같은 Guest 복귀 계약(3회 반복·uid 유지·계정 증가 0)은 그대로 |
| `apps/web/scripts/identity/guest-lifecycle-e2e-static.test.ts` | 위 spec 계약을 「종료 버튼 클릭」 → 「로그아웃 부재 단언 + 옛 표시 사용, `name: '종료'` 금지」로 |
| `apps/web/scripts/identity/start-screen-after-deletion.test.ts` | 새 단언: `showLogout` 이 게스트를 뺀다 |
| `apps/web/e2e/account-deletion-ui-shots.spec.ts` | 게스트 패널 「종료 보임」 → 「로그아웃 0개」 |

남긴 것: 「이용 종료」 상태 처리(`endAppUse`·시작 메뉴·같은 Guest 복귀)는 그대로 둔다 — 이미 로그아웃한 기기(옛 빌드)가 돌아오는 길이다.

## 시험

| 검사 | 결과 |
|---|---|
| tsc · test:quick(정적 계약 포함) · eslint 변경 파일 | exit 0 · 1361/1361 · 오류 0(UserInfoSheet 기존 경고 2) |
| 잠금 ui-800x360·batch3(게스트 패널 「기록 지키기」)·batch4 | 52 PASS |
| `guest-lifecycle.spec.ts`·`account-deletion-ui-shots.spec.ts`(에뮬레이터 전용) | **미실행** — 에뮬레이터 재실행은 Chief 허락 대기(감리73 메모리 부족 중단) |

## 판정

정적·화면 범위 PASS. 에뮬레이터 실행분은 미완.
