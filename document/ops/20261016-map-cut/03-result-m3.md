# 결과 M3 — 주행 글자 절충: 주변의 중요한 이름만 (Chief 결정 ③)

| 항목 | 내용 |
|---|---|
| 지시 | `document/ops/20261016-map-cut/02-task-m3.md` (Supervisor Claude, 2026-10-16) |
| 수행 | Developer (OpenCode Muse Spark), 작업 위치 `C:\20.HDev\boxcycle-labelmode`, 브랜치 `feat/ride-label-mode` (기준 `main2` `5b7f476`) |
| 상태 | 완료 (commit·push·배포 없음, dev 서버·브라우저 종료, 백그라운드 잔류 없음) |

## 1. 구현

- `apps/web/src/lib/map/rideLabels.ts` 확장 (도메인 `map`, 기존 등록 유지 — 신규 lib 파일 없음):
  - 모드 `?labelmode=both|near|major|all|none` (`parseRideLabelMode`, 잘못된 값·없음 → `both`), 거리 `?labeldist=` (`parseRideLabelDist`, 기본 1.2, 0.5–3 클램프, 잘못된 값 → 1.2). 운영 판독 `readRideLabelMode()`·`readRideLabelDist()` — 값이 바뀌면 다음 줌·주행 이벤트에 반영. `?labels=1`·`mode=all` 은 항상 표시.
  - `both`(기본) = `near` + `major`. `near` = 전 대상에 `["<", ["distance-from-center"], D]` 를 기존 filter 와 `all` 결합. `major` = 사소한 종류 레이어째 숨김 + road-label* 는 `class ∈ {motorway,trunk,primary,secondary}` 로 조임 + poi-label 은 `filterrank ≤ 2` 로 조임. `none` = M2 동작(visibility 만). `all` = 손대지 않음.
  - 분류 `isMajorKeptLabelLayer`: id 패턴(방패·transit·path·pedestrian·intersection·ferry·aerialway·oneway/arrow·crossing·turning·incident·contour·entrance·gate·crosswalk·housenum·block-number·building-number·golf → 숨김) 우선, 그 다음 소스 레이어(`road` → `road-label*` 만 유지, `place_label`·`natural_label`·`airport_label`·`poi_label` 유지, 나머지 숨김), 소스 정보 없으면 id 폴백.
  - 원래 filter·visibility 를 각각 기억했다가 그대로 복원(원래 `none`·원래 filter 유지, 없던 filter 는 제거로 복원). `setFilter` 실패 레이어는 건너뛰고 요약에 기록. 상태(적용 여부·모드·D)가 같으면 호출 0, 모드·D 변경 시 복원 후 재적용. `style.load` 재적용은 저장된 모드·D 로.
- `PerfLabPanel.tsx`: 상단 `글자 모드 both (D 1.2) · 숨김/표시`, 복사 JSON 에 `rideLabelMode`·`rideLabelDist` 추가(`rideLabelsHidden` 유지). `MapView.tsx` 변경 없음(컨트롤러가 쿼리를 직접 읽음).

## 2. 실제 스타일 확인 (경계값 근거)

2026-10-16 Style API 조회 — `navigation-night-v1`(symbol 29)·`outdoors-v12`(34)·`satellite-streets-v12`(20). 중요 레이어 id·소스 3종 동일.

- road-label*: 줌 ≥ 15~16.5 에서 street·sreet_limited·track·path·pedestrian·golf·ferry·aerialway 까지 표시 → 4분류 조임 유효.
- poi-label filter: outdoors `filterrank ≤ step(줌)+보너스`(줌 ≥ 17 → 4–6), satellite `≤ step+3`(→ 5), night 밀도별 2–5 → 상한 2 조임 유효.
- **`sizerank` 는 3종 symbol filter 어디에도 없음** → 조임에 미사용(없는 속성 비교는 전부 거짓). `symbolrank` 는 settlement 2종에만.
- settlement-subdivision 은 `filterrank ≤ 3` 유지. `block-number-label`(place_label)은 번호라 숨김.

## 3. 시험

`apps/web/scripts/map/ride-labels-contract.test.ts` 26건 전부 통과 (M2 11건은 `mode:"none"` 으로 유지 + none 은 filter 무호출 단언 추가):

