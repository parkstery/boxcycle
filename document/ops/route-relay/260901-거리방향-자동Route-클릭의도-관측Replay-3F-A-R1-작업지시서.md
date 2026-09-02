# 거리·방향 자동 Route — 클릭 의도 관측·Replay 3F-A-R1 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — Review 보완** |
| 최초 작성 | 2026-09-01 |
| 상태 | **현재 Review 보완 필요** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F-A-R1` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| HEAD | `e1d2475fa5cbe30b0db949523188072655005193` |
| 상위 작업 | [클릭 도로·End 근접 탐색 3F](260901-거리방향-자동Route-클릭도로-End근접탐색-3F-작업지시서.md) |

## 1. 현재 상태

현재 미커밋 diff는 `targetRoadPoint`를 hook→API→Functions 실행부에 연결하고 click-intent test·replay·fixture를 추가한다. 범위는 3F-A와 일치하며 사용자 Review에서 Keep할 수 있다.

다만 커밋 전 다음 결함을 보완해야 한다.

1. replay가 `ebdee9d-baseline`과 `3F-A-observe` 모두에 같은 인공 직선 geometry를 생성해 비교한다.
2. fixture에는 실제 baseline geometry·End·후보 응답이 없고 Start·click·목표 거리만 있다.
3. `providerCallCount = scored.length`라 provider가 실패하거나 목표보다 짧은 Route를 반환한 호출을 누락한다.
4. 실제 provider snapped click point가 없는데 raw click을 대신 넣어 `snappedClickMissMeters`와 `clickSnapMeters`가 실제 측정값처럼 보인다.
5. `e1d2475`의 package script가 아직 미커밋인 3F-A test 파일을 참조하므로 후속 3F-A 커밋까지 완료해야 clean checkout 시험 계약이 완성된다.

## 2. 보완 계약

### 2.1 provider 호출 수

- `fetchDirections()`를 실제 호출하기 직전에 attempt counter를 증가시킨다.
- 성공, provider throw, 너무 짧은 geometry, 절단 불가 결과를 모두 실제 호출 수에 포함한다.
- straight-line 상한으로 provider 호출 전에 제외한 후보는 호출 수에 포함하지 않는다.
- 병렬 실행에서도 중복·누락 없이 결정적으로 집계되는 시험을 추가한다.

### 2.2 snapped click 지표의 정직한 표현

- 아직 click 좌표를 provider endpoint로 보내지 않는 현행 baseline에는 실제 snapped click point가 없다.
- 이 경우 `snappedClickMissMeters`와 `clickSnapMeters`를 raw click 값으로 대체하지 말고 `null`/`unavailable`로 표현한다.
- Stage A에서 `Start → targetRoadPoint` 직접 요청을 구현한 뒤 provider snapped waypoint를 얻었을 때만 두 지표를 채운다.
- `rawClickMissMeters`는 현재 단계부터 실제 값으로 계산한다.

### 2.3 replay fixture

- 알고리즘 이름만 바꿔 동일 함수를 두 번 호출하는 replay를 금지한다.
- fixture에 최소한 현행 baseline의 후보 provider 응답 geometry 또는 선택 완료 geometry·clipped End를 저장해 실제 baseline 경로를 재생한다.
- provider 응답 전체를 저장하기 어렵다면 deterministic fake provider 후보 목록과 expected selected candidate를 fixture로 둔다.
- synthetic fixture는 명확히 `synthetic`으로 표시하고 실제 사용자 재현과 혼동하지 않는다.
- 최소 시나리오:
  1. 직선 도로 click과 End가 가까운 경우
  2. click은 우상향인데 baseline End가 우하향으로 벗어나는 경우
  3. 평행 도로가 가까운 경우
  4. 목표보다 짧아 제외되는 provider 응답과 throw가 섞인 경우
- 3F-A는 관측만 하므로 baseline과 선택 결과가 같아도 된다. 단, 같은 실제 geometry에서 계산됐다는 것을 fixture로 증명해야 한다.
- 향후 실제 지도 재현에서 정확한 click event 좌표를 캡처할 입력 형식을 마련한다. screenshot에서 좌표를 추정하지 않는다.

### 2.4 비교 출력

```text
scenario | fixtureKind | algorithm | distanceErrorM | snappedEndMissM | rawEndMissM | bearingErrorDeg | attemptedCalls | ms | result
```

- unavailable snapped 지표는 `-`로 출력한다.
- baseline과 관측 version의 geometry/End가 동일하면 `sameResult=true`를 명시한다.
- 단순 `assert fixtures.length >= 2`가 아니라 scenario별 기대 End·오차·호출 수를 수치 assert한다.

### 2.5 개발 전용 raw 클릭 마커·좌표 라벨

사용자가 방향 선택을 위해 실제로 클릭한 좌표와 최종 End를 지도에서 즉시 비교할 수 있도록 개발 전용 임시 marker를 추가한다.

- 방향 모드의 유효 지도 클릭 event에서 받은 **원본 `lngLat`** 위치에 marker를 생성한다.
- 방위 후보·provider snapped point·절단 End 위치로 marker를 옮기지 않는다. marker는 `targetRoadPoint`의 화면 증거다.
- 기존 Start/End marker와 혼동되지 않는 magenta 또는 보라색의 작은 crosshair/ring을 사용하고 `C` 또는 `CLICK`로 식별한다.
- marker 바로 아래에 `lng, lat` 순서로 좌표를 표시한다. 소수점 6자리 고정과 monospace를 사용한다.
- 예: `127.020123, 37.500456`
- marker와 label 전체는 `pointer-events: none`으로 하여 지도 click·drag·popup drag·자동 Route 요청을 방해하지 않는다.
- 검색 중, 성공, 실패 후에도 현재 클릭 marker를 유지해 End와 비교할 수 있게 한다.
- 새 방향을 클릭하면 기존 marker를 새 raw 클릭 위치로 교체한다. marker가 누적되면 안 된다.
- checkbox off, 자동 Route 세션 종료, `경로 삭제`, Start 변경, component unmount 때 제거한다.
- Route A 후 Route B를 탐색할 때 B click 즉시 marker만 새 위치로 이동하고, A geometry는 B 성공 전까지 유지한다.
- 일반 수동 End 클릭에는 이 marker를 생성하지 않는다.
- production build에는 노출하지 않는다. `import.meta.env.DEV` 또는 명시적 local/harness debug gate 아래에서만 생성한다.
- reverse geocoding이나 추가 provider 호출을 발생시키지 않는다.

권장 DOM/data 계약:

```text
.map-view__auto-route-click-debug-marker
.map-view__auto-route-click-debug-label
data-click-lng="127.020123"
data-click-lat="37.500456"
```

필수 시험:

- direction click의 원본 좌표와 marker dataset·label이 소수점 6자리까지 일치
- marker 생성 때문에 자동 Route POST 횟수가 늘지 않음
- 새 click 시 marker 1개만 존재하고 좌표가 교체됨
- searching/found/failed에서 marker 유지
- mode off/session close/route clear/unmount에서 제거
- 수동 End 모드와 production gate에서 marker 0개
- End marker 좌표와 debug click marker 좌표가 독립적으로 유지

## 3. Keep·Git

- 현재 Review diff는 client/server 필수 배선을 완성하므로 사용자가 Keep할 수 있다.
- Keep 후 위 보완과 개발 전용 raw 클릭 marker를 계속하고, 보완 완료 전에는 3F-A 커밋을 만들지 않는다.
- `e1d2475`를 amend·reset·rebase하지 않는다.
- 보완 완료 후 다시 Review 결과·시험·replay 표를 제출하고 사용자 확인 뒤 후속 로컬 커밋을 남긴다.
- 원격은 `4c2fe1f`에 머물러 있다. 후속 commit을 push하지 않는다.

권장 commit 제목:

```text
test(route): preserve and replay route click intent
```

## 4. 필수 게이트

```powershell
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:distance-auto-route-replay
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git show --check HEAD
```

완료 보고에는 실제 attempted call 수, unavailable snapped 지표, fixture 종류, scenario별 expected/assert 결과, baseline/3F-A 동일 여부와 이유를 포함한다.
