# 거리·방향 자동 Route — 클릭 도로·End 근접 탐색 3F 작업지시서

| 항목 | 내용 |
|---|---|
| 문서 유형 | **실행 — 탐색 알고리즘 실험·개선** |
| 최초 작성 | 2026-09-01 |
| 상태 | **실행 대기** |
| 작업 ID | `DISTANCE-AUTO-ROUTE-CLICK-INTENT-3F` |
| worktree | `C:\20.HDev\boxcycle-distance-auto-route-ui-circle` |
| 브랜치 | `feat/distance-auto-route-ui-unification` |
| 현재 확인 기준 | `4c2fe1fddb5dbfce2550b408b055d7187d1ee568` — 도킹 시험 실패는 R2-R1에서 선행 보완 |
| 선행 hard constraint | [목표 연장 정확 절단 3E](260901-거리방향-자동Route-목표연장-정확절단-3E-작업지시서.md) |
| 관련 UI 보완 | [popup 지도 외곽 도킹·공간 회수 3D-2-R2](260901-거리방향-자동Route-popup-지도외곽도킹-공간회수-3D-2-R2-작업지시서.md) |

## 1. 사용자 needs와 현재 결함

사용자는 지도에서 추상적인 방위각을 지시하기보다 **도달하고 싶은 실제 도로상의 지점**을 클릭할 가능성이 높다. 클릭 지점 또는 그 지점에서 profile별로 주행 가능한 최근접 도로는 최종 End 선정의 핵심 입력이어야 한다.

현재 구현은 이 의도를 버린다.

1. `handleMapPick(lngLat)`은 `bearingFromOriginToPoint(start, lngLat)`만 계산한다.
2. `fetchDistanceAutoRoute()` 요청에는 `start`, `profile`, `targetDistanceMeters`, `bearingDeg`, `requestId`만 있고 클릭 좌표가 없다.
3. 서버는 Start 기준 방위 `±30°`와 거리 계수 `0.7–1.3`으로 인공 후보 종점 35개를 만든다.
4. `pickBestAutoRoute()`는 목표 거리 절대 오차를 우선하고, 오차가 완전히 같은 경우에만 후보 방위 차이를 비교한다.
5. 실제 반환 End와 사용자가 클릭한 좌표·최근접 도로 사이의 거리 오차는 계산·기록·점수화되지 않는다.

따라서 사용자가 도로를 정확히 눌러도 최종 End가 우측 아래 등 다른 도로로 크게 벗어날 수 있다.

## 2. 이번 작업의 원칙

- 클릭 좌표를 단순 `bearingDeg`로 축약하지 않고 서버까지 보존한다.
- 목표 연장 정확성은 hard constraint다. 정확 거리 3E를 약화해 클릭 지점에 맞추지 않는다.
- exact-distance 후보 중 **절단된 실제 End와 클릭 도로의 근접성**을 최우선 품질 지표로 둔다.
- 둘을 동시에 만족할 수 없는 입력은 멀리 벗어난 Route를 정상 성공으로 포장하지 않는다. 실패·환불하고 사용자가 거리 또는 지점을 바꾸도록 안내한다.
- 한 번의 계수 조정으로 끝내지 않는다. 재현 fixture와 수치 비교를 먼저 만들고 후보 생성·점수식을 반복 교체할 수 있게 한다.

## 3. 요청·응답 계약 확장

### 3.1 클릭 좌표 보존

클라이언트가 지도에서 받은 원본 클릭 좌표를 API에 추가한다. 신규 식별자는 의미가 명확한 `targetRoadPoint`를 사용한다.

```text
start
targetRoadPoint
profile
targetDistanceMeters
requestId
```

- 서버는 `targetRoadPoint`를 `[lng, lat]` 유한 숫자와 유효 범위로 검증한다.
- `bearingDeg`는 서버가 `start → targetRoadPoint`로 계산 가능한 파생값이다. 호환 기간에 요청 필드로 남겨도 서버는 클릭 좌표와 불일치하는 값을 신뢰하지 않는다.
- cache에는 `targetRoadPoint`, 알고리즘 version, 최종 `endMissMeters`를 함께 기록한다.
- 같은 `requestId` cache hit은 동일 결과를 반환하며 추가 Token을 차감하지 않는다.

### 3.2 진단 지표

각 후보와 최종 결과에서 최소 다음을 계산할 수 있어야 한다.

```text
rawClickMissMeters       = raw click ↔ 최종 clipped End
snappedClickMissMeters   = provider가 click을 붙인 주행 가능 도로점 ↔ 최종 clipped End
clickSnapMeters          = raw click ↔ provider snapped click point
actualEndBearingErrorDeg = Start→click 방위 ↔ Start→최종 End 방위
routeDistanceErrorMeters = 목표 연장 ↔ clipped geometry 연장
providerCallCount
searchElapsedMs
```

