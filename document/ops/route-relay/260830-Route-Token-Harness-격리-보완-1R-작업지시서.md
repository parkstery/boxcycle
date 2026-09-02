# Route Token Harness 격리 보완 1R — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — `ROUTE-TOKEN-1` 검토에서 발견된 Harness 격리·증거 결함 보완 |
| 최초 작성 | 2026-08-30 |
| 상태 | **부분 수행 · `ROUTE-TOKEN-1R2` 보완 필요** |
| 작업 ID | `ROUTE-TOKEN-1R` |
| 작업 worktree | `C:\20.HDev\boxcycle-route-token-harness` |
| 작업 브랜치 | `chore/route-token-harness` 계속 사용 |
| 기준 commit | `2aff91287497a47b502e0c3ba9fbda1fc01a709c` |
| 최종 병합 대상 | 재검토·승인 후 `main2`; `main` 직접 금지 |
| 연결 문서 | [1단계 작업지시서](260830-Route-Token-정상-호출-경로-검증-1단계-작업지시서.md) · [Route Token 경제 설계](../../260518-Route-Token-경제-설계.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 재검토 결과 Harness 격리는 개선됐으나 UI smoke 재현성·실패 원상복구·Node 20 게이트가 미완료다. [1R2 작업지시서](260830-Route-Token-Harness-실패복구-UI-재현성-1R2-작업지시서.md)를 우선 수행한다.

> 개발팀장에게 전달할 한 줄: **`2aff912` 커밋을 보존하고 같은 `chore/route-token-harness` worktree에서 `ROUTE-TOKEN-1R`만 수행하라. Harness가 운영에서 발견·활성화될 수 없게 하고, Secret Manager 외부 접근 0건과 부정 조건 시험·UI smoke 증거를 완성하라. 재검토 전 push·PR·merge하지 말라.**

---

## 0. 재검토 판정

`2aff912` 커밋이 만든 일반 Route Token 계약 시험은 통과했다.

```text
온보딩 +3
일반 Route 3회: 3 → 2 → 1 → 0
4번째: resource-exhausted
provider 실패: 순 balance 변화 0
```

그러나 `ROUTE-TOKEN-1` 전체 판정은 **FAIL — 격리 보완 필요**다. 이번 작업은 2단계가 아니라 1단계 보완(`1R`)이다.

---

## 1. 확정된 결함

| 우선순위 | 결함 | 확인 증거 |
|---|---|---|
| P0 | Harness 플래그 하나로 운영 유사 환경에서 가짜 provider 활성 가능 | `FUNCTIONS_EMULATOR` 없음, project `boxcycle-dc2df`, `RTW_ROUTE_TOKEN_HARNESS=1` → `active=true` |
| P0 | 인증 없는 Harness 제어 API가 일반 Functions export에 포함 | `routeTokenHarnessControl`, `invoker:"public"`, `index.ts` 상시 export |
| P1 | 격리 시험 중 Google Secret Manager 외부 접근 발생 | `MAPBOX_ACCESS_TOKEN@latest` 조회 → 403 |
| P1 | 부정 조건 가드 시험 부재 | 정상 Harness 환경의 happy path만 실행 |
| P1 | UI smoke·Network 증거 부재 | `HARNESS.md`에 절차만 있고 실행 결과·캡처 없음 |
| P2 | Functions 선언 runtime과 검증 runtime 불일치 | 선언 Node 20, Emulator는 host Node 24 사용 |
| P2 | 작업 브랜치 upstream이 자기 원격이 아님 | `chore/route-token-harness...origin/main2 [ahead 1]` |

---

## 2. 작업 범위

### 2.1 이번에 수정할 것

- Harness 활성화 조건을 fail-closed로 변경
- Harness 제어 API를 운영 배포 발견 대상에서 제외
- 격리 시험의 Secret Manager·Mapbox Directions 외부 접근 제거
- 활성화 가드·runner·제어 API의 부정 조건 자동 시험
- 일반 Route Token UI smoke 1회와 증거 수집
- Node 20에서 Functions build·Harness 재검증

### 2.2 이번에 수정하지 않을 것

- 자동 Route 후보 생성·거리·방향·병렬화
- `자동 Route 1회 = Route Token 1개` transaction
- Matrix API·staging·실 Mapbox 통합
- Token 지급량·차감량·환불 정책
- 기본 Route 선택창·Start 마커·MENU UX

---

## 3. 필수 보완

### 3.1 Harness 활성화는 3가지 조건의 AND

가짜 provider는 다음이 **모두 참**일 때만 활성화된다.

```text
FUNCTIONS_EMULATOR === "true"
AND projectId === "demo-rtw-route-token"
AND RTW_ROUTE_TOKEN_HARNESS === "1"
```

하나라도 없거나 다르면 `false`다. 플래그 하나로 운영에서 활성화되는 경로는 허용하지 않는다.

활성 판정은 가능하면 순수 함수로 분리해 환경 조합을 프로세스 재시작 없이 시험하라.

### 3.2 Harness 제어 API는 운영 배포 표면에 없어야 한다

`routeTokenHarnessControl`은 단순히 운영에서 404를 내는 수준이 아니라 **운영 함수 발견·배포 목록에 포함되지 않아야** 한다.

통과 기준:

- 운영 유사 로컬 discovery/export 결과에 `routeTokenHarnessControl` 없음
- Emulator Harness discovery에는 제어 API가 있고 실행 가능
- 운영 프로젝트 deploy로 증명하지 말 것; 모든 검증은 로컬 discovery·정적 시험으로 수행

현재 코드베이스에서 안전하게 분리할 수 없다면 임시 404로 승인을 요청하지 말고 BLOCK으로 보고하라.

### 3.3 Secret Manager·Mapbox Directions 외부 접근 0건

Harness는 실제 `MAPBOX_ACCESS_TOKEN` 비밀값을 읽지 않아야 한다. Emulator가 `defineSecret` 때문에 Google Secret Manager를 조회하지 않도록 전용 로컬 placeholder 또는 동등한 안전 방법을 사용하라.

제약:

- 실제 비밀값을 사용·출력·커밋하지 말 것
- 기존 개인 `.secret.local`·`.env.local`을 덮어쓰지 말 것
- runner가 임시 파일을 만들면 `finally`로 정리하고 기존 파일이 있으면 즉시 실패할 것
- 실행 로그에 `secretmanager.googleapis.com`, `Trying to access secret`, `MAPBOX_ACCESS_TOKEN@latest` 없음
- `api.mapbox.com/directions/v5/` 요청 0건

Mapbox 지도 style·tile 요청은 Directions 직접 호출과 다르다. UI smoke에서는 **`/directions/v5/` 요청만 0건인지** 판정하라.

### 3.4 부정 조건 자동 시험

다음 표를 커밋 게이트에서 자동 실행하라.

| Emulator | project | Harness flag | 기대 active |
|:---:|---|:---:|:---:|
| true | `demo-rtw-route-token` | 1 | **true** |
| false/없음 | `demo-rtw-route-token` | 1 | **false** |
| true | `boxcycle-dc2df` | 1 | **false** |
| true | `demo-rtw-route-token` | 0/없음 | **false** |
| false/없음 | `boxcycle-dc2df` | 1 | **false** |
| true | 없음·파싱 실패 | 1 | **false** |

runner 가드도 다음을 자동 시험한다.

- Auth·Firestore Emulator host 누락 → 실패
- 잘못된 project ID → 실패
- `VITE_DIRECTIONS_DIRECT=1` → Emulator 시작 전 실패
- 운영 유사 환경의 제어 API → 미발견 또는 404; Firestore 읽기·쓰기 0건

### 3.5 UI smoke 1회

자동 게이트가 모두 통과한 후에만 수행한다.

1. 같은 demo project·Emulator·가짜 provider로 앱 기동
2. `VITE_USE_EMULATOR=1`, `VITE_DIRECTIONS_DIRECT=0`
3. 새 Guest 온보딩 후 일반 Route 3회 성공
4. 4번째 `resource-exhausted` 안내 표시
5. 화면 잔액·Firestore balance·ledger·provider 호출 수가 같은 시점에 일치
6. Network에서 `api.mapbox.com/directions/v5/` 0건, Functions Emulator 경유 호출 확인

필수 증거:

- 3회 성공 후 balance 0 화면
- 4번째 Token 부족 안내
- Network 필터 `/directions/v5/` 0건
- 같은 Guest의 ledger·provider 호출 수

UI 문제를 발견하면 이번 범위에서 UI를 고치지 말고 FAIL 증거로 보고하라.

---

## 4. Git 지시

### 4.1 시작 게이트

```powershell
Set-Location 'C:\20.HDev\boxcycle-route-token-harness'
git status --short --branch
git rev-parse HEAD
git merge-base HEAD origin/main2
git config --get core.hooksPath
```

기대:

- branch `chore/route-token-harness`
- HEAD `2aff91287497a47b502e0c3ba9fbda1fc01a709c`
- clean worktree
- hooks path `githooks`

다르면 수정·삭제·자동 복구하지 말고 상태를 보고하라.

### 4.2 커밋 규칙

- 새 브랜치·worktree를 만들지 말 것
- `2aff912`를 amend·rebase·reset하지 말고 후속 커밋으로 보완할 것
- 권장 커밋 1: `fix(route-token): lock harness to demo emulator only`
- 권장 커밋 2: `test(route-token): cover isolation guards and UI evidence`
- 두 작업이 분리되지 않는다면 1개의 응집된 커밋으로 남기되 다른 기능을 섞지 말 것
- 커밋 전 `git diff --check`, 스테이징 파일 목록·diff, 필수 게이트 확인
- `--no-verify` 금지
- 재검토 전 push·upstream 변경·PR·merge 금지
- 승인 후 push 시에만 `origin/chore/route-token-harness`를 upstream으로 설정
- `feat/distance-based-auto-route` worktree·브랜치는 접근하지 말 것

---

## 5. 실행 순서

1. Git 시작 게이트를 저장한다.
2. 활성화 판정을 fail-closed AND 조건으로 변경한다.
3. 부정 조건 시험을 먼저 추가하고 실패하는 기준선을 남긴다.
4. Harness 제어 API를 운영 discovery/export에서 제외한다.
5. Secret Manager 외부 조회를 없애고 네트워크·로그 게이트를 추가한다.
6. Node 20에서 자동 검증·Functions build를 수행한다.
7. 자동 게이트 통과 후 UI smoke를 한 번 수행한다.
8. 변경 파일만 스테이징하고 작은 의미 단위로 로컬 commit한다.
9. push하지 말고 §7 형식으로 보고한다.

---

## 6. 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
```

`test:route-token`에는 정상 Token 계약과 §3.4의 부정 조건 시험이 모두 포함되어야 한다.

| 게이트 | PASS 기준 |
|---|---|
| 정상 Token 계약 | `3→2→1→0`, 4번째 거부, provider 실패 환불 유지 |
| Harness 활성화 | Emulator + demo project + flag 모두 참일 때만 active |
| 운영 배포 표면 | `routeTokenHarnessControl` 미발견 |
| 외부 접근 | Secret Manager 0건, Mapbox Directions 0건 |
| UI | balance·ledger·provider 호출 수 일치, 4번째 안내 |
| Runtime | Functions의 Node 20 선언과 같은 runtime에서 통과 |
| Git | 후속 로컬 commit만 존재, worktree clean, 원격 미푸시 |

하나라도 빠지면 `ROUTE-TOKEN-1R` PASS로 보고하지 말 것.

---

## 7. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-1R` PASS / FAIL
2. **Git 기준선:** 시작 HEAD·merge-base·branch·worktree·hooks
3. **커밋:** 후속 commit hash·제목·파일 범위
4. **활성화 진리표:** §3.4 전체 입력·결과
5. **운영 표면 검증:** 제어 API 미발견 증거
6. **외부 격리:** Secret Manager·Mapbox Directions 0건 로그·계측
7. **Token 계약:** `3→2→1→0→거부`, 멱등·환불 결과표
8. **UI smoke:** 화면·Network·balance·ledger·provider 증거
9. **Runtime:** `node --version`, 실제 Emulator Functions runtime
10. **게이트 원문:** `test:route-token`, Functions build, web build, diff check
11. **작업 종료 상태:** `git status --short --branch`, `git log --oneline origin/main2..HEAD`
12. **원격 상태:** push·PR·merge 없음, 원격 브랜치 없음
13. **보호 확인:** `feat/distance-based-auto-route` HEAD·WIP 무변경

`ROUTE-TOKEN-1R` PASS 후에도 자동 Route 2단계를 자동으로 시작하지 말 것. 검토자가 Harness 브랜치의 push·PR 여부를 먼저 결정한다.
