# 결과 15 — 계정 탈퇴 통합 시험(에뮬레이터)

- 담당: Developer(Cursor CLI) · 지시: [02-task-15.md](02-task-15.md)
- 시각: 2026-10-07 · 커밋 **안 함**
- 제품 코드 **미수정** (결함 시 보고만)

## 판정

**DEVELOPMENT_DONE** — 에뮬레이터 HTTP 통합 시험 ALL PASS. UI 촬영 3장 확보. `functions npm test` 46 pass, `apps/web tsc -b --noEmit` 0. 시나리오 (d) stale `auth_time` 은 Auth 에뮬레이터 API 부재로 SKIP(사유 기록).

## 산출물

| 경로 | 역할 |
|---|---|
| `apps/web/scripts/account-deletion/account-deletion-emulator.e2e.mjs` | Auth·Firestore·RTDB·Functions 에뮬레이터에서 `deleteAccountHttp` HTTP 직접 호출 |
| `apps/web/package.json` → `test:e2e:account-deletion` | `run-with-deadline` + `run-with-functions-emulator` 래퍼(지시 허용 한 줄) |
| `apps/web/e2e/account-deletion-ui-shots.spec.ts` | 게스트 확인 화면 + 정식 계정 탈퇴 확인 마크업 촬영 |
| `shots-15/` | UI 캡처 3장 |

이전 실행(메모리 부족)에서 남은 위 산출물을 검토·보완한 뒤 검증을 완료했다. 제품 소스는 건드리지 않았다.

## 시나리오 결과표

| # | 시나리오 | 결과 | 근거 |
|---|---|---|---|
| 1–3 | A·B 시드 → A `confirmPhrase:"탈퇴"` → 200 `{result:{ok:true}}` · A 개인 문서·닉네임·RTDB motion·Auth 삭제 · `routePublications` 유지(`applicantUid==""`,`publisherDeleted==true`) · B 유지 | **PASS** | `firestoreDocsDeleted:12`, `nicknameReleased:true`, `publicationsAnonymized:1`, `rtdbMotionNodesRemoved:1`, `stripe:skipped` |
| 4a | 토큰 없음 → 401 | **PASS** | status 401 |
| 4b | 확인 문구 틀림 → 400 INVALID_ARGUMENT | **PASS** | `"확인 문구 「탈퇴」를 정확히 입력하세요."` |
| 4c | 익명(게스트) → failed-precondition | **PASS** | 400 FAILED_PRECONDITION · 게스트 안내 문구 |
| 4d | `auth_time` 5분 초과 → `requires-recent-login` | **SKIP** | Auth 에뮬레이터 REST/`signUp` idToken 의 `auth_time` 은 항상 최근. 임의로 오래된 `auth_time` 을 넣는 API 없음 |
| 4e | 같은 사용자 두 번째 호출 → 401 · 데이터 손상 없음 | **PASS** | 401 UNAUTHENTICATED(`유효하지 않은 인증 토큰`) · pub 익명화·B users/Auth 유지 |

## 검증 명령

| 명령 | 결과 |
|---|---|
| `cd apps/web && npm run test:e2e:account-deletion` | **PASS** · exit 0 · elapsed≈97s |
| `npx playwright test account-deletion-ui-shots --grep "정식 계정" --workers=1 --retries=0` | **1 passed** (에뮬레이터 불필요 · 마크업 렌더) |
| `… run-with-functions-emulator … "npx playwright test e2e/account-deletion-ui-shots.spec.ts:21 --workers=1 --retries=0"` | **1 passed** (게스트 라이브) |
| `cd functions && npm test` | **46 pass / 0 fail** (accountDeletionCore 계약 포함) |
| `cd apps/web && npx tsc -b --noEmit` | **0** |

메모리 절약: Playwright는 `--workers=1`, 게스트·정식 확인 촬영을 **한 번에 하나씩** 실행.

## 촬영 (`shots-15/`)

| 파일 | 내용 |
|---|---|
| `01-guest-device-clear-confirm.png` | 게스트 사용자 정보 시트 — 「이 기기 데이터 지우기」 확인(취소·지우기) |
| `02-delete-confirm-disabled.png` | 정식 계정 탈퇴 확인 — 입력 전 「탈퇴」 버튼 비활성(컴포넌트 CSS·마크업 직접 렌더) |
| `03-delete-confirm-enabled.png` | 「탈퇴」 입력 후 버튼 활성 |

정식 계정 전체 앱 플로(Google 팝업 재인증)는 헤드리스 불가 — 지시대로 확인 UI 마크업 촬영으로 대체.

## 발견한 결함

없음. (제품 코드 수정 없음)

## 비고

- 에뮬레이터 기동 시 `STRIPE_SECRET_KEY` 시크릿 접근 로그가 있으나, 시드에 `stripeSubscriptionId` 없음 → `stripe:skipped`(의도).
- `accountDeletions/{uid}` 진행 로그는 정책상 보존(`ACCOUNT_DELETION_POLICY.accountDeletions: none`) — 지시 검증 대상(개인 데이터·익명화·Auth)과 충돌 없음.