- 후보별 상세값을 운영 UI에 노출하지 않는다.
- 로그에는 uid·Token·인증정보를 넣지 말고 requestId·algorithmVersion과 수치만 남긴다.
- 사용자 screenshot을 증거로 만들지 않고 replay 출력 표로 비교한다.

## 4. 단계형 후보 탐색

한 번에 가중치만 바꾸지 말고 다음 stage를 순서대로 실행하며 조기 성공할 수 있게 한다.

### Stage A — 클릭 지점 직접 후보

- 첫 provider 요청은 `Start → targetRoadPoint`다.
- provider가 반환한 snapped destination을 클릭 도로 기준점으로 보존한다.
- Route가 목표 연장 이상이면 3E 방식으로 목표 연장에서 절단하고 실제 End↔클릭 도로 오차를 평가한다.
- 이 결과가 exact-distance 및 근접 임계값을 만족하면 불필요한 35개 요청을 하지 않고 즉시 성공할 수 있다.

### Stage B — 클릭 주변 endpoint 탐색

- 직접 후보가 부족하면 Start 주변의 추상 방사형 점만 사용하지 말고 `targetRoadPoint` 주변의 bounded 후보를 만든다.
- raw click에서 너무 멀리 떨어진 점을 대량 생성하지 않는다. profile과 지도 축척을 고려한 소수의 동심 거리/방위 표본을 사용한다.
- 각 provider 결과를 exact distance로 절단한 **뒤의 실제 End**로 점수화한다. provider 요청 endpoint나 인공 후보 좌표를 End로 간주하지 않는다.
- 목표보다 짧은 geometry는 성공 후보에서 제외한다.

### Stage C — 클릭 도로를 종착점으로 유지하는 detour 탐색

직접 `Start → click` Route가 목표보다 짧다면, 클릭점을 버리고 더 먼 endpoint로 바꾸는 방식만으로는 사용자 의도를 만족시키기 어렵다.

- provider가 지원하는 중간 waypoint를 사용해 `Start → detour waypoint → snapped click road` 후보를 bounded하게 탐색한다.
- detour waypoint는 Start→click corridor의 좌우·전후 소수 후보로 만들고, 총 Route가 목표보다 조금 길어지도록 적응적으로 반경을 조절한다.
- 전체 Route를 목표 연장에서 절단했을 때 End가 snapped click road에 최대한 가까운 후보를 선택한다.
- 직접 최단 Route 자체가 목표보다 긴 경우에는 정확 목표 연장으로 click에 도달하는 것이 물리적으로 불가능할 수 있다. 이때 click에서 멀리 끝나는 결과를 무조건 성공시키지 않는다.

### Stage D — 현행 방위 후보 fallback

- A–C에서 유효 결과가 없을 때만 현행 방위 기반 후보를 fallback 비교군으로 사용할 수 있다.
- fallback도 `rawClickMissMeters`와 `snappedClickMissMeters`를 계산한다.
- 근접 허용 기준을 넘는 fallback은 성공으로 반환하지 않는다.

## 5. 선택 규칙

가중합 하나에 모든 요구를 섞지 말고 다음 lexicographic 순서를 기본으로 한다.

1. geometry 유효·주행 profile 유효
2. 목표 연장 오차 ≤ 5m
3. snapped click road에 대한 최종 End 오차가 작은 후보
4. raw click 오차가 작은 후보
5. 실제 End 방위 오차가 작은 후보
6. 불필요한 초과 Route·우회·자기회귀가 적은 후보
7. provider 호출 수·latency가 작은 후보

초기 근접 bucket은 `≤50m`, `≤100m`, `≤250m`, `>250m`로 측정한다. 최종 성공 임계값은 fixture 결과를 보고 고정하되 다음 안전 계약을 지킨다.

- 사용자가 눈으로 다른 도로라고 판단할 정도로 떨어진 `>250m` 결과를 무표시 정상 성공으로 허용하지 않는다.
- 하천·고속도로·산·단절 도로 등 profile상 도달 불가능한 click은 명시적 실패·Token 환불로 처리한다.
- 성공 응답에는 진단용 `endMissMeters`를 포함할 수 있으나 일반 UI에 기술 수치를 늘어놓지 않는다.

## 6. replay·실험 체계

### 6.1 baseline 고정

현행 `ebdee9d` 알고리즘의 fixture별 결과를 먼저 저장한다.

- 선택된 후보 종류
- target distance / actual distance
- raw click / snapped click / final End 좌표
- raw·snapped End miss
- bearing error
- provider call count와 처리 시간

