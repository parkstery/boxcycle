# Route Token 기본 Route 세션 격리·전역 피드백 2A-R1 — 개발팀장 작업 지시서

| 항목 | 내용 |
|------|------|
| 문서 유형 | **보완 실행** — `ROUTE-TOKEN-2A` 재검토에서 발견된 계정/적립 고착과 기본 지도 피드백 누락 수정 |
| 최초 작성 | 2026-08-30 |
| 상태 | **2A 부분 통과 · 2A-R1 실행 대기** |
| 작업 ID | `ROUTE-TOKEN-2A-R1` |
| 작업 worktree | `C:\20.HDev\boxcycle-route-token-default-enforcement` |
| 작업 브랜치 | `fix/route-token-default-enforcement` 계속 사용 |
| 기준 commit | `a9951eac90dbc3b8dd6ad756f19abee3d075a2ab` |
| 연결 문서 | [2A 작업지시서](260830-Route-Token-기본경로-우회차단-차감피드백-2A-작업지시서.md) · [Route Token 경제](../../260518-Route-Token-경제-설계.md) · [개발 워크플로](../../260719-개발-워크플로-브랜치-커밋-게이트.md) |

> 개발팀장에게 전달할 한 줄: **`7fa4e7e`·`0e6d7b2`·`a9951ea`를 보존하고 같은 브랜치에서 `ROUTE-TOKEN-2A-R1`만 수행하라. Token 잔액·메시지를 UID별로 격리하고 구독 잔액 증가를 막지 않게 하며, Trail 메뉴가 닫힌 기본 지도에서도 Route 성공 직후 전역 피드백을 보이게 하라. 실제 제품 모듈을 검증하는 시험으로 Guest 전환·0→적립→재생성·메뉴 닫힘·실패/멱등을 증명하고 재검토 전 push·PR·merge하지 말라.**

---

## 0. 2A 재검토 판정

### 0.1 통과한 부분

| 항목 | 결과 |
|---|---|
| Harness 선행 병합 | `origin/main2` merge commit `a4ff861` |
| 별도 브랜치 | `fix/route-token-default-enforcement`, 최신 `origin/main2` 기준 |
| 커밋 분리 | 우회 제거 / 피드백 / 시험 3커밋 |
| direct 구현 제거 | 브라우저 Mapbox Directions REST 함수 삭제 |
| 로컬 우회 설정 | 원래 worktree `.env.local`의 `VITE_DIRECTIONS_DIRECT=1` 제거 |
| 일반 Guest 계약 | 응답 잔액 `2→1→0`, backend `0/3/3`, 4번째 차단 |
| 하네스·build | 독립 재실행 PASS, web build PASS |
| 종료 상태 | worktree clean, secret·port 잔류 없음 |

### 0.2 반드시 보완할 결함

#### A. 잔액 0 고착과 계정 간 상태 누출

`routeTokenSpendBridge.ts`의 `routeResponseBalance`·메시지·request ID는 모듈 전역이며 UID와 연결되지 않는다. `clearRouteTokenSpendSession()`도 제품 코드에서 호출되지 않는다.

현재 `computeEffectiveBalance()`는 서버 응답 잔액과 Firestore 구독 잔액의 `min`을 계속 사용한다. 따라서 다음 문제가 생긴다.

- Guest A가 잔액 0이 된 뒤 로그아웃하고 Guest B로 바꾸어도 A의 0이 남아 B의 Route 생성을 막을 수 있다.
- 잔액 0 이후 Ride 완료로 Firestore 잔액이 1 이상 증가해도 과거 응답 0과 `min`을 취해 계속 막힐 수 있다.
- 이전 계정의 차감 메시지가 다음 계정 화면에 남을 수 있다.

이는 Route Token을 Ride로 다시 얻는 제품 정책을 깨는 기능 결함이다.

#### B. 기본 지도에서 차감 피드백이 보이지 않음

메시지는 `MenuPanel open={menuOpen}` 안의 `RideRoutePanel`에서만 렌더링된다. Trail 메뉴가 닫힌 기본 지도 Route 선택 화면에는 표시되지 않는다.

E2E는 이 문제를 피하려고 Route 생성 전에 `openTrailMenu()`를 호출했다. 사용자의 실제 흐름을 검증한 것이 아니다.

#### C. 제출 스크린샷이 지시서 증거를 충족하지 않음

1회·3회 성공 스크린샷은 Route와 `Route Token -1 · 잔여 N개`가 없는 빈 지도다. 시험이 메시지를 확인한 뒤 Route를 삭제하고 나서 스크린샷을 찍기 때문이다.

#### D. direct 가드 단위시험이 제품 구현을 시험하지 않음

`directions-direct-guard.test.mjs`가 `directionsDirectGuard.ts`를 import하지 않고 함수 구현을 시험 파일에 복사했다. 제품 함수가 바뀌거나 삭제돼도 복사본 시험은 계속 PASS할 수 있다.

