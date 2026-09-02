# 거리·방향 자동 Route — 컴팩트 UI·목표 거리 원 3B 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **자동 Route UI 보완** |
| 작성일 | 2026-08-31 |
| 상태 | **부분 확인 · UI/원 PASS, 자동 Route 서버 연결 BLOCK** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-3B` |
| 기준 브랜치 | `origin/feat/distance-auto-route-token-integration` |
| 기준 commit | `43db30681446d8c88871fda77802fe476209b035` |
| 신규 worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 신규 브랜치 | `feat/distance-auto-route-ui-circle` |

## 1. 이번 단계의 목표

기본 경로 설정 popup 안에서 다음 세 문제만 해결한다.

1. 자동차·자전거·도보 선택기가 일반 Route와 자동 Route에 각각 있어 중복되는 문제
2. 자동 Route 설정창이 세로 공간을 과도하게 사용해 지도를 많이 가리는 문제
3. 목표 거리를 선택해도 거리 원이 즉시 보이지 않는 문제

Token 획득 정책, 후보 탐색 알고리즘, Token 차감 계약은 이번 범위가 아니다.

## 2. 확인된 원인

### 2.1 이동수단 선택 중복

`MapView.tsx`에 다음 두 선택기가 별도로 존재한다.

- 일반 Route용 `profileSpecs`·`profileButtons`
- 자동 Route용 `autoProfileSpecs`·`autoProfileButtons`

동일한 자동차·자전거·도보 선택을 한 popup 안에서 두 번 만들고 있어 상태와 공간이 중복된다.

### 2.2 거리 원 표시 시점 누락

- `circleLineString()`과 `distance-target-circle` source/layer는 이미 존재한다.
- 그러나 거리 preset 클릭은 popup의 지역 변수 `targetKm`만 변경한다.
- React hook에 Start·목표 거리가 전달되는 시점은 `지도에서 방향 선택` 버튼을 누른 뒤이다.
- 따라서 사용자가 3/5/10/15/20/30 km를 고른 즉시 원이 생성되지 않는다.

### 2.3 원을 볼 수 있는 카메라 처리 누락

거리 원 layer를 추가하는 effect에는 원의 bounds에 맞춘 `fitBounds` 처리가 없다. 현재 지도가 도로 단위로 확대된 상태라면 3~30km 원 둘레는 화면 밖에 놓여, layer가 있어도 사용자에게 보이지 않는다.

## 3. Git 격리

1. `git fetch origin --prune` 후 기준 commit을 확인한다.
2. `43db306`에서 신규 worktree와 신규 브랜치를 만든다.
3. 기존 `feat/distance-based-auto-route`, `feat/distance-auto-route-token-integration`, `fix/route-token-default-enforcement` 브랜치에는 새 commit을 만들지 않는다.
4. 루트의 `document/README.md`와 `document/ops/route-relay/` 미커밋 문서를 새 제품 코드 commit에 섞지 않는다.
5. 검수 전 push·PR·`main2` merge·배포하지 않는다.

## 4. UI 계약

### 4.1 이동수단 선택기는 한 세트만 둔다

- popup 안의 자동차·자전거·도보 선택기는 정확히 한 세트만 렌더한다.
- Start가 선택된 뒤 하나의 선택기로 일반 Route와 자동 Route가 같은 profile 상태를 사용한다.
- End가 없는 상태에서 이동수단을 바꾸는 행위는 선택만 변경하며 provider 호출과 Token 차감을 일으키지 않는다.
- Start와 End가 모두 있는 일반 Route 상태에서 생성 행동을 했을 때만 기존 일반 Route 생성 계약을 실행한다.
- 자동 Route는 같은 선택 profile을 서버 묶음 요청에 전달한다.

### 4.2 popup을 컴팩트하게 정리한다

권장 정보 순서:

1. 주소·Start/WP/End 행
2. Token 보유량·비용 한 줄
3. 이동수단 한 행
4. End 선택 방식: 지도에서 직접 선택 / 목표 거리로 자동 찾기
5. 자동 찾기 선택 시에만 거리 preset 한 행과 방향 선택 버튼 노출

다음 중복 요소는 제거하거나 한 행으로 합친다.

- 두 번째 이동수단 제목과 버튼 세트
- `End 선택`과 `목표 거리로 End 자동 찾기`가 따로 차지하는 중복 설명 영역
- 의미 없이 반복되는 여백·구분선·대형 버튼

데스크톱 1920×1080과 1366×768에서 expanded popup이 화면 중앙의 지도 탐색을 과도하게 가리지 않아야 한다. 내용이 작아질 수 없는 경우 전체 popup을 키우지 말고 자동 Route 세부 영역만 제한 높이 안에서 처리한다. 주소·Token·핵심 행동은 스크롤 없이 보여야 한다.

### 4.3 거리 원은 거리 선택과 동시에 표시한다

- 자동 찾기를 펼치면 현재 기본값 10km 원을 즉시 표시한다.
- 3/5/10/15/20/30km를 클릭할 때마다 같은 source의 geometry를 즉시 갱신한다.
- 중심은 현재 Start marker와 정확히 일치해야 한다.
- 원은 목표 Route 자체가 아니라 직선거리 안내 원임을 짧게 표시한다.
- 거리 선택만으로 provider 호출 또는 Token 차감이 발생해서는 안 된다.
- 방향 선택·탐색 중·실패 후 재선택 상태에서는 원을 유지한다.
- 자동 Route 성공, 취소, 경로 삭제, popup 종료 시 원을 제거한다.

### 4.4 원이 화면 안에 보여야 한다

- 최초 자동 찾기 진입과 거리 변경 사용자 행동에 한해 원 bounds가 보이도록 지도를 조정한다.
- popup이 있는 쪽에 충분한 padding을 두어 원이 popup 뒤에 가려지지 않게 한다.
- 단순 React 재렌더마다 반복 zoom하지 않는다.
- Start marker를 이동시키지 않는다.
- 사용자가 방향을 선택할 수 있을 만큼 원과 주변 지도가 함께 보여야 한다.

## 5. 회귀 보호

- 자동 Route 성공 1회 = Token 1개 유지
- 거리·profile 선택만으로 Token ledger 변화 0
- 일반 Route `3→2→1→0→차단` 유지
- 자동 Route 실패·허용오차 초과 시 Token 순차감 0
- 동일 requestId 멱등 유지
- direct browser Directions 호출 0
- Start marker와 snapped End 유지
- 일반 Start/WP/End 수동 선택 유지

## 6. 필수 시험

기존 시험에 다음 UI 계약을 추가한다.

1. popup 안 이동수단 선택 버튼이 자동차·자전거·도보 각 1개, 총 3개
2. 자동 찾기 진입 즉시 10km 원 source/layer 존재
3. 5km→10km 변경 시 geometry와 지도 bounds 갱신
4. 원 중심과 Start 좌표 일치
5. 거리 선택 전후 provider 호출 0·Token balance 불변
6. 방향 선택 후 성공 시에만 balance `3→2`
7. 취소·성공·경로 삭제 시 원 제거
8. 1920×1080, 1366×768에서 popup 크기와 핵심 요소 가시성 캡처

필수 게이트:

```powershell
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git status --short --branch
```

## 7. 완료 보고

1. 판정: PASS / FAIL / BLOCK
2. worktree·branch·HEAD
3. 이동수단 선택기 단일화 전후 구조
4. 거리 클릭→원 geometry→fitBounds 연결 방식
5. Token 비차감·성공 1회 차감 증거
6. 두 해상도 screenshot 절대경로
7. 기존·신규 시험 결과
8. diff와 worktree 상태
9. 미push·PR/merge/배포 없음

완료 후 자동 push하지 말고 사용자 검토를 기다린다.

---

## 8. 2026-08-31 사용자 확인·독립 재검토

- 이동수단 선택기 단일화: 확인
- popup 축소: 확인
- 거리 선택 즉시 원 표시·지도 범위 조정: 확인
- 원 색상: `#E8A33D` 주황 점선으로 지도 대비 부족
- 자동 Route 생성: `Failed to fetch`로 실패
- 직접 원인: 운영 Firebase에 `getDistanceAutoRoute` 함수가 배포되지 않음
  - `firebase functions:list`: `getMapboxDirections`는 존재, `getDistanceAutoRoute`는 없음
  - `getDistanceAutoRoute` OPTIONS: HTTP 404
  - `getMapboxDirections` OPTIONS: HTTP 204 + CORS 허용
- `test:distance-auto-route`: 15/15 PASS
- Functions build: PASS
- web build: PASS
- 3B worktree: 5개 수정 파일 + 1개 신규 screenshot script, 아직 미커밋
- 전체 Token 하네스: 5001번을 3B Vite가 점유 중이므로 아직 미실행

후속 보완은 `260831-거리방향-자동Route-빨강원-서버연결-3B-R1-작업지시서.md`를 따른다.
