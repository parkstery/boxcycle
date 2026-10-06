# 검수 10 — 주행 종료 시 정북 복귀

- Supervisor: Claude · 판정: **APPROVED**

| 항목 | 판정 | 근거 |
|---|---|---|
| 종료 bearing 140°→0°, 중심 이동 0px, 줌 Δ0 | PASS | 결과 10 수치표 |
| 일시정지 bearing 불변(95°→95°) | PASS | 결과 10 수치표 |
| 구현 위치 = 카메라 소유 계층(MapView ride 전이 + `lib/map/rideEndNorthUp.ts`) | PASS | 흐름 파일:줄 |
| `tsc -b --noEmit` 0 · 단위 7/7 · menu-a pass | PASS | 결과 10 |
| hold 해제 | PASS | 다른 경로 로드(`MapView` ~1730) · 주행 시작(~2542) |
| 대기 중 HUD ± (a275e3a) 가 hold 에 막히지 않음 | PASS | ± 는 `mapZoomStepRequest`(~2515) 경로 — hold 가드 없음 |
| `test:e2e:u3` 실패 | 무관 | 수정 전 코드 동일 실패(RouteDock 속도 슬라이더 셀렉터) |

## 후속(범위 밖)
- hold 중에는 `mapZoom` props 경로(맵 뷰 시트 줌 슬라이더 등)가 다음 경로 로드·주행 시작 전까지 무시된다. 실사용 영향이 보이면 hold 를 「사용자 지도 조작 시 해제」로 좁힌다.
- `u3` 의 RouteDock 속도 슬라이더 셀렉터 정비.
