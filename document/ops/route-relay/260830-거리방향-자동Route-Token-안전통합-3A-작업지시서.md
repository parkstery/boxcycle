# 거리·방향 자동 Route — Token 안전 통합 3A 개발팀장 작업 지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **복구·통합 실행** — 사라진 거리·방향 자동 Route를 확정 Token UI 위에 안전하게 복원 |
| 최초 작성 | 2026-08-30 |
| 상태 | **독립 검수 PASS · 원격 push 대기** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-TOKEN-3A` |
| 원본 worktree | `C:\20.HDev\boxcycle` |
| 원본 브랜치 | `feat/distance-based-auto-route` |
| 원본 commit | `2b0bfec8b784f9c633605991044e05484556285f` + 현재 미커밋 popup 통합 보완분 |
| Token 기준 | `origin/fix/route-token-default-enforcement` at `ad4d7764e846c1016d13ea74cbdd6812bfff69af` |
| 신규 통합 worktree | `C:\20.HDev\boxcycle-distance-auto-route-token-integration` |
| 신규 통합 브랜치 | `feat/distance-auto-route-token-integration` |

> 개발팀장에게 전달할 한 줄: **자동 Route 구현은 삭제되지 않았다. 원격 `2b0bfec`과 루트 worktree의 미커밋 popup 통합 보완분을 먼저 안전하게 커밋해 보존한 뒤, `ad4d776`에서 새 통합 worktree를 만들고 merge하라. 단순 파일 덮어쓰기는 금지하며, 후보 최대 35개가 각각 Token을 차감하지 않도록 자동 Route 사용자 행동 1회 전체를 서버 transaction 1건·Token 1개로 처리한 뒤 기본 경로 설정 popup에서 Token UI와 함께 보이게 하라. Token 획득 로직은 건드리지 말고 재검토 전 push·PR·배포하지 말라.**

---

## 0. 확인된 위치와 현재 상태

### 0.1 최초 구현

원격 브랜치 `origin/feat/distance-based-auto-route`의 `2b0bfec`에 최초 구현이 있다.

- `apps/web/src/hooks/useDistanceAutoRoute.ts`
- `apps/web/src/lib/distanceAutoRoute.ts`
- `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts`
- `DistanceAutoRouteSheet` 기반 초기 UI

### 0.2 사용자가 실제로 보았던 최신 UI

루트 `C:\20.HDev\boxcycle`의 현재 미커밋 보완분에 남아 있다.

- `MapView.tsx`의 `목표 거리로 End 자동 찾기`
- 이동수단·목표 거리 선택
- `지도에서 방향 선택`
- 기존 Start pin과 시작 마커 동기화
- 거리 원·방향 클릭·후보 탐색·성공/실패 상태
- 별도 RTW 메뉴/Sheet 제거, 기본 경로 설정 popup 통합

독립 확인 결과:

- `test:distance-auto-route`: **10 pass**
- web build: **PASS**

현재 Token worktree에는 이 심볼과 UI가 없으므로 기능이 사라져 보이는 것이며, 구현 자체가 삭제된 것은 아니다.

### 0.3 그대로 복사하면 안 되는 이유

현재 `useDistanceAutoRoute.ts`는 후보 최대 `7×5=35`개 각각에 `fetchRouteByProfile()`을 호출하며 매 후보마다 서로 다른 `requestId`를 만든다.

`ad4d776`의 Token 서버 계약에 그대로 붙이면 성공 후보 호출마다 1 Token이 차감된다. 잔액 3인 Guest는 탐색 한 번에 Token을 모두 소진하고 나머지 후보가 차단될 수 있다. 따라서 클라이언트 파일을 단순 복사하거나 35개 호출을 그대로 유지한 채 UI만 노출하는 것은 금지한다.

---

## 1. 1단계 — 기존 자동 Route WIP 보존

루트 worktree에서 현재 자동 Route 코드만 기능 단위로 보존한다.

1. `git status`와 diff를 기록한다.
2. 다음 자동 Route 코드·시험만 스테이징한다.
   - `apps/web/scripts/distance-auto-route/distance-auto-route-contract.test.ts`
   - `apps/web/src/App.tsx`
   - `apps/web/src/components/map/MapView.css`
   - `apps/web/src/components/map/MapView.tsx`
   - `apps/web/src/components/ride/RideRoutePanel.css`
   - `apps/web/src/components/ride/RideRoutePanel.tsx`
   - `apps/web/src/components/route/DistanceAutoRouteSheet.css` 삭제
   - `apps/web/src/components/route/DistanceAutoRouteSheet.tsx` 삭제
   - `apps/web/src/hooks/useDistanceAutoRoute.ts`
   - `apps/web/src/lib/distanceAutoRoute.ts`
3. `document/README.md`와 `document/ops/route-relay/`의 다른 작업지시서는 이 코드 커밋에 섞지 않는다.
4. `test:distance-auto-route`와 web build를 다시 실행한다.
5. 권장 commit: `fix(route): move distance auto route into map popup`
6. 이 보존 commit은 로컬에서만 만들고 아직 push하지 않는다.

reset·checkout·stash로 현재 WIP를 지우거나 `2b0bfec` 상태로 되돌아가지 않는다.

---

## 2. 2단계 — 새 통합 worktree 생성

1. 기준 원격을 fetch한다.
2. `origin/fix/route-token-default-enforcement`의 `ad4d776`에서 다음을 만든다.

```text
worktree: C:\20.HDev\boxcycle-distance-auto-route-token-integration
branch: feat/distance-auto-route-token-integration
```

3. §1의 로컬 `feat/distance-based-auto-route` 보존 commit을 `--no-ff` merge한다.
4. `MapView.tsx`, `MapView.css`, `App.tsx` 충돌은 파일 전체 선택으로 해결하지 않는다.
5. 다음 양쪽 기능을 모두 보존한다.
   - Token 전역 카드 없음
   - Token 보유량·비용·차감·부족 상태가 경로 설정 popup 안에 있음
   - 같은 popup에 `목표 거리로 End 자동 찾기`가 있음
   - Start pin·이동수단·목표 거리·방향 선택 흐름
   - 일반 자동차·자전거·도보 Route 생성
   - 브라우저 direct Directions 우회 0건

---

## 3. 3단계 — 자동 Route 1회 = Token 1개

### 3.1 필수 서버 계약

자동 Route 탐색은 클라이언트에서 후보별 Token 함수 35회를 호출하지 않는다. 인증된 서버 묶음 API 한 번으로 처리한다.

입력:

- `start`
- `profile`
- `targetDistanceMeters`
- `bearingDeg`
- 사용자 행동 1회에 고정된 `requestId`

출력:

- 선택된 Route geometry·distance·duration·snapped End
- 목표/실제 거리 요약
- 권위 있는 `routeTokenBalance`
- 실패 상태와 환불 여부

계약:

- 사용자 자동 Route 행동 1회당 Token 차감 **정확히 1개**
- 후보 내부 provider 호출 수와 Token ledger 차감 횟수를 분리
- 잔액 0이면 provider 호출 전에 차단
- 허용 오차 20% 안의 Route를 찾은 경우에만 최종 성공 차감 확정
- 모든 후보 실패·허용 오차 초과·provider 실패는 Token 순감소 0
- 동일 `requestId` 재시도는 추가 차감·추가 provider 호출 없이 동일 결과 반환
- 서버 응답 잔액으로 기존 popup에 `Route Token -1 · 잔여 N개` 1회 표시
- Mapbox secret과 후보 평가를 브라우저에 노출하지 않음

### 3.2 후보 규칙 보존

- 거리 배율 `0.7~1.3`
- 방향 오프셋 `[-30,-15,0,15,30]`
- 방향 허용 범위 ±30°
- 1순위 거리 오차, 동률 2순위 방향 일치
- 최대 거리 오차 20%
- geometry 마지막 점을 snapped End로 사용
- 후보 provider 호출은 무제한 `Promise.all(35)` 대신 명시적 제한 동시성 적용

---

## 4. UI 통합 계약

기본 경로 설정 popup 순서:

1. Start 선택 및 지도 마커 표시
2. Token 보유량·생성 비용 표시
3. `목표 거리로 End 자동 찾기`
4. 이동수단 선택
5. 목표 거리 선택
6. 지도에서 방향 선택
7. 같은 popup에 탐색 중 상태
8. 성공 시 Route·End marker·목표/실제 거리·Token 차감 표시
9. 실패 시 방향/거리 재선택, Token 잔액 불변

별도 RTW 메뉴나 별도 Sheet를 다시 만들지 않는다. Token 전역 카드도 되살리지 않는다.

---

## 5. 필수 검증

### 5.1 자동시험

- 기존 `test:distance-auto-route` 10개 계약 PASS
- 기존 `test:route-token` 전체 PASS
- 일반 Route `3→2→1→0→차단` 회귀 없음
- 자동 Route 성공 1회: balance `3→2`, spend ledger 1건
- 내부 후보 호출 최대 35여도 Token 차감 1건
- 자동 Route 실패: balance 3 유지, 순차감 0
- 잔액 0: provider 호출 0
- 동일 requestId 재시도: 추가 차감 0·추가 provider 호출 0
- 브라우저 `/directions/v5/` 직접 호출 0

### 5.2 사용자 화면 증거

1. Start marker + popup Token 3 + 자동 찾기 버튼
2. 이동수단·목표 거리 선택
3. 목표 거리 원 + 지도 방향 선택
4. 탐색 중
5. 성공 Route + snapped End + 목표/실제 거리 + `-1 · 잔여 2개`
6. 실패 후 잔액 불변·방향 다시 선택

### 5.3 게이트

```powershell
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git status --short --branch
```

---

## 6. Git·범위 보호

- `ad4d776`와 기존 Token 커밋 amend·reset·rebase 금지
- 원본 자동 Route 보존 commit 재작성 금지
- 통합은 새 worktree·새 브랜치에서만 수행
- Token 획득률·최소 주행 조건·Public Route 완주 적립 변경 금지
- Route Token 경제 정책 문서 변경 금지
- 검수 전 push·PR·`main2` merge·배포 금지
- `.env.local`·secret·Emulator 산출물·스크린샷 커밋 금지
- 완료 시 원본 root WIP 유실 없음, Token worktree clean, 통합 worktree clean

---

## 7. 완료 보고 형식

1. **판정:** PASS / FAIL / BLOCK
2. **원본 보존:** 자동 Route WIP commit hash·정확한 스테이징 파일
3. **통합:** worktree·branch·merge commit·충돌 해결 파일
4. **서버 계약:** 1행동=1Token 보장 방식·멱등·실패 환불
5. **수치:** 후보 수·provider 호출·ledger·balance 전후
6. **UI:** 기본 popup 통합과 Start marker·거리·방향·결과
7. **증거:** 6장 스크린샷·evidence JSON 절대경로
8. **게이트:** 두 하네스·Functions/web build·diff check
9. **Git:** 세 worktree 상태·미푸시·원격 무변경
10. **보호:** Token 획득 로직·root 문서 WIP 무변경

완료 후 자동 push하지 말고 재검토를 기다린다.

---

## 8. 2026-08-31 독립 검수 결과

- 원본 자동 Route 보존 commit: `2693f659fb140eb7b5e2d9c21754b5c211c17ba6`
- 통합 merge commit: `f99f636`
- 통합 최종 commit: `43db30681446d8c88871fda77802fe476209b035`
- `ad4d776`와 `2693f65` 모두 통합 HEAD의 ancestor임을 확인
- `test:distance-auto-route`: **10/10 PASS**
- Route Token 전체 하네스 마지막 실행: **PASS** (`3→2→1→0→4회 차단` 증거 포함)
- Functions build: **PASS**
- web build: **PASS**
- 통합 worktree: **clean**
- Token 획득 계산 로직: **변경 없음**
- 원격 상태: Token 브랜치만 push 완료, 자동 Route 최신 commit과 통합 브랜치는 아직 미push

다음 단계는 `260831-거리방향-자동Route-Token-통합-원격보존-3A-R1-작업지시서.md`를 따른다.
