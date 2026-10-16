# 지시 M4 — 새 기본 글자 모드 `names` (이름은 전부, 장식 기호만 숨김) + perflab 패널 위치

| 항목 | 내용 |
|---|---|
| 발행 | 2026-10-16 · Supervisor (Claude) |
| 대상 | Developer — **OpenCode Muse Spark** |
| 작업 위치 | `C:\20.HDev\boxcycle-names` (브랜치 `feat/ride-label-names`, 기준 `main2` `29b1300`) |
| 결과 파일 | `C:\20.HDev\boxcycle-names\document\ops\20261016-map-cut\03-result-m4.md` |
| 근거 | [04-review-m3.md](04-review-m3.md) 와 아래 Supervisor 실측 |

## Supervisor 실측 (운영, GTX 1660 실제 GPU, 파리 퐁뇌프 코스, 카메라 2·줌 22)

| 모드 | fps | 지도 JS(라이더 제외) | 보이는 것 |
|---|---:|---:|---|
| `all` | 49 | 11.5 ms | 전부 |
| `near`(D 1.2/2/3) | 49–50 | 10.7–11.1 ms | 주변 전부 — **거리 조건은 비용을 거의 못 줄임** |
| `both`(현재 기본, D 1.2/2/3) | 65–66 | 6.5–6.8 ms | 이름이 거의 없음(라이더 옆 도로명 `Rue de Nevers`·`Pont Neuf` 도 사라짐) → Chief 불만 |
| **장식 기호만 숨김(실험)** | **57** | **8.4 ms** | **도로명·지명·다리·건물·POI 이름 전부** |

실험에서 숨긴 레이어(navigation-night 기준, 20개): `tunnel/road/bridge-oneway-arrow-blue/white`, `level-crossing`, `crosswalks`, `gate-label`, `contour-label`, `building-entrance`, `building-number-label`, `block-number-label`, `road-intersection`, `road-number-shield`, `road-exit-shield`, `path-pedestrian-label`, `golf-hole-label`, `ferry-aerialway-label`, `transit-label`.

**Chief 결정: 새 기본값은 이 방식(`names`).**

## 할 일

1. `apps/web/src/lib/map/rideLabels.ts` 에 모드 **`names`** 추가 = **장식·보조 symbol 레이어만 visibility none**, 이름 레이어(`road-label*`, `poi-label`, `settlement*`, `natural*`, `water*`, `waterway*`, `airport*`, `state*`, `country*`, `continent*`)는 **filter·visibility 모두 그대로**(조임·거리 조건 없음). 장식 판정은 M3 의 `isMajorKeptLabelLayer` id 패턴(방패·화살표·횡단보도·출입구·지번·블록번호·교차로·게이트·등고선·보행로·골프·여객선·transit 등)을 재사용하되, **이름 레이어를 숨기지 않도록** 분리한 함수로(예: `isDecorativeSymbolLayer`). 소스 레이어로 판정할 때도 이름 레이어는 유지. 스타일 3종(night/outdoors/satellite)에서 숨김 목록을 결과에 표로.
2. **기본값을 `names` 로** — `?labelmode=` 없거나 잘못된 값이면 `names`. 기존 `both`/`near`/`major`/`all`/`none` 은 비교용으로 유지. 적용 조건(주행 + 줌 ≥ 19, 히스테리시스 18.7, 원래 값 복원, `style.load` 재적용, 상태 같으면 호출 0, 앱 레이어 제외)과 `?labels=1` 은 그대로.
3. **perflab 패널 위치**: 패널(접힌 상태 포함)이 상단 가운데에서 **카메라 1·2 버튼을 가린다**(측정 중 실제로 클릭을 가로챔). 패널을 카메라 버튼 줄과 겹치지 않는 위치로 옮긴다(예: 좌상단 HUD 아래 또는 화면 왼쪽 가장자리). 가로 폰(699×273 CSS)과 데스크톱(1280×720) 모두에서 카메라 1–6·야외·+/− 버튼과 겹치지 않음을 헤드리스로 `getBoundingClientRect` 비교해 확인.

## 시험

모드 파싱(기본 `names`), `isDecorativeSymbolLayer` 표본(위 20개 → 장식, 이름 레이어 → 아님), `names` 적용·복원(이름 레이어는 호출 0), 기존 M2·M3 시험 유지(모드를 명시해 같은 동작), 패널 겹침 없음(가능하면 순수 함수/DOM 시험, 아니면 헤드리스 확인을 결과에 기록).

## 검증

PowerShell `apps/web`: tsc, 변경 파일 eslint, **루트 `node scripts/check-dep-direction.mjs --check` "lib 파일 전원 도메인 지정 PASS(미지정 0)"**, `npm run test:quick`(worktree `functions/lib` 부재 3건 외 0), `npm run test:rider-preserve`, `npm run build`. 헤드리스 1회(dev 5070, 브라우저 1개, 끝나면 종료): 스타일 3종 `names` 숨김 목록 + 패널 겹침 확인.

## 금지

주행 외 화면 변경, 이름 레이어 숨김·조임, 앱 레이어·이름표 변경, 매 프레임 레이어 호출, commit · push · 배포, 백그라운드 잔류.
