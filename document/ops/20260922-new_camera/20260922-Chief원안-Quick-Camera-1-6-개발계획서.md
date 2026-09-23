# 260922 Quick Camera 1~6 개발계획서 (Chief 원안)

> Chief 가 2026-09-22 에 제시한 요구사항 원문을 보존한다. 감리 해석·조사 결과는
> `INSTRUCTION.md` 에 있으며, **충돌 시 이 원안이 요구의 기준**이다.

## 1. 목적

기존 `Map 버튼 → MapView Control` 카메라 제어는 **그대로 유지**한다.
주행 중에만 Account 버튼 왼쪽에 Quick Camera 1~6 버튼을 추가한다. 자주 쓰는 6개
구도를 한 번의 클릭으로 적용하는 빠른 접근 기능이며, 기존 기능의 대체가 아니다.

```
┌─────────────────────────────────────────────────────┐
│                         [1][2][3][4][5][6] [Account]│
└─────────────────────────────────────────────────────┘
```

## 2. 카메라 정의

| 번호 | 명칭 | 카메라가 바라보는 것 | 카메라 위치 | 클릭 시 거리 |
|---|---|---|---|---|
| 1 | 상공 | 라이더를 수직 상공에서 | 라이더 바로 위 | Route Fit / 60m 토글 |
| 2 | 전방 | 라이더 진행 방향 | 라이더보다 5m **뒤** | 5m |
| 3 | 후방 | 진행 반대 방향 | 라이더보다 5m **앞** | 5m |
| 4 | 좌측 | 진행 방향의 좌측 | 라이더 좌측 5m | 5m |
| 5 | 우측 | 진행 방향의 우측 | 라이더 우측 5m | 5m |
| 6 | 북향 | 북쪽 기준 | 라이더 기준 5m | 5m |

**5m·60m 은 Mapbox zoom 값이 아니라 실제 월드 거리다.**

## 3. 가장 중요한 규칙 — 카메라는 항상 라이더를 바라본다

```
Camera ──look-at──▶ Rider
```

bearing 만 바꾸는 구현은 금지. **카메라 위치 → 라이더 위치** 방향을 계산한다.

- 2번: `cameraPos = riderPos − heading × 5m`, `lookAt = riderPos`
- 3번: `cameraPos = riderPos + heading × 5m`, `lookAt = riderPos`
- 4번: `cameraPos = riderPos + (heading 90° 좌회전) × 5m`
- 5번: `cameraPos = riderPos + (heading 90° 우회전) × 5m`
- 6번: 진행 방향과 무관, **북쪽(0°) 기준**. 단 라이더를 바라보는 원칙은 유지.
  Mapbox bearing 을 0° 로 고정하는 것과 동일하게 처리하지 말 것.

## 4. 1번 토글

```
1 클릭 → Route Fit (Start~End 전체 경로가 화면에 들어오도록 자동 조정)
1 클릭 → Aerial 60m (라이더와의 실제 거리 60m 상공)
1 클릭 → Route Fit …
```

최초 상태는 **1 = ON(Route Fit)**. 고정 zoom 값 사용 금지. 긴 경로는 축소, 짧은
경로는 확대된다. `fitBounds()` 는 **1번을 클릭한 그 순간 한 번만** 실행한다.

## 5. 사용자 Zoom 조작 규칙 (매우 중요)

카메라 preset 이 지속적으로 zoom 을 강제해서는 안 된다.

```
2 클릭 → 5m → 사용자가 Zoom In → 그 상태를 유지한다
2 다시 클릭 → 그때 비로소 5m 재적용
```

- 버튼 클릭 = preset 적용
- 사용자 조작 = 현재 거리/zoom 을 사용자가 변경 (코드가 되돌리지 않는다)
- 1번도 동일. Route Fit 후 확대하면 그 화면을 유지하고, 다시 클릭하면 Aerial 60m 로 간다.

## 6. UI 표시 조건

주행 중에만 표시한다. 주행 전·종료 후에는 `[Map] … [Account]` 만 보인다.
CSS 로 숨기지 말고 **ride state 기준으로 렌더링**한다.

## 7. 구조

```
Quick Camera 1~6 ─┐
                  ├─▶ 공통 Camera Controller ─▶ Mapbox
MapView Control ──┘
```

기존 MapView Control 은 변경하지 않는다.

## 8. 반드시 피해야 하는 구현

- ❌ 버튼마다 별도의 Mapbox 카메라 코드
- ❌ 5m 를 고정 zoom 값(예: 17)으로 구현
- ❌ 카메라 위치만 옮기고 bearing 만 변경
- ❌ 사용자가 Zoom 한 뒤 코드가 preset 을 다시 강제
- ❌ 라이더 위치가 바뀔 때마다 `fitBounds()` 재실행

## 9. 상태 모델

```ts
type QuickCamera = 1 | 2 | 3 | 4 | 5 | 6;
activeQuickCamera   // 현재 선택된 번호
camera1RouteFit     // 1번 전용: true=Route Fit, false=Aerial 60m
```

2~6 은 별도 거리 상태를 저장하지 않는다 — 재클릭 시 5m 재적용.

## 10. heading 데이터

GPS heading · route bearing · rider movement vector · marker rotation 중 **현재
시스템이 실제로 쓰는 것**을 확인한다. 화면상 marker 방향 ≠ 실제 주행 heading.

## 11. 좌표 계산

5m 는 매우 짧으므로 위경도 단순 덧셈 금지. 프로젝트에 이미 있는 좌표 유틸을
**재사용**하고 새 라이브러리를 추가하지 않는다.

## 12. pitch

명시하지 않았다. 기존 RTW 카메라 스타일 유지가 1차 원칙. 구현 후 실제 화면을 보고
pitch·altitude·look-at point 를 조정한다 — 이는 5m 자체의 변경이 아니라 구도 조정이다.

## 13. QA 기준 (요약)

- 주행 전 미표시 / 주행 시작 시 1~6 표시 / Account 왼쪽 / 주행 종료 시 사라짐
- 기존 Map 버튼·MapView Control 무변화
- 1번: 1클릭 Route Fit(긴 경로 축소·짧은 경로 확대) → 2클릭 Aerial 60m → 3클릭 Route Fit,
  각 상태에서 사용자 Zoom 가능하고 자동 fit 이 재실행되지 않음
- 2~5번: 진행 방향 기준 뒤/앞/좌/우 5m, 라이더를 바라봄, 재클릭 시 5m 재설정
- 6번: 북쪽 기준 5m, 라이더를 바라봄, heading 변화에 영향받지 않음

## 14. 완료 판정

> 주행 중 Account 왼쪽의 1~6 버튼을 클릭하면 라이더의 현재 위치와 진행 방향을
> 기준으로 해당 카메라 구도가 즉시 적용되고, 클릭으로 설정된 초기 거리 이후에는
> 사용자의 수동 Zoom 조작을 방해하지 않으며, 기존 Map 버튼과 MapView Control 의
> 카메라 기능은 그대로 유지된다.

① 5m/60m = 실제 거리 ② 카메라는 항상 Rider 를 본다 ③ preset 은 클릭 순간에만
적용한다 ④ 기존 MapView Control 과 동일한 Camera Controller 를 공유한다
