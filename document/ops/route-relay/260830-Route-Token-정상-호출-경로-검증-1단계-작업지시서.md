# Route Token 정상 호출 경로 검증 1단계 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — Route Token 정상 호출 경로·검증 Harness 구축 |
| 최초 작성 | 2026-08-30 |
| 상태 | **부분 수행 · `ROUTE-TOKEN-1R` 보완 필요** |
| 작업 ID | `ROUTE-TOKEN-1` |
| 기준 브랜치 | `origin/main2` |
| 작업 브랜치 | `chore/route-token-harness` — 전용 worktree에서만 수행 |
| 보호 대상 | `feat/distance-based-auto-route` 현재 WIP — commit·stash·rebase·merge·checkout 금지 |
| 연결 문서 | [Route Token 경제 설계](../../260518-Route-Token-경제-설계.md) · [Skill·Harness 아키텍처](../../260722-Skill-Harness-아키텍처.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 후속 지시: [Route Token Harness 격리 보완 1R](260830-Route-Token-Harness-격리-보완-1R-작업지시서.md)을 우선 수행한다.

> 개발팀장에게 전달할 한 줄: **이 문서를 읽고 `ROUTE-TOKEN-1`만 수행하라. 기존 자동 Route WIP와 섞지 말고 `origin/main2` 기반 `chore/route-token-harness` 전용 worktree에서 작업하라. 작은 의미 단위로 로컬 commit하되, 완료 보고와 승인 전에 push·PR·merge하지 말라.**

---

## 0. 목적과 성공 기준

현재 localhost는 `VITE_DIRECTIONS_DIRECT=1`로 브라우저가 Mapbox를 직접 호출할 수 있다. 이 경로는 Cloud Function과 Route Token 차감을 건너뛴다. 그렇다고 우회만 끄면 운영 Firestore를 테스트 데이터로 오염시킬 수 있다.

이번 단계에서는 다음 격리 경로를 만든다.

```text
로컬 앱
  → Functions Emulator
  → Auth / Firestore Emulator
  → 가짜 Mapbox
```

**성공 기준:** 새 Guest가 온보딩 `+3`을 한 번만 받고, 일반 Route 생성 3회로 `3 → 2 → 1 → 0`이 된다. 4번째는 provider 호출 **전에** `resource-exhausted`로 거부된다. 이를 balance·ledger·provider 호출 수로 자동 증명한다.

---

## 1. 확정된 사실과 아직 확정하지 않을 제안

### 1.1 확정된 사실

| 항목 | 판정 |
|---|---|
| Route Token 서버 로직 | `getMapboxDirections` 호출 시 `spendRouteGenerateToken` 실행 |
| 온보딩 지급 | 계정 최초 1회 `+3`; 매일 3개 지급이 아님 |
| 일반 Route 생성 | 서버 경유 요청 1회당 기본 `-1` |
| 현재 localhost | `VITE_DIRECTIONS_DIRECT=1`로 서버·Token 경로 우회 |
| Guest의 7회 이상 생성 | 예외 계정이라서가 아니라 로컬 직접 호출 때문 |
| 계정 화이트리스트 | 현재 확인된 코드 없음 |

Route Token은 **RTW 내부 보상·사용량 시스템**이다. Mapbox access token과 다른 개념이다.

### 1.2 이번에 구현하지 않을 자문 제안

- `자동 Route 1회 = Route Token 1개`를 보장하는 server transaction
- Matrix API로 후보 거리를 평가하고 Directions를 최종 1회만 호출하는 방식
- 탐색·provider 실패의 Token 차감·환불 정책
- staging Firebase 프로젝트 신설
- Mapbox 과금·Matrix 제한값

이는 자문위원의 유용한 **제안**이지 아직 RTW의 확정 설계가 아니다. 2단계에서 공식 문서·실측 결과로 비교한다.

---

## 2. 전체 작업을 나눈 덩어리

| 단계 | 목표 | 이번 수행 |
|---|---|:---:|
| 1 | Emulator·가짜 Mapbox로 일반 Route Token 계약 증명 | **●** |
| 2 | `자동 Route 1회 = Token 1개` 정책·실패 처리·API·비용 설계 | × |
| 3 | 자동 Route 서버 transaction과 후보 평가 구현 | × |
| 4 | staging·실 Mapbox 통합 검증·배포 우회 차단 | × |
| 5 | 기본 Route 선택창 진입·Start 마커·자동 Route·실패 UX·성능 E2E | × |

**1단계 완료 보고 후 승인을 받아야 2단계로 간다.**

### 2.1 Git 브랜치·worktree 규칙

이 Harness는 자동 Route 기능 구현과 생명주기가 다른 독립 검증 기반이다. 따라서 현재 미커밋 WIP가 있는 `feat/distance-based-auto-route`에 추가하지 않는다.

1. 기존 작업 폴더에서 다음을 읽기 전용으로 기록한다.

   ```powershell
   git status --short --branch
   git rev-parse HEAD
   git branch --show-current
   git worktree list
   ```

2. `origin/main2`를 갱신하고 기준 commit SHA를 기록한다.

   ```powershell
   git fetch origin main2
   git rev-parse origin/main2
   ```

3. 기존 경로·브랜치가 없음을 확인한 후 전용 worktree를 만든다.

   ```powershell
   git branch --list chore/route-token-harness
   Test-Path -LiteralPath '..\boxcycle-route-token-harness'
   git worktree add '..\boxcycle-route-token-harness' -b chore/route-token-harness origin/main2
   Set-Location '..\boxcycle-route-token-harness'
   git config core.hooksPath githooks
   git status --short --branch
   ```

   브랜치나 경로가 이미 있으면 삭제·강제 재생성하지 말고 상태를 보고하라.

4. 1단계에서 필요한 코드가 `feat/distance-based-auto-route`에만 있다면 cherry-pick하지 말라. 이는 기능 의존성 발견이므로 BLOCK으로 보고한다.

### 2.2 커밋·푸시·병합 규칙

- 커밋은 `chore/route-token-harness`에서만 작은 의미 단위로 남긴다.
- 커밋 전 `git diff --check`, 필수 게이트, `git diff --cached --name-only`, `git diff --cached`를 확인한다.
- `githooks` 가드를 활성화하고 `--no-verify`를 사용하지 않는다.
- 권장 커밋 단위:
  - `test(route-token): add emulator contract harness`
  - 운영법 문서가 독립적으로 분리될 때만 `docs(route-token): document harness workflow`
- `WIP`, `misc`, `fix stuff` 같은 커밋 메시지를 쓰지 않는다.
- 완료 보고 전에는 **로컬 commit만 허용**한다. push·PR·merge는 금지한다.
- 사용자 검토·승인 후에만 push하고 PR 대상을 `main2`로 잡는다. `main`으로 직접 PR·merge하지 않는다.
- `main2` 병합과 게이트 통과가 확인된 후에만 worktree와 로컬·원격 작업 브랜치를 정리한다. 삭제는 별도 승인 후 수행한다.
- 병합 후 `feat/distance-based-auto-route`를 업데이트하는 일은 2단계 지시 전까지 하지 않는다.

---

## 3. 이번 단계의 검증 계약

### 3.1 온보딩·일반 Route

1. 새 Guest 익명 인증 후 온보딩 ledger `+3` 1건, balance `3`
2. 온보딩 재시도에는 추가 지급 없음
3. 일반 Route 생성 성공당 `route_generate -1` 1건
4. 3회 성공 후 balance `0`
5. 4번째는 `resource-exhausted`; balance·ledger 불변
6. 4번째 거부 요청은 provider를 호출하지 않음
7. 동일 `requestId` 재시도는 중복 차감하지 않음

### 3.2 provider 실패

가짜 provider가 의도적으로 실패하는 시나리오를 넣는다.

- 새 Guest balance `3` → provider 실패 후 순 balance `3`
- ledger에 차감·환불이 따로 남더라도 순변화는 `0`
- 동일 실패 요청 재시도가 추가 차감을 만들지 않음

현재 서버 계약과 다르면 임의로 정책을 고치지 말고 실패 결과와 현재 행동을 보고하라. 정책 변경은 2단계다.

---

## 4. 구현 범위

### 4.1 Harness

[Skill·Harness 아키텍처](../../260722-Skill-Harness-아키텍처.md)에 따라 다음 경로에 둔다.

```text
apps/web/scripts/route-token/
  HARNESS.md
  <실행·검증 코드>
```

`HARNESS.md`에는 검증 계약, Emulator·port, 시작·초기화·종료, 가짜 Mapbox 활성 조건, balance·ledger·provider 호출 수 확인법, 성공 출력 예시를 적다.

권장 명령은 다음이다.

```powershell
npm -w boxcycle-web run test:route-token
```

### 4.2 격리 조건

- Auth·Firestore·Functions Emulator 사용
- 운영과 혼동되지 않는 demo/test project ID 사용
- Emulator 호스트 환경변수가 없으면 즉시 실패; 운영으로 fallback 금지
- Functions Emulator에서만 활성화되는 가짜 Mapbox 사용
- 가짜 provider는 성공·실패·호출 수를 결정적으로 제어·조회 가능
- 가짜 provider 활성화를 브라우저 입력으로 지정할 수 없음
- 실제 Mapbox token·외부 네트워크 불필요

### 4.3 localhost 프론트엔드

- 검증 명령에서 `VITE_DIRECTIONS_DIRECT` 미지정 또는 false
- 브라우저 → 실제 Mapbox 직접 요청 `0`
- 개인 `.env.local`은 삭제·덮어쓰지 않고 전용 명령·환경 파일로 검증 조건을 고정

---

## 5. 실행 순서

### A. 안전선

1. §2.1의 현재 WIP 기록과 전용 worktree 분리를 먼저 완료한다.
2. 기존 변경을 reset·checkout·stash·삭제하지 말라.
3. Route Token 설계·차감·환불·직접 호출 분기를 읽고 호출 흐름을 보고하라.
4. 작업 중 항상 `chore/route-token-harness`인지 확인하고 다른 브랜치에서는 파일을 수정하지 말라.

### B. Harness 구축

1. `HARNESS.md`를 먼저 작성한다.
2. Emulator 시작·초기화·종료를 한 명령으로 재현하게 한다.
3. 가짜 Mapbox 성공·실패·호출 수 계측을 넣는다.
4. 운영 접속 방지 가드 자체도 실패 시나리오로 시험한다.

### C. 서버 계약 자동 검증

1. 새 Guest를 만든다.
2. 일반 Route 3회 성공과 4번째 거부를 실행한다.
3. 각 단계의 응답·balance·ledger·provider 호출 수를 함께 저장한다.
4. 온보딩 재시도·동일 `requestId`·provider 실패를 검증한다.
5. 매 실행이 독립된 새 Emulator 데이터에서 같은 결과를 내야 한다.

### D. UI smoke 1회

자동 서버 검증 통과 후 새 Guest로 일반 Route 3회 성공 → 4번째 거부를 브라우저에서 한 번만 확인한다.

- 화면 잔액과 실제 balance 일치
- 4번째에 Token 부족 안내 표시
- 실제 Mapbox 직접 요청 0건
- 같은 시점의 balance·ledger·provider 호출 수 캡처

UI 표시 문제를 발견해도 이번에 개편하지 말고 재현 증거만 보고하라.

---

## 6. 통과표

| 순서 | 요청 | 결과 | balance | 누적 `route_generate -1` | provider 누적 호출 |
|---:|---|---|---:|---:|---:|
| 0 | Guest 온보딩 | 성공 | 3 | 0 | 0 |
| 1 | 일반 Route 1 | 성공 | 2 | 1 | 1 |
| 2 | 일반 Route 2 | 성공 | 1 | 2 | 2 |
| 3 | 일반 Route 3 | 성공 | 0 | 3 | 3 |
| 4 | 일반 Route 4 | `resource-exhausted` | 0 | 3 | 3 |

추가 통과 조건:

- 온보딩 재시도해도 balance 3, 온보딩 ledger 1건
- 동일 `requestId` 재시도 시 추가 차감 없음
- provider 실패 후 순 balance 변화 0
- 운영 Firebase 읽기·쓰기 0건, 실 Mapbox 호출 0건
- 브라우저의 Mapbox 직접 요청 0건

필수 명령:

```powershell
npm -w boxcycle-web run test:route-token
npm run build
```

변경 파일 단위 정적 검사도 실행하고 신규 진단 `0`을 보고하라.

---

## 7. 금지 사항

- 운영 Firebase·Firestore·Auth 데이터 시드·차감·삭제
- 실제 Mapbox Directions·Matrix 호출
- 개인 `.env.local` 삭제·덮어쓰기
- 자동 Route 후보 수·거리·방향·병렬 처리 변경
- Matrix API 도입
- Route Token 지급량·차감량·일일 획득 상한 변경
- UI·Start 마커·MENU 진입 흐름 수정
- `feat/distance-based-auto-route` WIP의 commit·stash·reset·revert·checkout·rebase·merge
- 다른 기능 변경을 Harness 커밋에 포함
- `--no-verify` 사용
- 완료 보고·승인 전 push·PR·merge
- `main`으로 직접 push·PR·merge

---

## 8. 완료 보고 형식

1. `ROUTE-TOKEN-1` PASS / FAIL
2. demo project ID, Emulator·port, 직접 호출 OFF 증거
3. 브라우저/API → Function → Token → 가짜 provider 호출 흐름
4. 요청별 응답·balance·ledger·provider 호출 수 결과표
5. provider 실패·온보딩 재시도·동일 `requestId` 결과
6. UI smoke 캡처
7. 변경 파일과 이유
8. `test:route-token`, build, 변경 파일 정적 검사 원문
9. 후속 단계로 보낼 발견 사항
10. **Git 기준선:** `origin/main2` SHA, 작업 브랜치, worktree 경로, `merge-base`
11. **Git 결과:** 로컬 commit hash·제목·파일 범위, `git status --short --branch`, push·PR·merge 없음 확인
12. **변경 격리:** `feat/distance-based-auto-route` 작업 전·후 SHA·status가 같음을 확인

**PASS는 자동 Route 승인이 아니다.** 2단계의 제품·API 설계를 시작할 수 있는 검증 기반이 마련됐다는 뜻이다.