첨부 screenshot만으로 실제 클릭 좌표를 역산하지 않는다. 이후 재현 시 지도 click event의 정확한 좌표를 진단 fixture로 캡처한다.

### 6.2 필수 시나리오

최소 다음을 5.0km·10.0km와 cycling 중심으로 구성한다.

1. Start에서 비스듬히 뻗은 단일 도로를 클릭
2. 평행 도로가 가까이 붙은 도심
3. 강 건너 도로와 제한된 교량
4. 순환·일방통행으로 직접 경로가 목표보다 짧은 경우
5. 최단 Route가 목표보다 긴, 선택 거리로 도달 불가능한 경우
6. 산·공원·비주행 영역을 클릭
7. raw click과 provider snapped road가 크게 다른 경우
8. Route A 후 다른 도로를 클릭한 Route B 재탐색

### 6.3 비교 출력

각 알고리즘 version은 같은 fixture 세트에 대해 다음 표를 출력한다.

```text
scenario | algorithm | distanceErrorM | snappedEndMissM | rawEndMissM | bearingErrorDeg | calls | ms | result
```

- median, P90 End miss와 `≤50/100/250m` 성공 비율을 함께 집계한다.
- 새 version은 exact-distance 통과율을 낮추면 안 된다.
- 평균만 좋아지고 특정 시나리오에서 크게 악화되는 경우를 숨기지 않는다.
- provider 실호출과 분리된 순수 fixture replay를 제공해 계수 변경을 빠르게 반복 검증한다.

## 7. Token·Route A→B 안전 계약

- 내부 provider 후보 호출 횟수와 관계없이 사용자 지도 클릭 1회는 Route Token 최대 1개다.
- 모든 stage 실패, 근접 임계값 실패, provider 실패 시 Token을 환불한다.
- Route B 탐색 중 Route A geometry·End·Token 표시를 유지한다.
- B가 exact distance와 click proximity를 모두 통과한 경우에만 A를 교체한다.
- 새 지도 클릭마다 새 requestId를 사용한다.
- stage별 provider 호출 수에 hard cap과 전체 timeout을 두고 무한·폭발 탐색을 금지한다. 현재 최대 35개 후보보다 비용이 늘면 근거와 측정치를 제출한다.

## 8. 구현 순서와 Keep

작업을 검토 가능한 작은 단계로 나눈다.

1. **3F-A 관측 계약:** `targetRoadPoint` 전달·validation·cache·baseline metrics·replay harness
2. **3F-B 직접/주변 후보:** Stage A/B와 clipped End 기준 선택
3. **3F-C detour:** 필요한 fixture에서만 Stage C 추가
4. **3F-D 기준 확정:** 근접 임계값·fallback·실패 문구 고정

각 단계는 Cursor Review에서 diff와 replay 비교표를 제출한 뒤 사용자 Keep을 받고 별도 로컬 커밋으로 남긴다. 시행착오 version을 기존 커밋에 amend하지 않는다. 성능이 나쁜 실험은 별도 커밋으로 남기지 않아도 되지만 Review에서 Undo할 수 있게 결과를 먼저 보고한다.

`3D-2-R2-R1` 도킹 충돌 보완과 `3E` exact-distance core를 먼저 별도 commit으로 고정한 뒤 3F를 시작한다. 3F에서 이 두 작업을 다시 뒤섞지 않는다.

## 9. 필수 시험·완료 보고

```powershell
cd C:\20.HDev\boxcycle-distance-auto-route-ui-circle
npm -w boxcycle-web run test:distance-auto-route
npm -w boxcycle-web run test:route-token
npm --prefix functions run build
npm -w boxcycle-web run build
git diff --check
git show --check HEAD
```

추가 필수 시험:

- API가 `targetRoadPoint`를 보존하고 잘못된 좌표를 거부
- 서버 파생 bearing과 클릭 좌표 일치
- 후보 점수가 provider endpoint가 아니라 clipped End를 사용
- direct click 조기 성공과 provider 호출 절감
- 짧은 direct Route에서 detour 또는 정직한 실패
- `>250m` miss 결과의 무표시 성공 금지
- 동일 fixture baseline/new 비교표 재현
- Route A→B·requestId·Token·cache 회귀

완료 보고에는 commit hash·parent, 알고리즘 version, fixture 경로, scenario별 비교표, median/P90와 bucket 성공률, provider 호출 수·latency, 실패·환불 사례, worktree clean 여부를 포함한다. 사용자 직접 확인용 worktree 절대경로, 정확한 CLI 명령, 실제 URL·포트, Functions/Firebase Emulator 필요 여부, 서버 재시작 여부, 일반/강력 새로고침 여부와 최소 재현 절차도 적는다.

사용자 확인 전 push·PR·merge·deploy하지 않는다.
