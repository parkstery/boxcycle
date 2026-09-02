# Route Token 기본 Route 우회 차단·차감 피드백 2A — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **실행** — 사용자가 쓰는 기본 지도 Route 생성에서 Token 우회를 제거하고 차감 결과를 즉시 표시 |
| 최초 작성 | 2026-08-30 |
| 상태 | **실행 대기** |
| 작업 ID | `ROUTE-TOKEN-2A` |
| 선행 작업 | `ROUTE-TOKEN-1R2` 검토 PASS, HEAD `7103d8f` |
| 대상 브랜치 | `fix/route-token-default-enforcement` — 최신 `main2`에서 새로 생성 |
| 연결 문서 | [Route Token 경제](../../260518-Route-Token-경제-설계.md) · [Ontology](../../260714-RTW-Ontology.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 개발팀장에게 전달할 한 줄: **하네스 PR을 먼저 `main2`에 반영한 뒤 새 브랜치에서 `ROUTE-TOKEN-2A`만 수행하라. 기본 Route 생성의 `VITE_DIRECTIONS_DIRECT` 우회를 제거하고, 성공한 서버 응답의 잔액으로 `Route Token -1 · 잔여 N개`를 표시하며, Guest가 3회 생성 후 4번째에서 실제 차단되는 것을 기본 지도 UI·Network·ledger로 증명하라. 자동 Route 후보 탐색·Token 정책 변경은 섞지 말라.**

---

## 0. 확정된 현상과 원인

### 0.1 사용자 재현

- Guest로 기본 지도에서 Route를 4회 이상 생성할 수 있었다.
- Token 부족 차단이 나타나지 않았다.
- Route 생성 성공 뒤 차감·잔여량 안내가 없다.

### 0.2 코드로 확인된 직접 원인

원래 작업 폴더 `C:\20.HDev\boxcycle\apps\web\.env.local`에 다음 설정이 남아 있다.

```text
VITE_DIRECTIONS_DIRECT=1
```

이 설정에서는 `apps/web/src/services/mapboxDirections.ts`가 `getMapboxDirections` Cloud Function을 호출하지 않고 브라우저에서 Mapbox Directions REST를 직접 호출한다. 따라서 서버의 `spendRouteGenerateToken`·ledger·잔액 부족 판정을 모두 우회한다.

`ROUTE-TOKEN-1R2` 하네스의 3회 차감·4번째 차단 PASS는 **전용 Emulator 하네스의 정상 경로**를 증명한다. 위 기본 앱 우회가 제거됐다는 뜻은 아니다.

### 0.3 현재 정책의 정확한 뜻

- Guest의 `3`은 **매일 3회 무료**가 아니다.
- 현재 구현 정책은 온보딩 시 **1회 +3 Route Token** 지급이다.
- 일반 Route 생성 성공 1회당 1 Token을 쓴다.
- 3회 생성해 0이 되면 4번째는 거부되어야 한다.
- Ride 완료 등 별도 적립 조건을 충족하면 다시 얻을 수 있다.
- 일일 무료 생성 N회는 문서상 검토 항목이며 현재 구현 정책이 아니다.

---

## 1. Git 선행 게이트

두 작업을 한 브랜치에 섞지 않는다.

1. 현재 `chore/route-token-harness`의 5커밋(`2aff912`~`7103d8f`)을 push한다.
2. `main2 ← chore/route-token-harness` PR을 생성하고 다음을 첨부한다.
   - Node 20 Harness 2회 연속 PASS
   - Functions·web build PASS
   - worktree clean, Secret·port 잔류 없음
   - 기본 앱 우회는 별도 `ROUTE-TOKEN-2A`임을 명시
3. 사용자 승인 없이 `main2`나 `main`에 직접 merge하지 않는다.
4. PR이 승인·merge된 뒤에만 최신 `origin/main2`에서 별도 worktree와 `fix/route-token-default-enforcement` 브랜치를 만든다.
5. 기존 `feat/distance-based-auto-route` worktree와 WIP는 건드리지 않는다.

PR merge 전에는 2A 구현을 시작하지 말고 PR URL·상태만 보고한다.

---

## 2. 이번 구현 범위

### 2.1 기본 Route 생성의 무과금 우회 제거

- 제품 앱에서 `VITE_DIRECTIONS_DIRECT=1`로 Directions를 직접 호출하는 분기를 제거한다.
- `fetchRouteByProfile`의 유일한 Route 생성 경로는 인증된 `getMapboxDirections` 서버 호출이어야 한다.
- 사용자의 기존 `.env.local`에서 `VITE_DIRECTIONS_DIRECT=1` 한 줄을 제거하되, 다른 Firebase·Mapbox 값과 비밀값은 수정·출력·커밋하지 않는다.
- 오래된 환경변수가 다시 들어와도 조용히 우회되지 않도록 자동 시험을 둔다.
- Mapbox 지도 style·tile용 공개 토큰은 대상이 아니다. 금지 대상은 `/directions/v5/` 브라우저 직접 호출이다.

### 2.2 성공 차감 피드백

일반 Route 생성이 서버에서 성공하고 응답에 권위 있는 `routeTokenBalance`가 있을 때 다음 형식의 짧은 상태 메시지를 표시한다.

```text
Route Token -1 · 잔여 2개
Route Token -1 · 잔여 1개
Route Token -1 · 잔여 0개
```

요건:

- Route가 지도에 실제 반영된 직후 보인다.
- `role="status"`, `aria-live="polite"`로 읽을 수 있다.
- Route 요약의 거리·예상 시간은 유지한다.
- 서버 응답의 `routeTokenBalance`를 사용한다. 차감 전 클라이언트 잔액을 임의로 `-1` 계산하지 않는다.
- 성공했지만 응답 잔액이 없으면 차감 수치를 꾸며 표시하지 않고 오류로 다룬다.
- 중복 클릭·동일 `requestId` 재시도에서 실제 ledger 차감이 없으면 `-1` 메시지를 중복 표시하지 않는다.
- provider 실패·환불·Token 부족·인증 실패에는 성공 차감 메시지를 표시하지 않는다.

### 2.3 0개 이후 차단

- 세 번째 성공 응답이 잔여 `0`이면 UI의 실시간 구독이 늦어도 해당 서버 응답을 근거로 즉시 네 번째 생성을 막는다.
- 네 번째 시도에는 현재 의미를 유지한 `경로 토큰 부족 · 주행 완료 시 획득` 안내를 표시한다.
- 네 번째 시도에서 provider 호출·ledger 차감·Route 교체가 없어야 한다.
- UI 사전 차단과 서버 `resource-exhausted` 강제 차단을 모두 유지한다.

---

## 3. 이번에 하지 않을 것

- 거리 기반 자동 Route의 후보 35개 호출·Token transaction·Matrix 설계
- 자동 Route 진입 UI·Start marker 문제
- Route Token 지급량·차감량·일일 무료 N회 등 경제 정책 변경
- Ride 완료 적립 규칙 변경
- 기존 `feat/distance-based-auto-route` WIP 병합·정리
- 배포, 운영 데이터 수정, 실제 Guest 계정 잔액 보정
- `main` 변경

---

## 4. 필수 자동 검증

`ROUTE-TOKEN-1R2` 하네스를 확장해 기본 지도 UI에서 다음을 검증한다.

| 순서 | Route 결과 | 응답 잔액 | UI 상태 | backend |
|---|---|---:|---|---|
| 1 | 성공 | 2 | `Route Token -1 · 잔여 2개` | ledger 1, provider 1 |
| 2 | 성공 | 1 | `Route Token -1 · 잔여 1개` | ledger 2, provider 2 |
| 3 | 성공 | 0 | `Route Token -1 · 잔여 0개` | ledger 3, provider 3 |
| 4 | 거부 | 없음 | Token 부족 안내 | balance 0, ledger 3, provider 3 |

각 성공은 다음을 직접 확인한다.

- `getMapboxDirections` POST HTTP 200
- geometry·distance·duration 유효
- 응답 잔액 `2 → 1 → 0`
- 지도 Route와 거리 요약 반영
- 대응하는 차감 피드백 1회만 표시

공통 Network 게이트:

- 브라우저 `/directions/v5/` 요청 0건
- OPTIONS를 Route 성공으로 계산하지 않음
- 시험 중간 실패에도 직접 호출 0건 검사가 수행됨

추가 회귀:

- `VITE_DIRECTIONS_DIRECT=1`을 주입해도 direct endpoint를 호출하지 않거나 빌드·시작 단계에서 명시적으로 실패
- provider 실패 시 환불되고 `-1` 메시지 없음
- 동일 `requestId` 재시도 시 ledger·메시지 중복 없음
- 0 잔액에서 UI 상태를 우회해 요청해도 서버가 `resource-exhausted`

---

## 5. UX 증거

한 실행 ID 아래 최소 다음 스크린샷을 남긴다.

1. 첫 성공: 지도 Route + `Route Token -1 · 잔여 2개`
2. 세 번째 성공: 지도 Route + `Route Token -1 · 잔여 0개`
3. 네 번째 차단: Token 부족 안내 + 직전 Route 불변

스크린샷만으로 PASS하지 않는다. 같은 실행 ID의 응답 JSON과 backend `balance / ledger / provider` 수치를 함께 제출한다.

---

## 6. 커밋·브랜치 규칙

- 최신 `origin/main2`에서 새 worktree·`fix/route-token-default-enforcement` 생성
- 권장 커밋 1: `fix(route-token): remove direct directions bypass`
- 권장 커밋 2: `feat(route-token): show authoritative spend feedback`
- 권장 커밋 3: `test(route-token): verify default route enforcement`
- 서로 다른 의미를 한 커밋에 뭉치지 않는다.
- `.env.local`, 실제 토큰, Emulator 산출물, 스크린샷은 커밋하지 않는다.
- `--no-verify`, amend, reset, rebase 금지
- 완료 전 로컬 커밋까지만 하고 재검토 전 push·PR·merge 금지
- 종료 시 worktree clean 필수

---

## 7. 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
git status --short --branch
```

추가 필수:

- Node 20 Harness 2회 연속 PASS
- 두 실행에서 UI `2 → 1 → 0`, 4번째 차단
- 두 실행에서 backend `0 / ledger 3 / provider 3`
- 두 실행에서 `/directions/v5/` 직접 호출 0건
- Secret Manager 실접속 0건
- 각 실행 후 package·secret·port·Git 원상복구
- 기존 web build의 `SADDLE`·`PELVIS`·chunk 경고는 별도 기존 문제로 원문 보고

---

## 8. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-2A` PASS / FAIL / BLOCK
2. **Git 선행:** Harness PR URL·merge commit·새 branch base
3. **원인 제거:** direct 분기·환경변수 처리 전후
4. **UI:** 각 성공의 정확한 메시지와 표시 위치·접근성
5. **응답:** 3회 HTTP·geometry·distance·duration·잔액 `2→1→0`
6. **backend:** 3회 후와 4회 후 `balance / ledger / provider`
7. **네 번째 차단:** UI·서버·Route 불변 증거
8. **실패·멱등:** 환불·중복 요청 결과
9. **Network:** `/directions/v5/` 0건
10. **게이트:** Harness 2회·Functions build·web build·diff check 원문
11. **Git:** commit hash·제목·파일 목록·clean status·미푸시 확인
12. **보호:** `feat/distance-based-auto-route` HEAD·WIP 무변경

`ROUTE-TOKEN-2A` PASS 후에도 자동 Route의 1회 Token transaction 작업을 자동 시작하지 말고 다음 지시를 기다린다.
