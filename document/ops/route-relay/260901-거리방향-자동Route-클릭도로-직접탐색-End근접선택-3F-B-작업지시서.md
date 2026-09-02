# 거리·방향 자동 Route — 클릭 도로 직접 탐색·End 근접 선택 3F-B 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 실제 후보 선택 알고리즘 개선** |
| 최초 작성 | 2026-09-01 |
| 상태 | **3F-A-R1 후 즉시 실행** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F-B` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 현재 HEAD | `e1d2475fa5cbe30b0db949523188072655005193` + 3F-A-R1 working tree |
| 상위 작업 | [클릭 도로·End 근접 탐색 3F](260901-거리방향-자동Route-클릭도로-End근접탐색-3F-작업지시서.md) |

## 1. 결함 판정

3F-A는 `targetRoadPoint` 전달·진단만 추가하며 후보 선택은 현행과 같다. 현행은 Start 기준 인공 방위/거리 후보 중 목표 연장 초과가 가장 작은 provider Route를 선택하므로, 사용자가 클릭한 도로와 최종 End 사이 거리를 선택 기준으로 쓰지 않는다.

사용자 재현 세 건은 클릭점이 목표 거리 원 부근인데도 End가 수 km 떨어졌다.

| 사례 | Start 표시 좌표 | raw click marker | 목표 | Start↔click 직선거리 | 목표 대비 |
|---|---|---|---:|---:|---:|
| 1 | 약 `[127.0349, 37.5051]` | `[127.142194, 37.506348]` | 10,000m | 9,465m | 94.7% |
| 2 | 약 `[127.0349, 37.5051]` | `[127.124312, 37.554444]` | 10,000m | 9,606m | 96.1% |
| 3 | 약 `[127.0349, 37.5051]` | `[127.064333, 37.468025]` | 5,000m | 4,872m | 97.4% |

도로 Route는 직선보다 짧을 수 없으므로 세 경우 모두 `Start → click` 직접 Directions를 먼저 확인할 가치가 높다. Start는 screenshot의 4자리 표시값을 fixture의 exact 입력으로 추정하지 말고 앱 상태의 실제 좌표를 캡처해 사용한다.

## 2. 제품 계약

- 사용자의 방향 click은 추상 방위가 아니라 **도달하고 싶은 도로 위치**다.
- 도로 위 click이면 해당 profile로 주행 가능한 동일 도로의 가까운 점을 End 후보로 삼는다.
- 도로 밖 click이면 해당 click에서 가장 가까운 profile별 주행 가능 도로점을 후보로 삼는다.
- click 주변에 복수 도로점이 있으면 raw click 거리를 먼저 최소화하고, 같은 근접 bucket에서는 Start에 더 가까운 도로점을 우선한다.
- 목표 연장 오차 ≤5m는 hard constraint다.
- 정확 거리 후보 중 clipped End와 clicked/snapped road point의 거리가 가장 작은 결과를 선택한다.
- End가 click 도로에서 크게 벗어난 결과를 더 이상 정상 성공으로 반환하지 않는다.

## 3. Directions 응답의 snapped 도로점 보존

현재 `fetchDirectionsRoute()`는 Mapbox 응답에서 `routes[0]`만 읽고 `waypoints`를 버린다. 이를 확장한다.

```text
routes[0].geometry / distance / duration
waypoints[0].location                 -> snappedStart
waypoints[last].location             -> snappedEnd
waypoints[last].distance             -> endSnapDistanceMeters
```

- `DirectionsRouteLike` 또는 별도 provider result에 `snappedEnd`와 `endSnapDistanceMeters`를 추가한다.
- 유효 좌표·유한 거리 검증 후에만 사용한다.
- harness fake provider는 `snappedEnd = requested end`, `endSnapDistanceMeters = 0`을 반환한다.
- 기존 일반 Route API 호출과 타입을 깨지 않도록 자동 Route 전용 adapter 또는 optional metadata를 사용한다.
- provider snapped point가 없으면 가짜 raw click으로 대체하지 않고 unavailable로 둔다.

## 4. Stage A — raw click 직접 후보

모든 자동 Route 요청의 첫 provider 호출은 다음이어야 한다.

```text
Start → targetRoadPoint
```

- 요청 endpoint는 raw click 좌표다.
- provider가 반환한 `snappedEnd`를 클릭 지점의 profile별 주행 가능 도로 기준점으로 사용한다.
- `endSnapDistanceMeters`가 raw click과 snapped road의 거리다.
- 직접 Route geometry가 목표 이상이면 먼저 정확 목표 연장에서 절단한다.
- 절단 후 실제 End↔snappedEnd, End↔raw click을 계산한다.
- exact distance와 근접 기준을 만족하면 35개 방사형 후보를 호출하지 않고 즉시 성공한다.

초기 조기 성공 기준:

```text
routeDistanceErrorMeters <= 5
endSnapDistanceMeters <= 100
clippedEndToSnappedRoadMeters <= 100
```

fixture와 실제 세 사례에서 100m가 과도하게 엄격한지 측정하되, 기준을 조용히 완화하지 않는다.

## 5. 후보를 raw Route가 아닌 clipped End로 평가

직접 후보가 조기 성공하지 못하면 후속 후보도 다음 순서로 평가한다.

1. provider Route가 목표 연장 이상인지 확인
2. 각 후보를 목표 연장에서 실제로 절단
3. clipped geometry·End·distance를 후보 결과로 보존
4. clipped End↔snapped click road 거리 계산
5. clipped End↔raw click 거리 계산
6. 그 결과로 후보 선택

현재처럼 raw provider geometry의 `목표 초과량`만 먼저 비교한 뒤 한 후보만 절단하는 방식을 제거한다.

선택 순서:

```text
1. exact distance 오차 <= 5m
2. snapped click road ↔ clipped End 거리 최소
3. raw click ↔ clipped End 거리 최소
4. raw click ↔ snapped road 거리 최소
5. 같은 click 근접 bucket이면 Start ↔ snapped road 거리 최소
6. 실제 End bearing 오차 최소
7. provider 호출·latency 최소
```

## 6. Stage B — click 주변 도로 후보

직접 click이 복수 도로·접근 제한·강변/교량 등으로 부적합할 때만 click 주변을 bounded하게 탐색한다.

- raw click 중심의 소규모 ring/grid endpoint를 사용한다. Start 중심의 넓은 방사형 후보를 우선하지 않는다.
- 예비 반경은 25m·75m 정도의 소수 표본으로 시작하고 fixture 결과 없이 확대하지 않는다.
- 각 endpoint의 provider `snappedEnd`를 수집하고 10m 안팎의 동일 도로점은 dedupe한다.
- raw click에서 가까운 snapped road point가 먼저다. 같은 근접 bucket이면 Start에 가까운 point를 우선한다.
- direct 1회 + click 주변 + fallback 전체 provider 호출 수는 현행 최대 35회를 넘지 않는다.
- 조기 성공하면 남은 호출을 중단한다.

## 7. 실패·detour 분기

### 7.1 직접 Route가 목표보다 긴 경우

- 목표 연장에서 절단한 End가 snapped click road에서 ≤100m면 성공한다.
- 100–250m는 다른 click 주변 후보와 비교한다.
- 모든 후보가 `>250m`면 성공을 반환하지 않고 실패·Token 환불한다.

### 7.2 직접 Route가 목표보다 짧은 경우

- 부족한 Route를 직선으로 연장하지 않는다.
- 3F-B에서는 상태와 부족 거리, snapped click road를 fixture/replay에 남긴다.
- 다음 detour 단계에서 `Start → bounded detour waypoint → snapped click road`를 탐색한다.
- detour 구현 전에는 click과 무관한 먼 End를 성공시키지 말고 실패·환불한다.

### 7.3 click에서 주행 가능 도로가 먼 경우

- `endSnapDistanceMeters > 250m`이면 `선택 지점 가까이에 이 이동수단으로 이용 가능한 도로가 없습니다.`로 실패·환불한다.
- 다른 profile에서는 도달 가능할 수 있으므로 profile을 바꾸라는 간결한 안내를 허용한다.

## 8. 실제 재현 인수 기준

개발 전용 raw click marker와 End marker를 동시에 표시해 세 사례를 다시 실행한다.

- raw click 좌표는 marker label과 request `targetRoadPoint`가 동일해야 한다.
- provider snapped click road 좌표와 snap 거리도 Console/진단 표에 남긴다.
- 5km/10km geometry 연장 오차 ≤5m
- 세 사례에서 기존 대비 End miss가 명확히 감소해야 한다.
- 성공으로 처리하려면 snapped click road↔End ≤100m를 우선 목표로 한다.
- 250m를 넘으면 개선되지 않은 성공으로 판단하고 FAIL 처리한다.
- screenshot 파일을 새로 제작·정리하지 않는다. 실제 화면은 사용자 확인용 최소 재현만 수행한다.

## 9. 자동 시험

1. 첫 provider endpoint가 정확히 `targetRoadPoint`
2. `waypoints[last].location/distance` parsing
3. 도로 밖 raw click이 snapped road point로 평가됨
4. direct candidate가 exact+≤100m이면 provider call 1회 조기 성공
5. raw Route 초과량이 작아도 clipped End miss가 큰 후보는 탈락
6. 초과량이 더 커도 clipped End가 click road에 가까운 후보 선택
7. 복수 nearby snapped road 중 raw click 최소, 동 bucket Start 근접 tie-break
8. direct Route가 목표보다 짧으면 먼 fallback End 성공 금지
9. 모든 End miss >250m이면 실패·Token 환불
10. Route B 탐색 중 A 유지, B 성공 시에만 교체
11. 새 click마다 새 requestId·Token 최대 1개
12. cache에 algorithmVersion·targetRoadPoint·snappedEnd·endMiss 저장

필수 게이트:

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

## 10. Git·Keep·완료 보고

- 3F-A-R1 관측·debug marker를 먼저 Review→Keep→별도 local commit으로 고정한다.
- 3F-B는 그 다음 별도 Review·별도 local commit이다.
- 기존 commit을 amend·reset·rebase하지 않는다.
- 사용자 확인 전 push·PR·merge·deploy하지 않는다.

권장 commit 제목:

```text
feat(route): prefer the road selected by route click intent
```

완료 보고에는 direct click provider 결과, snapped point·snap 거리, exact clip End, 기존/신규 End miss, provider 호출 수·latency, 3개 실제 사례 결과, 실패·환불, worktree clean 여부를 포함한다. 또한 사용자 직접 확인용 worktree 절대경로, 정확한 CLI 명령, 실제 URL·포트, Functions/Firebase Emulator 필요 여부, 서버 재시작 여부, 일반/강력 새로고침 여부와 최소 재현 절차를 적는다.