- 파싱(잘못된 값 → `both`), D 범위(클램프·기본값).
- 실제 스타일 26개 표본 keep/hide, 소스 없을 때 id 폴백·모르면 숨김, 조임 조건 deepEqual(도로 match·POI `filterrank ≤ 2`·지명 null), 결합(원래 filter 유·무).
- near/both/major/all 적용·복원(복원 후 visibility·filter 원본 일치), 모드·D 변경 시 재적용·동일 시 호출 0, `setFilter` 실패 1건 건너뜀+기록, 앱 레이어 제외, both 적용 중 `reapply`.

## 4. 검증 (PowerShell `apps/web`, 전부 포그라운드 — dev 서버만 백그라운드 기동 후 종료)

| 검사 | 결과 |
|---|---|
| `npx tsc -b` | 통과 |
| `npx eslint` 변경 4 파일 | 에러 0 |
| 루트 `node scripts/check-dep-direction.mjs --check` | 요구 항목 "lib 파일 전원 도메인 지정" **PASS(미지정 0)**. 전체 M0 FAIL 은 기존 결함(`route-token-onboarding-grant.test.mjs` → `functions/lib` 미존재, M1·M2 와 동일) |
| `npm run test:quick` | ride 757/0 · **map 117/0**(신규 15) · peer 72/0 · meters 58/0 · tools 34/0. route 3 실패는 전부 `functions/lib` 부재 — 지시 예상과 일치, 변경부와 무관 |
| `npm run test:rider-preserve` | 44 + 6 전부 통과 |
| `npm run build` | 성공 (chunk 크기·SADDLE/PELVIS 경고는 기존) |

헤드리스 1회(dev 5070, 브라우저 1개·순차 페이지, 끝나면 종료): `?labels=1` 로 운영 측 무간섭 + 운영 컨트롤러를 `riding:true`·줌 19.5 로 직접 구동, 스타일 3종 순회. 스크립트 `apps/web/scripts/map/ride-label-mode-headless.mjs`, 원시 `document/ops/20261016-map-cut/ride-label-mode-headless.json`.

| 스타일(줌 19.5) | 모드 | 대상 | 숨김 | filter | distance 적용 | 복원 불일치 |
|---|---|---:|---:|---:|---:|---:|
| outdoors(34) | both | 34 | 20 | 14 | 14 | 0 |
| outdoors | near | 34 | 0 | 34 | 34 | 0 |
| outdoors | major | 34 | 20 | 2 | 0 | 0 |
| outdoors | all/none | — | 0/34 | 0 | — | 0 |
| satellite(20) | both | 20 | 6 | 14 | 14 | 0 |
| satellite | near | 20 | 0 | 20 | 20 | 0 |
| satellite | major | 20 | 6 | 2 | 0 | 0 |
| satellite | all/none | — | 0/20 | 0 | — | 0 |
| night(29) | both | 29 | 16 | 13 | 13 | 0 |
| night | near | 29 | 0 | 29 | 29 | 0 |
| night | major | 29 | 16 | 2 | 0 | 0 |
| night | all/none | — | 0/29 | 0 | — | 0 |

- `distance-from-center` 건너뜀(skipped) 3종 모두 0 — 실지도 symbol filter 에서 지원됨.
- 유지(예: outdoors both-filtered 14): `road-label`·`waterway`·`natural-*`·`water-*`·`poi`·`airport`·`settlement-*`·`state`·`country`·`continent`. 숨김(20): 일방·터널/교량 화살표·건널목·횡단보도·게이트·등고선·출입구·지번·블록번호·교차로·방패 2·보행로·골프·여객선·transit. major 조임 2 = road + poi.
- perflab 표시 확인: `?labelmode=near&labeldist=2` → `글자 모드 near (D 2) · 표시`.
- 정정 1건: 해당 실행의 `withTighten` 집계 문자열이 `"filterrank",2` 로 잡아(실제 `…"],2`) poi 를 빠뜨리고 road 만 집계했다. poi 조임 적용 자체는 단위시험 deepEqual + major-filtered `[road, poi]` 로 입증됨. 스크립트는 올바른 문자열로 고쳤다(재실행 없음 — 헤드리스 1회 준수).

화면·fps 비교는 Supervisor 가 배포 후 실제 GPU 로.

작업 파일:

- 수정: `apps/web/src/lib/map/rideLabels.ts`, `apps/web/src/components/perfLab/PerfLabPanel.tsx`, `apps/web/scripts/map/ride-labels-contract.test.ts`
- 신규: `apps/web/scripts/map/ride-label-mode-headless.mjs`, `document/ops/20261016-map-cut/ride-label-mode-headless.json`, 본 결과
