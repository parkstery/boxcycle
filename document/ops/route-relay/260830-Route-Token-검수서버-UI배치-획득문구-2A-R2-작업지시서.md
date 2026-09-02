# Route Token 경로 설정창 표시 2A-R2 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **UI 표시만 보완** — 전역 Token 카드 제거 및 경로 설정창 안내 영역 통합 |
| 최초 작성 | 2026-08-30 |
| 상태 | **PASS · 커밋·push 완료** |
| 작업 ID | `ROUTE-TOKEN-2A-R2` |
| 작업 worktree | `C:\20.HDev\boxcycle-route-token-default-enforcement` |
| 작업 브랜치 | `fix/route-token-default-enforcement` 계속 사용 |
| 기준 commit | `8f0718872146141f018c4609beae9eea6bb0c33b` |
| 연결 문서 | [2A-R1 작업지시서](260830-Route-Token-기본경로-세션격리-전역피드백-2A-R1-작업지시서.md) · [Route Token 경제](../../260518-Route-Token-경제-설계.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 개발팀장에게 전달할 한 줄: **현재 Token worktree와 `localhost:5000` 검수 상태를 그대로 유지하고 `ROUTE-TOKEN-2A-R2`에서는 표시 문제만 고쳐라. 상단 중앙 전역 Token 카드를 제거하고 보유량·비용·차감·부족 상태를 경로 설정 popup의 기존 부족 안내 자리에 통합하라. Token 획득 조건·지급 로직·Public Route 연계와 자동 Route 통합은 건드리지 말며, 획득 문제는 이 작업 통과 후 새 worktree·별도 브랜치의 후속 지시로 처리한다. 재검토 전 push·PR·배포하지 말라.**

### 완료 기록 — 2026-08-30

- 사용자 화면 검수 승인: 전역 카드 제거, 경로 설정 popup 안 `3→2→1→0→부족` 표시 확인
- 독립 재검증: `npm -w boxcycle-web run test:route-token` PASS
- web build: PASS
- commit: `ad4d7764e846c1016d13ea74cbdd6812bfff69af fix(route-token): move feedback into route popup`
- push: `origin/fix/route-token-default-enforcement`와 동기화
- Token 획득 문제는 별도 worktree 후속 과제로 유지

---

## 0. 2A-R1 재검토 판정

### 0.1 통과한 부분

| 항목 | 재검토 결과 |
|---|---|
| UID 상태 격리 | Guest A 잔액 0 이후 Guest B 첫 Route 잔액 2 시험 PASS |
| 적립 잔액 반영 | 같은 UID 구독 잔액 `0→1` 반영 시험 PASS |
| 기본 지도 정보 | 생성 전 `Route Token 3개 / 경로 생성 시 1개 사용` 구현 확인 |
| 성공 피드백 | 1·2·3회 성공 후 `잔여 2→1→0` 구현 및 산출물 확인 |
| 네 번째 차단 | 잔액 0에서 Route 생성 차단 확인 |
| 제품 모듈 시험 | 복제 함수가 아닌 실제 direct guard core 시험으로 교체 확인 |
| 자동 검증 | `test:route-token` 전체 PASS, web `npm run build` PASS |
| Git | `fix/route-token-default-enforcement`가 `origin/main2`보다 6커밋 앞섬, worktree clean, 원격 브랜치·PR 없음 |

### 0.2 남은 결함

#### A. 검수 환경 결정 — 현 상태 유지

최초 확인 당시 사용자가 연 `http://localhost:5000`의 Vite 프로세스는 다음 경로에서 실행 중이었다.

```text
C:\20.HDev\boxcycle
branch: feat/distance-based-auto-route
```

Token 작업본은 다음 별도 worktree에 있다.

```text
C:\20.HDev\boxcycle-route-token-default-enforcement
branch: fix/route-token-default-enforcement
HEAD: 8f07188
```

따라서 사용자가 첨부한 “1·2·3회 정보 없음” 화면은 Token 최신 구현이 루트 검수 작업본에 아직 통합되지 않았다는 증거다.

이후 2026-08-30 재확인에서는 같은 5000번 포트가 PID `53624`로 교체됐지만 실제 실행 경로가 다음 Token worktree였다.

```text
C:\20.HDev\boxcycle-route-token-default-enforcement\node_modules\...\vite.js
```

현재 5000번 포트는 Token worktree에서 실행되며 최신 Token 표시가 보인다. 사용자는 이 구성을 이번 Token 표시 검수 환경으로 유지하기로 결정했다. 따라서 이번 작업에서는 서버 cwd 변경, 루트 통합, 포트 변경을 요구하지 않는다.

#### B. Token 카드가 기존 지도 HUD를 가림

개발팀장 산출물에서 상단 중앙 Token 카드가 기존 거리·시간·평균·속도 HUD와 같은 자리를 사용한다. 1회 성공부터 서로 겹치며, 잔액 0과 차감 메시지가 함께 나타날 때 판독성이 더 나빠진다. 기능 문자열이 DOM에 존재하는 것만으로 PASS 처리하지 않는다.

#### C. Token 획득 문제 — 후속 worktree로 이관

현재 UI는 `경로 토큰 부족 · 주행 완료 시 획득`이라고 안내한다. 그러나 운영 `config/routeTokenEconomy` 문서가 없어서 서버 기본값이 적용되며 현재 코드는 다음 조건이다.

- 최소 1,000m
- 최소 180초
- `floor(주행 km × 0.15)` Token
- 소수점 누적 없음

따라서 Token 획득 조건과 실제 지급 문제는 별도 검토가 필요하다. 다만 이번 `2A-R2`에서는 획득 로직·경제 수치·Public Route 연계를 수정하거나 검증 범위에 섞지 않는다. 표시 영역에는 검증되지 않은 획득 약속을 추가하지 않고 중립적인 부족 상태만 보여 준다. 획득 문제는 `2A-R2` 통과 뒤 새 worktree와 별도 브랜치에서 수행한다.

---

## 1. 이번 작업 범위

### 1.1 현재 검수 서버 유지

- 사용자 수동 검수 주소는 현재와 같이 `http://localhost:5000`을 사용한다.
- 실행 worktree는 `C:\20.HDev\boxcycle-route-token-default-enforcement`를 유지한다.
- 작업 브랜치는 `fix/route-token-default-enforcement`를 유지한다.
- 포트 변경, 루트 worktree 통합, 자동 Route 브랜치 병합을 이번 작업에 포함하지 않는다.
- 수정 반영을 위한 재시작이 필요하면 현재 Vite 프로세스만 정상 종료한 뒤 같은 worktree·같은 포트에서 다시 실행한다.
- 완료 보고에 URL·PID·cwd·branch·full HEAD를 남긴다.

### 1.2 전역 Token 카드를 제거하고 경로 설정창 안내 영역으로 통합

사용자 확정 UX는 다음과 같다.

- 상단 중앙의 별도 `RouteTokenMapFeedback` 카드 방식은 제거한다. 위치만 옮긴 별도 지도 카드로 대체하지 않는다.
- Token 정보는 Route 생성의 맥락 정보이므로 **경로 설정 popup 안에만** 표시한다.
- 정확한 표시 위치는 현재 `경로 토큰 부족 · 주행 완료 시 획득`이 나타나는 경로 탐색 유형 안내 영역과 동일한 자리다.
- 경로 설정 popup이 닫혀 있으면 지도에 Token 카드나 Token 토스트를 따로 띄우지 않는다.
- 별도 카드 제거 후 거리·시간·평균·속도 HUD의 원래 크기·위치·가독성을 유지한다.

상태별 표기 계약:

```text
생성 전:       Route Token 3개 · 경로 생성 시 1개 사용
1회 성공 직후: Route Token -1 · 잔여 2개
안정 상태:     Route Token 2개 · 경로 생성 시 1개 사용
2회 성공 직후: Route Token -1 · 잔여 1개
3회 성공 직후: Route Token -1 · 잔여 0개
잔액 0:        Route Token 0개 · 경로 토큰 부족
```

- 성공 차감 문구는 경로 설정 popup의 동일 안내 영역에서 즉시 보여야 한다.
- 성공 문구를 읽을 수 있는 시간 동안 유지한 뒤 현재 보유량·비용 안내로 전환한다.
- Route profile 버튼을 누르자마자 popup을 닫아 성공 결과를 볼 수 없게 해서는 안 된다. 탐색 중에는 같은 영역에 진행 상태를 보여 주고 성공/실패 결과까지 확인 가능하게 유지하거나, 성공 직후 동일 popup을 같은 위치에 복원한다.
- 자동차·자전거·도보의 기본 Route와 거리 기반 자동 Route 진입 모두 같은 Token 안내 영역을 공유한다.
- Token 부족 시 Route profile 버튼과 자동 Route 실행 버튼의 차단 상태가 일치해야 한다.
- `role="status"`와 `aria-live="polite"`는 한 곳에만 두어 같은 문구를 중복 낭독하지 않는다.
- 기존 `경로 탐색 유형 선택`의 의미가 사라지지 않도록 버튼 그룹 label/heading은 별도 접근성 이름으로 유지한다.
- 1280×720과 1920×1080, 생성 전·1회·2회·3회·4회 차단 상태에서 popup 내용이 잘리거나 화면 밖으로 나가지 않는지 확인한다.

### 1.3 부족 상태는 중립적으로 표시

이번 단계에서 Token 획득 정책을 설명하거나 구현하지 않는다.

```text
Route Token 0개 · 경로 토큰 부족
```

- 현재 검증되지 않은 `주행 완료 시 획득` 약속은 표시하지 않는다.
- `6.7 km`, `3분`, Public Route 등 획득 조건 설명도 이번 UI 작업에 추가하지 않는다.
- Token 획득 안내는 후속 획득 worktree에서 정책과 실제 지급을 함께 확정한 뒤 추가한다.
- 오류 객체와 Route popup에서 사용되는 부족 상태 문구를 중립적으로 맞춘다.
- 제거된 Token 전역 표면의 죽은 CSS·component·mount를 정리하고 문구 계약 시험을 추가한다.

### 1.4 이번 단계에서 금지

- Token 적립률·최소 거리·최소 시간·일일 상한 변경 금지
- `BASIC_INTRO_COURSE_IDS` 연결 또는 입문 Route 보너스 구현 금지
- Ride completion의 `publicationId` 저장 구조 변경 금지
- `feat/distance-based-auto-route` WIP·브랜치·루트 worktree를 건드리지 않는다.
- 자동 Route 후보 여러 개의 과금 단위 변경 금지
- Token 획득 관련 함수·Firestore 설정·ledger·Ride completion 변경 금지
- 사용자 요청 없이 배포·push·PR·merge 금지

위 경제·적립 구조는 `2A-R2` 통과 뒤 새 worktree·별도 브랜치로 시작하는 다음 독립 덩어리 `ROUTE-TOKEN-2B`에서 결정한다.

---

## 2. 필수 검증 및 증거

### 2.1 수동 검수용 증거

현재 Token worktree에서 실행한 `http://localhost:5000` 서버에서 동일 Guest로 다음 5장을 남긴다.

1. 생성 전 `Route Token 3개 / 경로 생성 시 1개 사용`
2. 1회 성공 `Route Token 2개 / -1 · 잔여 2개`
3. 2회 성공 `Route Token 1개 / -1 · 잔여 1개`
4. 3회 성공 `Route Token 0개 / -1 · 잔여 0개`와 정확한 부족 안내
5. 4회 시도 차단과 직전 Route·ledger 불변

각 화면에는 경로 설정 popup과 기존 지도 HUD가 함께 보여야 한다. Token 문구는 popup 안에만 있고 지도 전역 Token 카드가 없음을 확인한다. 파일명에 동일 run ID를 사용한다.

### 2.2 자동 검증

- `RouteTokenMapFeedback` 전역 mount와 전역 카드 DOM 0개
- Token 문구가 경로 설정 popup 안내 영역의 descendant임을 assertion
- HUD·RouteDock·지도 컨트롤의 위치와 크기 회귀 없음
- 1280×720 및 1920×1080
- 생성 전·1회·2회·3회·4회 차단 문구
- Route 생성 요청부터 성공 차감 문구까지 popup이 닫히지 않거나 동일 위치로 복원됨
- 부족 상태가 중립 문구이며 획득 조건을 약속하지 않음
- Guest A→B 계정 상태 격리 회귀 없음
- direct Directions 0건과 backend `0/3/3` 유지

### 2.3 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
git status --short --branch
```

실행 종료 후 Emulator·임시 secret·추가 시험 포트는 원상복구한다. **현재 Token worktree의 5000번 검수 서버만 URL·PID를 보고하고 유지**한다.

---

## 3. Git 지시

- 구현과 독립 시험은 `C:\20.HDev\boxcycle-route-token-default-enforcement`와 `fix/route-token-default-enforcement`를 계속 사용한다.
- 기준 `8f07188` 및 앞선 6개 커밋을 amend·reset·rebase하지 않는다.
- 권장 후속 커밋 1: `fix(route-token): move feedback into route popup`
- 권장 후속 커밋 2: `fix(route-token): state actual earn requirement`
- 권장 후속 커밋 3: `test(route-token): verify review surface layout`
- 검수 스크린샷·`.out`·`.env.local`·실제 Token·로그를 커밋하지 않는다.
- `--no-verify` 금지
- 재검토 전 push·upstream 설정·PR·merge·배포 금지
- 종료 시 Token worktree clean. 현재 5000번 사용자 검수 서버 PID만 예외로 보고한다.
- `ROUTE-TOKEN-2B`용 worktree·브랜치는 이번 작업에서 미리 만들지 않는다.

---

## 4. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-2A-R2` PASS / FAIL / BLOCK
2. **검수 서버:** `http://localhost:5000`·PID·Token worktree cwd·branch·full HEAD
3. **UI 배치:** 전역 카드 제거, 경로 설정 popup 통합 위치, 2개 해상도 결과
4. **문구:** 제거한 잘못된 문구와 최종 표기
5. **기능 회귀:** `3→2→1→0→차단`, Guest 전환, direct 0
6. **증거:** 5장 스크린샷·evidence JSON 절대경로
7. **게이트:** Harness·Functions/web build·diff check 원문
8. **Git:** Token UI 후속 commit·worktree clean·미푸시
9. **보호:** root와 자동 Route WIP 무변경, Token 획득 로직 무변경

`ROUTE-TOKEN-2A-R2` 재검토가 끝나기 전 `ROUTE-TOKEN-2B` worktree 생성, Token 획득 수정, 자동 Route 통합을 시작하지 않는다.