---

## 1. 이번 보완 범위

### 1.1 UID별 상태 수명

- Token의 임시 응답 상태·차감 메시지·멱등 request ID를 현재 `user.uid`에 귀속한다.
- 로그인 전, 로그아웃, UID 변경, 구독 해제에서 이전 UID의 임시 상태와 메시지를 즉시 제거한다.
- Guest A의 잔액·메시지가 Guest B에 영향을 주지 않아야 한다.
- 전역 mutable bridge를 유지한다면 모든 읽기·쓰기 API에 UID 계약을 강제하고 수명 시험을 둔다. 가능하면 React 상태/명시적 callback으로 소유권을 올려 숨은 전역 상태를 줄인다.

### 1.2 서버 응답과 Firestore 구독의 수렴

- Route 응답 잔액은 Firestore 지연 동안 즉시 차단하기 위한 임시 권위값으로 사용한다.
- 구독이 동일하거나 더 낮은 잔액으로 따라오면 임시 응답 상태를 해제하고 구독값으로 수렴한다.
- 이후 Ride 적립 등으로 구독 잔액이 `0→1+` 증가하면 즉시 Route 생성이 다시 가능해야 한다.
- 단순히 영구 `min(response, subscribed)`를 사용하지 않는다.
- UI 사전 차단과 서버 `resource-exhausted` 강제 차단은 유지한다.

### 1.3 기본 지도 보유량·차감 전역 피드백

Trail 메뉴를 열지 않은 기본 지도 Route 선택 화면에서 **생성 전 보유량과 비용**, 그리고 각 성공 직후 **실제 차감과 잔여량**을 모두 보이게 한다.

생성 전에는 Route 선택 컨트롤 가까이에 다음 두 정보를 지속 표시한다.

```text
Route Token 3개
경로 생성 시 1개 사용
```

각 성공 직후에는 보유량을 갱신하고 별도 피드백을 표시한다.

```text
1회 성공: Route Token -1 · 잔여 2개
2회 성공: Route Token -1 · 잔여 1개
3회 성공: Route Token -1 · 잔여 0개
```

표시 계약:

- 현재 보유량은 인증·온보딩이 끝난 뒤 Route 생성 전부터 보인다.
- 보유량 표면은 성공 후 `3→2→1→0`으로 즉시 갱신된다.
- 차감 피드백은 Map popup·RouteDock을 가리지 않는 지도 전역 상태/토스트 표면에 표시한다.
- `role="status"`, `aria-live="polite"` 적용
- Route geometry와 거리 요약이 반영된 뒤 확인 가능
- 충분히 읽을 수 있는 시간 뒤 자동 해제하거나 다음 상태로 교체
- 차감 피드백이 사라져도 현재 보유량과 `경로 생성 시 1개 사용` 안내는 유지한다.
- 메뉴가 열려 있을 때 동일 문구가 두 군데에서 중복 낭독되지 않게 한다.
- 실패·환불·Token 부족·멱등 재응답에는 잘못된 `-1` 메시지를 표시하지 않는다.
- 잔여 0에서는 `Route Token 0개`와 `경로 토큰 부족 · 주행 완료 시 획득`을 함께 이해할 수 있어야 한다.

### 1.4 실제 제품 코드 시험

- 복사한 함수로 시험하지 않는다.
- 브라우저/Vite 시험 또는 실제 제품 모듈을 import하는 TypeScript 시험으로 `assertDirectionsServerOnly`와 메시지 포맷을 검증한다.
- `VITE_DIRECTIONS_DIRECT=1` 주입 시 실제 앱이 명시적으로 거부하고 `/directions/v5/` 호출이 0건임을 확인한다.

---

## 2. 필수 시나리오

### 2.1 메뉴 닫힌 기본 흐름

1. 새 Guest 진입, Trail 메뉴 닫힘 확인
2. Route 생성 전에 `Route Token 3개`와 `경로 생성 시 1개 사용` 확인
3. 지도 클릭으로 Start·End 선택
4. 일반 Route 1회 생성
5. 지도 Route·거리 요약·현재 보유량 2·`Route Token -1 · 잔여 2개`를 **동시에** 확인
6. 이 상태에서 스크린샷 저장

시험 편의를 위해 메뉴를 먼저 열지 말 것.

### 2.2 3회와 4번째 차단

- 생성 전 잔액 3과 1회 비용 안내
- 잔액 `3→2→1→0`의 지속 표시와 각 성공의 차감 메시지
- 1회 성공: 현재 2 + `Route Token -1 · 잔여 2개`
- 2회 성공: 현재 1 + `Route Token -1 · 잔여 1개`
- 3회 성공: 현재 0 + `Route Token -1 · 잔여 0개`
- 3번째 직후 지도 Route + 잔여 0 메시지 스크린샷
- 4번째 Token 부족, provider·ledger 3에서 불변
- `/directions/v5/` 0건

