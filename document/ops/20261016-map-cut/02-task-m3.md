# 지시 M3 — 주행 글자 절충: 주변의 중요한 이름만 (Chief 결정 ③)

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-labelmode` (브랜치 `feat/ride-label-mode`, 기준 `main2` `5b7f476`) |
| 결과 파일 | `C:\20.HDev\boxcycle-labelmode\document\ops\20261016-map-cut\03-result-m3.md` |
| 근거 | [04-review-m2.md](04-review-m2.md) — 주행 중 줌 ≥ 19 글자 전부 숨김(M2)은 성능은 좋지만 Chief: "주변 지리를 알려면 지명·건물명이 필요, 너무 많이 줄었다" |

## 원인과 방향

글자 비용의 대부분은 높은 기울기(카메라 2, pitch ≈ 80°)에서 **지평선 근처 먼 글자**를 한꺼번에 배치·충돌 계산하기 때문이다. 라이더 주변 글자는 남기고 먼 글자·사소한 종류만 뺀다.

## 모드 (`?labelmode=`, 운영 포함)

M2 의 `rideLabels.ts`(주행 + 줌 ≥ 19 + 히스테리시스, 원래 값 복원, `style.load` 재적용, 상태 변화 때만 호출, 앱 레이어 제외)를 확장한다. 주행 중 가까운 카메라일 때 적용할 모드:

| 모드 | 동작 |
|---|---|
| `both` **(새 기본값)** | `near` + `major` |
| `near` | 모든 베이스맵 symbol 레이어에 **`["<", ["distance-from-center"], D]`** 조건을 기존 filter 와 `all` 로 결합(지평선 쪽 먼 글자만 제거). `D` 기본 1.2, `?labeldist=0.5–3` 으로 조정 |
| `major` | 중요한 종류만 남김: 지명(`settlement*`, `settlement-subdivision*`, 섬·자연·수계 이름), **건물·랜드마크 이름**(`poi-label` 중 큰/중요한 것 — Mapbox Streets v8 `sizerank`·`filterrank` 기준, 경계값은 실제 스타일로 확인해 결과에 적기), **큰 도로명**(`road-label*` 중 class `motorway`/`trunk`/`primary`/`secondary`). 골목 이름·보행로·대중교통·작은 POI·도로 번호 방패 등은 숨김 |
| `all` | 글자 모두 표시(M2 이전) — `?labels=1` 과 같음 |
| `none` | 글자 모두 숨김(M2 동작) |

- 레이어 id·필드는 실제 스타일(`navigation-night-v1` 및 사용자 선택 스타일 outdoors/satellite)에서 조회해 분류한다. 스타일마다 이름이 다르면 종류 판정을 소스 레이어(`place_label`, `poi_label`, `road`, `natural_label`, `water_label`, `transit_stop_label`…)로 한다.
- filter 변경은 **원래 filter 를 기억했다가 그대로 복원**(주행 종료·줌 < 18.7·모드 해제).
- `distance-from-center` 는 Mapbox GL JS 의 symbol filter 전용 식이다. 지원되지 않는 경우(오류) 해당 레이어는 `near` 를 건너뛰고 결과에 기록.
- perflab 상단에 `글자 모드 both (D 1.2)` 처럼 표시, 복사 JSON 에 `rideLabelMode`·`rideLabelDist`.

## 시험

모드 파싱(잘못된 값 → `both`), `D` 범위, 분류(레이어 표본 → keep/hide 판정), filter 결합·복원(원래 filter 가 없는 경우·있는 경우), 앱 레이어 제외, 상태 같으면 호출 0, M2 시험 유지(모드 `none` 일 때 같은 동작).

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` "lib 파일 전원 도메인 지정 PASS(미지정 0)"**, `npm run test:quick`(worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`, `npm run build`. 헤드리스 1회(dev 5070, 브라우저 1개, 끝나면 종료): 주행 진입 후 각 모드에서 실제로 숨겨지는/남는 레이어 수와 `distance-from-center` 적용 여부를 표로. 화면·fps 비교는 Supervisor 가 배포 후 실제 GPU 로 한다.

## 금지

주행 외 화면 변경, 앱 레이어·이름표 변경, 스타일 URL 변경, 매 프레임 레이어 호출, commit · push · 배포, 백그라운드 잔류.
