# Route Token Harness 실패 복구·UI 재현성 1R2 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — `ROUTE-TOKEN-1R` 재검토에서 발견된 runner 원상복구·UI smoke 재현성 결함 보완 |
| 최초 작성 | 2026-08-30 |
| 상태 | **1R 부분 통과 · 1R2 실행 대기** |
| 작업 ID | `ROUTE-TOKEN-1R2` |
| 작업 worktree | `C:\20.HDev\boxcycle-route-token-harness` |
| 작업 브랜치 | `chore/route-token-harness` 계속 사용 |
| 기준 commit | `9f68a4b0a463465ee4389696290c27f225fca31d` |
| 재검토로 남은 상태 | `functions/package.json` 임시 main 변경·`functions/.secret.local`·루트 `test-results/` — 아래 안전 절차로만 정리 |
| 연결 문서 | [1R 작업지시서](260830-Route-Token-Harness-격리-보완-1R-작업지시서.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

**
Route Token Harness 실패 복구·UI 재현성 1R2 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — `ROUTE-TOKEN-1R` 재검토에서 발견된 runner 원상복구·UI smoke 재현성 결함 보완 |
| 최초 작성 | 2026-08-30 |
| 상태 | **1R 부분 통과 · 1R2 실행 대기** |
| 작업 ID | `ROUTE-TOKEN-1R2` |
| 작업 worktree | `C:\20.HDev\boxcycle-route-token-harness` |
| 작업 브랜치 | `chore/route-token-harness` 계속 사용 |
| 기준 commit | `9f68a4b0a463465ee4389696290c27f225fca31d` |
| 재검토로 남은 상태 | `functions/package.json` 임시 main 변경·`functions/.secret.local`·루트 `test-results/` — 아래 안전 절차로만 정리 |
| 연결 문서 | [1R 작업지시서](260830-Route-Token-Harness-격리-보완-1R-작업지시서.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 개발팀장에게 전달할 한 줄: **`ca2563f`·`9f68a4b`를 보존하고 같은 worktree에서 `ROUTE-TOKEN-1R2`만 수행하라. runner가 성공·실패 모두에서 추적 파일·임시 secret·프로세스를 원상복구하게 하고, UI smoke가 Route 응답 `2→1→0`·ledger 3건·provider 3회·4번째 차단을 직접 증명하게 하라. Node 24 경고를 PASS로 인정하지 말고 재검토 전 push·PR·merge하지 말라.**

---

## 0. 1R 재검토 결과

### 0.1 통과한 부분

| 항목 | 결과 |
|---|---|
| Harness 활성화 3조건 AND | 6케이스 PASS |
| runner 부정 가드 | 4케이스 PASS |
| 운영 Functions 표면 | `routeTokenHarnessControl` 미포함 3검사 PASS |
| 일반 Route Token API 계약 | `3→2→1→0→resource-exhausted` PASS |
| provider 실패 환불 | PASS |
| Secret Manager 금지 로그 | PASS; 이번 실행에서 외부 secret 조회 없음 |
| web build | PASS; 기존 `SADDLE`·`PELVIS`·chunk 경고 존재 |
| 실제 원격 상태 | 미푸시; 원격 브랜치·PR 없음 |

### 0.2 실패한 부분

`npm -w boxcycle-web run test:route-token`을 현재 HEAD에서 재실행한 결과:

```text
UI smoke FAIL
Expected: "경로 토큰 부족" visible
Actual: element not found after 10 seconds
exit code: 1
```

따라서 `ROUTE-TOKEN-1R` 전체는 **FAIL**이다.

### 0.3 실패 후 원상복구 결함

runner 내부 함수가 `process.exit()`로 프로세스를 즉시 종료해 바깥 `finally`가 실행되지 않았다.

그 결과:

| 항목 | 실패 후 상태 |
|---|---|
| `functions/package.json` | `main: lib/index.harness.js`로 추적 변경 남음 |
| `functions/.secret.local` | Harness placeholder 남음 |
| 루트 `test-results/` | 미추적 Playwright 산출물 남음 |
| worktree | clean 아님 |
| Node runtime | 요구 20이지만 24.11.1로 실행; 경고만 출력 |

---

## 1. 이번 보완 범위

### 1.1 수정할 것

- Harness runner의 성공·실패·예외 종료 원상복구
- 시험 중 추적 파일을 임시 변경하는 방식 제거 또는 완전한 안전 대체
- Playwright 산출물 경로를 무시 대상 내부로 고정
- UI smoke의 Route 응답·balance·ledger·provider 직접 검증
- 실패해도 Directions 직접 호출 0건 검사가 반드시 수행되는 구조
- Node 20 실행 게이트

### 1.2 수정하지 않을 것

- 자동 Route 알고리즘·Token transaction·Matrix·staging
- Route Token 지급·차감·환불 정책
- 실제 UI 문구·레이아웃·색상·MENU 진입
- `feat/distance-based-auto-route` 코드·WIP
- `main2`·`main`·원격 브랜치

---

## 2. 시작 전 정확한 산출물 정리

아래 세 항목은 재검토가 만든 산출물임을 확인했다. 개발팀장은 **정확한 대상만** 정리할 수 있다.

1. `functions/package.json` diff가 `main: lib/index.js → lib/index.harness.js` 한 줄뿐인지 확인한다.
2. `functions/.secret.local`이 `MAPBOX_ACCESS_TOKEN=harness-emulator-placeholder-not-real` 한 줄인지 확인한다.
3. 루트 `test-results/` 내용을 1R2 실패 증거로 보고에 복사한다.
4. 이 세 조건이 정확히 맞을 때만:
   - `functions/package.json`을 HEAD의 `lib/index.js`로 복구
   - 위 placeholder 한 줄만 든 `functions/.secret.local`을 삭제
   - 루트 `test-results/`만 삭제
5. 다른 내용이 하나라도 있으면 삭제·복구하지 말고 BLOCK으로 보고한다.
6. 정리 후 `git status --short --branch`가 `chore/route-token-harness...origin/main2 [ahead 3]` 이외의 파일을 표시하지 않아야 한다.

`feat/distance-based-auto-route` worktree는 정리 대상이 아니다.

---

## 3. runner 원상복구 계약

### 3.1 추적 파일 변경 금지

가장 안전한 해법은 시험이 `functions/package.json`을 수정하지 않는 것이다. 임시 Functions source·config·entry 방식 등으로 Harness entry를 지정하라.

부득이하게 추적 파일을 임시 변경해야 한다면 다음이 모두 필수다.

- helper에서 `process.exit()` 호출 금지; 오류를 throw하거나 status를 반환
- 최상위 `finally` 종료 후에만 `process.exitCode` 설정
- 시그널·자식 프로세스 실패·Playwright 실패 모두 같은 cleanup 경로 사용
- 기존 파일이 있으면 덮어쓰지 않고 시작 실패
- cleanup 자체가 실패하면 원래 실패보다 더 높은 우선순위로 보고

### 3.2 실패 복구 자동 시험

의도적으로 UI smoke를 실패시키는 전용 test mode를 두고 다음을 자동 검증하라.

| 항목 | 기대 |
|---|---|
| runner exit | 0이 아님 |
| `functions/package.json` | 실행 전·후 byte 동일, main `lib/index.js` |
| `functions/.secret.local` | 실행 전 없으면 실행 후도 없음 |
| Playwright 결과 | `.gitignore`가 적용되는 전용 경로에만 존재 |
| port/process | 5001·5010·8080·9099 잔류 없음 |
| Git | 실행 전·후 상태 동일 |

이 시험은 성공 path만 확인하는 `finally`의 가짜 안전성을 막는 회귀 게이트다.

---

## 4. UI smoke 재현성 계약

### 4.1 성공 판정을 `/km/` 텍스트로 하지 말 것

현재 시험의 `page.getByText(/km/).first()`는 HUD에 항상 보이는 거리를 성공으로 오인할 수 있다. 따라서 Route 생성 완료 증거로 사용하지 말 것.

각 1·2·3번째 Route는 다음을 직접 기다려야 한다.

- `getMapboxDirections` **POST** 응답 1건
- HTTP 200
- 응답의 `routeTokenBalance`: `2`, `1`, `0`
- 응답에 유효한 geometry·distance·duration

OPTIONS preflight를 Route 생성으로 세지 말 것.

### 4.2 세 번째 후 backend·UI 동기화

3번째 응답 후 Harness control API를 polling하여 다음을 먼저 확인한다.

```text
balance = 0
route_generate -1 = 3건
providerCallCount = 3
```

그 후 4번째 Start·End를 설정하고:

- `경로 토큰 부족 · 주행 완료 시 획득` 또는 현재 UI의 동일 의미 문구 표시
- profile 선택을 누르기 전 차단 상태
- providerCallCount 계속 3
- balance 0·ledger 3건 유지

를 확인한다.

### 4.3 Directions 직접 호출 검사는 실패해도 수행

`/directions/v5/` 직접 요청 검사를 test body 마지막에만 두지 말라. 중간 assertion이 실패해도 `afterEach`·fixture cleanup 등으로 반드시 판정하라.

Mapbox style·tile 요청은 허용하되 Directions endpoint는 0건이어야 한다.

### 4.4 신규·실패 증거 혼합 금지

- 실행 전 기존 `ui-smoke-*.png`·Playwright result를 전용 경로에서 정리
- 해당 run에서 새로 만든 timestamp·run ID 증거만 보고
- `.last-run.json` 또는 동등한 결과가 `passed`
- 스크린샷 시간이 실행 로그 시간과 일치

---

## 5. Node 20·실행 게이트

`assertNodeMajor20()`은 경고만 내고 계속해서는 안 된다.

- Node major가 20이 아니면 시험 시작 전 실패
- 또는 runner가 프로젝트가 지정한 Node 20 실행 경로를 명시적으로 사용
- 완료 보고에 host Node·Functions Emulator Node·build Node를 각각 적을 것

Node 20을 사용할 수 없으면 PASS로 보고하지 말고 BLOCK으로 보고하라.

---

## 6. Git 지시

- 같은 `chore/route-token-harness` worktree만 사용
- `ca2563f`·`9f68a4b` amend·reset·rebase 금지
- 시작 산출물 정리 후 새 후속 커밋으로 남길 것
- 권장 커밋 1: `fix(route-token): restore harness state after failures`
- 권장 커밋 2: `test(route-token): make UI token smoke deterministic`
- 커밋 전 `git diff --check`, 스테이징 목록·diff, 필수 게이트 확인
- `--no-verify` 금지
- 재검토 전 push·upstream 변경·PR·merge 금지
- 루트 `test-results/`를 커밋하지 말 것
- 종료 시 worktree clean 필수
- `feat/distance-based-auto-route` 무변경 증명

---

## 7. 실행 순서

1. §2의 정확한 실패 산출물만 정리한다.
2. runner의 임시 추적 파일 변경을 제거하거나 실패에도 복구되게 한다.
3. 의도 실패 복구 시험을 먼저 추가한다.
4. UI Route 성공 판정을 응답·Token 수치 기반으로 교체한다.
5. backend `0 / 3 / 3`을 확인한 후 4번째 UI 차단을 검증한다.
6. Node 20에서 의도 실패 게이트 1회를 먼저 통과한다.
7. Node 20에서 전체 Harness를 **연속 2회** 실행한다.
8. 두 번 모두 PASS·worktree clean·신규 증거임을 확인한다.
9. 작은 의미 단위로 로컬 commit하고 push하지 말라.
10. §9 형식으로 보고한다.

---

## 8. 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
git status --short --branch
```

추가 필수:

- 의도된 UI 실패 후 cleanup 자동 시험 PASS
- 전체 Harness 2회 연속 PASS
- 두 실행 모두 Node 20
- Secret Manager 0건, Mapbox Directions 0건
- 각 실행 후 `functions/package.json` main `lib/index.js`
- 각 실행 후 `functions/.secret.local` 잔류 없음
- 각 실행 후 port·자식 프로세스 잔류 없음
- 최종 worktree clean

하나라도 빠지면 PASS로 보고하지 말 것.

---

## 9. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-1R2` PASS / FAIL / BLOCK
2. **시작 복구:** 정리한 3개 산출물의 확인·복구 증거
3. **runner 설계:** 추적 파일·secret·자식 프로세스 복구 경로
4. **의도 실패:** non-zero exit·원상복구·Git 상태·port 결과표
5. **UI Route 응답:** 1·2·3번째 HTTP·`routeTokenBalance 2·1·0`·geometry 결과
6. **backend 상탁:** 3번째 후 balance 0·ledger 3·provider 3, 4번째 후 불변
7. **UI 차단:** Token 부족 화면·profile 사전 차단
8. **Network:** 성공·실패 모두 Directions 직접 호출 0건
9. **신규 증거:** 2회 실행 별 run ID·로그·스크린샷·Playwright passed
10. **Runtime:** host·build·Functions Emulator 모두 Node 20 증거
11. **게이트:** Harness 2회·Functions build·web build·diff check 원문
12. **Git:** 후속 commit hash·제목·파일, clean status, 미푸시·PR 없음
13. **보호:** `feat/distance-based-auto-route` HEAD `2b0bfec`·WIP 무변경

`ROUTE-TOKEN-1R2` PASS 후에도 2단계를 자동으로 시작하지 말 것. 먼저 Harness 브랜치의 push·PR 여부를 검토받는다.
---

## 0. 1R 재검토 결과

### 0.1 통과한 부분

| 항목 | 결과 |
|---|---|
| Harness 활성화 3조건 AND | 6케이스 PASS |
| runner 부정 가드 | 4케이스 PASS |
| 운영 Functions 표면 | `routeTokenHarnessControl` 미포함 3검사 PASS |
| 일반 Route Token API 계약 | `3→2→1→0→resource-exhausted` PASS |
| provider 실패 환불 | PASS |
| Secret Manager 금지 로그 | PASS; 이번 실행에서 외부 secret 조회 없음 |
| web build | PASS; 기존 `SADDLE`·`PELVIS`·chunk 경고 존재 |
| 실제 원격 상태 | 미푸시; 원격 브랜치·PR 없음 |

### 0.2 실패한 부분

`npm -w boxcycle-web run test:route-token`을 현재 HEAD에서 재실행한 결과:

```text
UI smoke FAIL
Expected: "경로 토큰 부족" visible
Actual: element not found after 10 seconds
exit code: 1
```

따라서 `ROUTE-TOKEN-1R` 전체는 **FAIL**이다.

### 0.3 실패 후 원상복구 결함

runner 내부 함수가 `process.exit()`로 프로세스를 즉시 종료해 바깥 `finally`가 실행되지 않았다.

그 결과:

| 항목 | 실패 후 상태 |
|---|---|
| `functions/package.json` | `main: lib/index.harness.js`로 추적 변경 남음 |
| `functions/.secret.local` | Harness placeholder 남음 |
| 루트 `test-results/` | 미추적 Playwright 산출물 남음 |
| worktree | clean 아님 |
| Node runtime | 요구 20이지만 24.11.1로 실행; 경고만 출력 |

---

## 1. 이번 보완 범위

### 1.1 수정할 것

- Harness runner의 성공·실패·예외 종료 원상복구
- 시험 중 추적 파일을 임시 변경하는 방식 제거 또는 완전한 안전 대체
- Playwright 산출물 경로를 무시 대상 내부로 고정
- UI smoke의 Route 응답·balance·ledger·provider 직접 검증
- 실패해도 Directions 직접 호출 0건 검사가 반드시 수행되는 구조
- Node 20 실행 게이트

### 1.2 수정하지 않을 것

- 자동 Route 알고리즘·Token transaction·Matrix·staging
- Route Token 지급·차감·환불 정책
- 실제 UI 문구·레이아웃·색상·MENU 진입
- `feat/distance-based-auto-route` 코드·WIP
- `main2`·`main`·원격 브랜치

---

## 2. 시작 전 정확한 산출물 정리

아래 세 항목은 재검토가 만든 산출물임을 확인했다. 개발팀장은 **정확한 대상만** 정리할 수 있다.

1. `functions/package.json` diff가 `main: lib/index.js → lib/index.harness.js` 한 줄뿐인지 확인한다.
2. `functions/.secret.local`이 `MAPBOX_ACCESS_TOKEN=harness-emulator-placeholder-not-real` 한 줄인지 확인한다.
3. 루트 `test-results/` 내용을 1R2 실패 증거로 보고에 복사한다.
4. 이 세 조건이 정확히 맞을 때만:
   - `functions/package.json`을 HEAD의 `lib/index.js`로 복구
   - 위 placeholder 한 줄만 든 `functions/.secret.local`을 삭제
   - 루트 `test-results/`만 삭제
5. 다른 내용이 하나라도 있으면 삭제·복구하지 말고 BLOCK으로 보고한다.
6. 정리 후 `git status --short --branch`가 `chore/route-token-harness...origin/main2 [ahead 3]` 이외의 파일을 표시하지 않아야 한다.

`feat/distance-based-auto-route` worktree는 정리 대상이 아니다.

---

## 3. runner 원상복구 계약

### 3.1 추적 파일 변경 금지

가장 안전한 해법은 시험이 `functions/package.json`을 수정하지 않는 것이다. 임시 Functions source·config·entry 방식 등으로 Harness entry를 지정하라.

부득이하게 추적 파일을 임시 변경해야 한다면 다음이 모두 필수다.

- helper에서 `process.exit()` 호출 금지; 오류를 throw하거나 status를 반환
- 최상위 `finally` 종료 후에만 `process.exitCode` 설정
- 시그널·자식 프로세스 실패·Playwright 실패 모두 같은 cleanup 경로 사용
- 기존 파일이 있으면 덮어쓰지 않고 시작 실패
- cleanup 자체가 실패하면 원래 실패보다 더 높은 우선순위로 보고

### 3.2 실패 복구 자동 시험

의도적으로 UI smoke를 실패시키는 전용 test mode를 두고 다음을 자동 검증하라.

| 항목 | 기대 |
|---|---|
| runner exit | 0이 아님 |
| `functions/package.json` | 실행 전·후 byte 동일, main `lib/index.js` |
| `functions/.secret.local` | 실행 전 없으면 실행 후도 없음 |
| Playwright 결과 | `.gitignore`가 적용되는 전용 경로에만 존재 |
| port/process | 5001·5010·8080·9099 잔류 없음 |
| Git | 실행 전·후 상태 동일 |

이 시험은 성공 path만 확인하는 `finally`의 가짜 안전성을 막는 회귀 게이트다.

---

## 4. UI smoke 재현성 계약

### 4.1 성공 판정을 `/km/` 텍스트로 하지 말 것

현재 시험의 `page.getByText(/km/).first()`는 HUD에 항상 보이는 거리를 성공으로 오인할 수 있다. 따라서 Route 생성 완료 증거로 사용하지 말 것.

각 1·2·3번째 Route는 다음을 직접 기다려야 한다.

- `getMapboxDirections` **POST** 응답 1건
- HTTP 200
- 응답의 `routeTokenBalance`: `2`, `1`, `0`
- 응답에 유효한 geometry·distance·duration

OPTIONS preflight를 Route 생성으로 세지 말 것.

### 4.2 세 번째 후 backend·UI 동기화

3번째 응답 후 Harness control API를 polling하여 다음을 먼저 확인한다.

```text
balance = 0
route_generate -1 = 3건
providerCallCount = 3
```

그 후 4번째 Start·End를 설정하고:

- `경로 토큰 부족 · 주행 완료 시 획득` 또는 현재 UI의 동일 의미 문구 표시
- profile 선택을 누르기 전 차단 상태
- providerCallCount 계속 3
- balance 0·ledger 3건 유지

를 확인한다.

### 4.3 Directions 직접 호출 검사는 실패해도 수행

`/directions/v5/` 직접 요청 검사를 test body 마지막에만 두지 말라. 중간 assertion이 실패해도 `afterEach`·fixture cleanup 등으로 반드시 판정하라.

Mapbox style·tile 요청은 허용하되 Directions endpoint는 0건이어야 한다.

### 4.4 신규·실패 증거 혼합 금지

- 실행 전 기존 `ui-smoke-*.png`·Playwright result를 전용 경로에서 정리
- 해당 run에서 새로 만든 timestamp·run ID 증거만 보고
- `.last-run.json` 또는 동등한 결과가 `passed`
- 스크린샷 시간이 실행 로그 시간과 일치

---

## 5. Node 20·실행 게이트

`assertNodeMajor20()`은 경고만 내고 계속해서는 안 된다.

- Node major가 20이 아니면 시험 시작 전 실패
- 또는 runner가 프로젝트가 지정한 Node 20 실행 경로를 명시적으로 사용
- 완료 보고에 host Node·Functions Emulator Node·build Node를 각각 적을 것

Node 20을 사용할 수 없으면 PASS로 보고하지 말고 BLOCK으로 보고하라.

---

## 6. Git 지시

- 같은 `chore/route-token-harness` worktree만 사용
- `ca2563f`·`9f68a4b` amend·reset·rebase 금지
- 시작 산출물 정리 후 새 후속 커밋으로 남길 것
- 권장 커밋 1: `fix(route-token): restore harness state after failures`
- 권장 커밋 2: `test(route-token): make UI token smoke deterministic`
- 커밋 전 `git diff --check`, 스테이징 목록·diff, 필수 게이트 확인
- `--no-verify` 금지
- 재검토 전 push·upstream 변경·PR·merge 금지
- 루트 `test-results/`를 커밋하지 말 것
- 종료 시 worktree clean 필수
- `feat/distance-based-auto-route` 무변경 증명

---

## 7. 실행 순서

1. §2의 정확한 실패 산출물만 정리한다.
2. runner의 임시 추적 파일 변경을 제거하거나 실패에도 복구되게 한다.
3. 의도 실패 복구 시험을 먼저 추가한다.
4. UI Route 성공 판정을 응답·Token 수치 기반으로 교체한다.
5. backend `0 / 3 / 3`을 확인한 후 4번째 UI 차단을 검증한다.
6. Node 20에서 의도 실패 게이트 1회를 먼저 통과한다.
7. Node 20에서 전체 Harness를 **연속 2회** 실행한다.
8. 두 번 모두 PASS·worktree clean·신규 증거임을 확인한다.
9. 작은 의미 단위로 로컬 commit하고 push하지 말라.
10. §9 형식으로 보고한다.

---

## 8. 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
git status --short --branch
```

추가 필수:

- 의도된 UI 실패 후 cleanup 자동 시험 PASS
- 전체 Harness 2회 연속 PASS
- 두 실행 모두 Node 20
- Secret Manager 0건, Mapbox Directions 0건
- 각 실행 후 `functions/package.json` main `lib/index.js`
- 각 실행 후 `functions/.secret.local` 잔류 없음
- 각 실행 후 port·자식 프로세스 잔류 없음
- 최종 worktree clean

하나라도 빠지면 PASS로 보고하지 말 것.

---

## 9. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-1R2` PASS / FAIL / BLOCK
2. **시작 복구:** 정리한 3개 산출물의 확인·복구 증거
3. **runner 설계:** 추적 파일·secret·자식 프로세스 복구 경로
4. **의도 실패:** non-zero exit·원상복구·Git 상태·port 결과표
5. **UI Route 응답:** 1·2·3번째 HTTP·`routeTokenBalance 2·1·0`·geometry 결과
6. **backend 상탁:** 3번째 후 balance 0·ledger 3·provider 3, 4번째 후 불변
7. **UI 차단:** Token 부족 화면·profile 사전 차단
8. **Network:** 성공·실패 모두 Directions 직접 호출 0건
9. **신규 증거:** 2회 실행 별 run ID·로그·스크린샷·Playwright passed
10. **Runtime:** host·build·Functions Emulator 모두 Node 20 증거
11. **게이트:** Harness 2회·Functions build·web build·diff check 원문
12. **Git:** 후속 commit hash·제목·파일, clean status, 미푸시·PR 없음
13. **보호:** `feat/distance-based-auto-route` HEAD `2b0bfec`·WIP 무변경

`ROUTE-TOKEN-1R2` PASS 후에도 2단계를 자동으로 시작하지 말 것. 먼저 Harness 브랜치의 push·PR 여부를 검토받는다.