### 2.3 계정 전환 격리

1. Guest A를 잔액 0까지 소진
2. 로그아웃 또는 인증 세션 종료
3. 새 Guest B 생성, UID가 A와 다름 확인
4. B 온보딩 잔액 3 확인
5. B의 첫 Route 성공·잔액 2·A 메시지 미노출 확인

### 2.4 적립 후 재개

1. Guest 잔액 0·생성 차단
2. Harness control 또는 실제 Ride 적립 계약으로 같은 UID 잔액을 1 이상 증가
3. Firestore 구독 반영 확인
4. 새 Route 생성이 즉시 다시 활성화
5. 성공 후 실제 잔액과 ledger가 정확히 감소

적립 시나리오가 제품 코드에서는 영구 0으로 막히는 회귀를 반드시 잡아야 한다.

### 2.5 실패·멱등

- provider 실패: 환불, 성공 차감 메시지 0회
- 동일 `requestId` 재시도: ledger 1건, provider 정책상 기대 횟수, `-1` 피드백 중복 0회
- 잔액 없는 서버 응답: Route 성공으로 꾸미지 않고 오류 처리

---

## 3. 증거 규칙

스크린샷은 assertion 직후, Route를 삭제하기 전에 찍는다.

필수 6장:

1. 메뉴 닫힘 + Route 생성 전 `Route Token 3개` + 1개 사용 안내
2. 메뉴 닫힘 + 첫 Route + 현재 2 + 차감/잔여 2
3. 메뉴 닫힘 + 두 번째 Route + 현재 1 + 차감/잔여 1
4. 메뉴 닫힘 + 세 번째 Route + 현재 0 + 차감/잔여 0
5. 네 번째 Token 부족 + 직전 Route 불변
6. Guest B 첫 Route + 현재 2 + 차감/잔여 2

각 스크린샷과 동일 run ID로 다음 JSON을 남긴다.

- Guest A/B UID
- 각 응답 잔액
- account switch 전후 effective/subscribed 상태
- 적립 전후 잔액과 재생성 결과
- ledger·provider 수치
- direct Directions 요청 수

빈 지도 스크린샷은 성공 증거로 인정하지 않는다.

---

## 4. Git 지시

- 기존 `fix/route-token-default-enforcement`에서 계속 작업
- `7fa4e7e`·`0e6d7b2`·`a9951ea` amend·reset·rebase 금지
- 권장 후속 커밋 1: `fix(route-token): scope spend state to active user`
- 권장 후속 커밋 2: `fix(route-token): show spend feedback on map surface`
- 권장 후속 커밋 3: `test(route-token): cover account switch and earned balance`
- 작동하지 않는 `clearRouteTokenSpendSession`·미사용 listener 등 죽은 코드는 정리하되 별도 대규모 리팩터링 금지
- `.env.local`·실제 token·스크린샷·Emulator 산출물 커밋 금지
- `--no-verify` 금지
- 재검토 전 push·upstream 변경·PR·merge 금지
- `feat/distance-based-auto-route` worktree·WIP 무변경
- 종료 시 worktree clean

---

## 5. 필수 게이트

```powershell
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm run build
git diff --check origin/main2..HEAD
git status --short --branch
```

추가 필수:

- 실제 제품 모듈 기반 direct guard 시험 PASS
- 메뉴 닫힌 기본 지도 Route 피드백 PASS
- Guest A 0 → Guest B 3·첫 Route 성공 PASS
- 같은 UID 0 → 적립 1+ → Route 재활성 PASS
- provider 실패·멱등 피드백 PASS
- 전체 Harness Node 20 연속 2회 PASS
- 각 실행 후 secret·package·port·Git 원상복구

---

## 6. 완료 보고 형식

1. **판정:** `ROUTE-TOKEN-2A-R1` PASS / FAIL / BLOCK
2. **UID 수명:** A→B 전환 시 상태 초기화 증거
3. **잔액 수렴:** response 임시값과 Firestore 구독 수렴 방식
4. **적립 재개:** 0→1+ 후 Route 재활성 결과
5. **기본 지도 UX:** 생성 전 보유량·1회 비용, 1·2·3회 차감/잔여, 위치·시간·접근성
6. **일반 계약:** 2→1→0·4번째 차단·backend 0/3/3
7. **실패·멱등:** 환불·메시지 중복 결과
8. **실제 가드:** 제품 모듈 시험과 direct 요청 0건
9. **증거:** 4장 스크린샷·run JSON 경로
10. **게이트:** Harness 2회·Functions/web build·diff check 원문
11. **Git:** 후속 commit hash·제목·파일·clean·미푸시
12. **보호:** `feat/distance-based-auto-route` HEAD·WIP 무변경

PASS 후에도 자동 Route 후보 묶음의 1 Token transaction 작업을 시작하지 말고 다음 지시를 기다린다.
