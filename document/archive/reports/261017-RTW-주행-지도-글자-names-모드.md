# 주행 중 지도 글자 — 성능과 지리 정보의 절충(`names` 모드)

| 항목 | 내용 |
|---|---|
| 문서 유형 | **문제 해결 보고** |
| 작성 | 2026-10-17 · Supervisor (Claude) |
| 상태 | **확정** — 2026-10-16 Chief "names 모드로 하자. 이대로 간다." |
| 작업 묶음 | [ops/20261016-map-cut](../../ops/20261016-map-cut/) — [M1 측정 스위치](../../ops/20261016-map-cut/04-review-m1.md) · [M2 전부 숨김](../../ops/20261016-map-cut/04-review-m2.md) · [M3 both](../../ops/20261016-map-cut/04-review-m3.md) · [M4 names](../../ops/20261016-map-cut/04-review-m4.md) |

## 증상

1. 프레임 분해 결과 지도 렌더 JS 가 가장 큰 덩어리(PC 7.3 ms, 폰 10.7 ms).
2. 글자를 전부 숨기자 빨라졌지만 Chief: "주변 지리를 알려면 지명·건물명이 필요하다."

## 원인

카메라 2(높은 기울기)의 지도 비용 대부분이 **symbol 레이어**. 그중에서도 이름이 아니라 **장식·보조 기호 레이어**(일방통행 화살표, 횡단보도, 번지·블록번호, 도로 번호 방패, 출입구, 교차로, 게이트, 등고선, 보행로·대중교통·여객선 표시)가 무거웠다.

## 경과와 틀렸던 가정

| 단계 | 내용 | PC 실측(파리, 줌 22) |
|---|---|---|
| M1 `?mapcut=` | 지형·3D 건물·글자·도로·하늘·미니맵 켜고 끄는 측정 스위치. 미니맵은 정지 이미지(이중 렌더 아님) | 글자만 크게 효과(지형·건물·도로 각 0.4–0.9 ms) |
| M2 전부 숨김 | 주행 + 줌 ≥ 19 에서 symbol 전부 숨김 | 빠르나 지리 정보 없음 → Chief 반려 |
| M3 `both` | "지평선 쪽 **먼 글자**가 비싸다" 가정 → `distance-from-center` + 중요 종류만 | 65 fps 이나 **라이더 옆 도로명까지 사라짐** |
| 실험 | `near`(거리 조건만) = `all` 과 같은 49–50 fps → **거리 조건은 비용을 거의 못 줄임**. 장식 기호만 숨기면 57 fps 에 이름 전부 유지 | |
| **M4 `names`** | 이름 레이어는 filter·visibility 무변경, 장식 기호만 숨김 | **57 fps**(전부 49) |

교훈: 서울 남산(숲, 글자 적음)에서 찍은 첫 비교는 판단 근거가 못 됐다 — **글자가 많은 도심 코스(파리)** 에서 재야 한다.

## 현재 동작 (`lib/map/rideLabels.ts`)

- 주행(running/paused) + 줌 ≥ 19 에서 적용, 18.7 미만 복원(히스테리시스), 원래 visibility 복원, `style.load` 재적용, 상태 같으면 호출 0, 앱 레이어·DOM 이름표 제외.
- 장식 판정 `isDecorativeSymbolLayer` — 이름 레이어(`road-label*`, `poi-label`, `settlement*`, `natural*`, `water*`, `airport*`, 행정) 우선 유지, **모르는 레이어는 숨기지 않음**. 스타일별 숨김: outdoors 20 · satellite 6 · night 16.
- 비교 스위치: `?labelmode=names|both|near|major|all|none`, `?labeldist=`, `?labels=1`(항상 표시), `?mapcut=`.

## 다시 문제가 되면

- 글자가 너무 적다 → `?labelmode=all` 과 비교, 숨김 목록(`03-result-m4.md` 표)에 이름 레이어가 섞였는지 확인.
- 느리다 → `?perflab=1` 의 지도 JS, `?mapcut=` 로 요소별 측정. 실기기 측정 스크립트는 [성능 측정 방법](261017-RTW-성능-측정-방법-perflab.md).
- 새 지도 스타일 추가 시 장식/이름 분류를 그 스타일로 다시 확인(`apps/web/scripts/map/ride-label-names-headless.mjs`).
