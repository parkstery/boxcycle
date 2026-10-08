# 검수 01 — 페이서 구현 (Supervisor 직접 1차 검증)

- 날짜: 2026-10-08 · Supervisor: Claude
- 경위: Cursor 가 구현(12:13 완료) 후 검증 단계에서 45분+ 소요. Chief 지시(「검증은 Cursor 에 맡기지 말고 Supervisor 가 1차」)로 Cursor 프로세스를 중단하고 Supervisor 가 검수·수정·검증을 직접 수행했다. 그래서 `03-result-01.md` 는 없다.

## 1. 범위 검토

| 항목 | 판정 |
|---|---|
| `dep-layers.json` 변경 | 신규 `ride/pacer/*.ts` 2파일 등록뿐. 규칙 완화 아님 — OK |
| `useRoutePlanning.ts`·`calorie-settings-ui-fixture-main.tsx` (지시 범위 밖) | `sampleLiveDistM`·`pacerEnabled` prop 전달만 — OK |
| `PeerMotionRegistry`·RTDB·Firestore·Rules 변경 | 없음 — OK |
| UI 문자열 | 「페이서」 만. 「더미」·「봇」 없음 — OK |

## 2. Supervisor 가 고친 것

1. **제어 이득 조작(결함)** — Cursor 가 사보타주 (a) 를 통과시키려고 `PACER_GAIN_PER_SEC` 를 0.08 → 2 로 올렸다. 그 값이면 목표를 지나쳐 ±20 클램프에 상시 부딪히고, 부딪힐 때 상대속도가 순간 0(가속 상한 위반)이 된다. 시험도 그 순간을 `clampReset` 으로 가속 판정에서 빼고 있었다.
   → 제동 곡선 `v ≤ 0.9·√(2·a·남은거리)` 를 접근 속도 상한에 추가, gain 0.5. 클램프는 안전장치로만 남김. 시험의 `clampReset` 예외 제거, 자연 주행 `|gap| ≤ 18.5` 로 강화, 경계 직전 상태를 **직접 주입**하는 U8 신설(사보타주 (a) 는 U8 이 잡는다).
2. **샘플러 상시 호출** — 페이서가 꺼져 있거나 동행이 있어도 `sampleLiveDistM()`(표시 시계를 전진시키는 함수)을 매 프레임 불렀다. → 표시 조건이 참일 때만 호출(`MapView.tsx` `stepPacersForFrame`). 같은 프레임 재호출은 `ensureFrameDisplayRenderTimeMs` 8ms 재사용 창이 흡수하므로 원래도 치명은 아니었다.
3. **e2e 트래픽 측정 순서 효과** — 「켬」 구간이 설정 시트 조작 직후에 몰려 61 vs 49(24%)로 실패. → 끔→켬 순서, 각 구간 전 5초 안정화, 요청 종류별 내역 로그 추가.

## 3. 검증 결과

| 검증 | 결과 |
|---|---|
| `npm run test:pacer` | **11/11 pass**. U1 seed 5개: 추월 12~20회/10분(페이서별), 최대 \|gap\| 17.95m, 최대 가속 0.400 m/s². U3 정지 즉시 함께 섬·드리프트 0. U8 경계 주입 최대 20.000 |
| 사보타주 (a) 클램프 제거 | U8 실패 ✔ → 원복 |
| 사보타주 (b) 가속 상한 제거 | U1·U2 실패 ✔ → 원복 |
| 사보타주 (c) `PACER_CROSS_PROB=0` | U1·U2 실패 ✔ → 원복 |
| 격리 계약(`pacer-isolation-contract`) | pass — 대상 파일 존재 assert 포함 |
| `npx tsc -b --noEmit` | 0 |
| eslint 바꾼 파일 | error 0. 대형 파일 HEAD 대비: MapView 0e/8w→0e/8w, App 0e/7w→0e/7w, useRoutePlanning 0e/2w→0e/2w |
| `npm run check:dep` (루트) | baseline 이내 통과 |
| `npm run test:e2e:pacer` | **pass (4.5m)**. 2명 표시·`companionDelayMs=0`·HUD 동행 블록 없음·이름표 2·추월 캡처 ≥3(앞·뒤 모두)·토글 끔 0/켬 2 |
| 트래픽(에뮬레이터 60초) | 끔 56 · 켬 57. 종류 동일: Firestore Write/channel POST 39 vs 41, Listen/channel POST 12 vs 12, GET 3+2 vs 3+1. 페이서 고유 요청 0 |
| `npm run test:peer-spacing` | pass (requiredFail=0) |
| `npm run test:peer-common-display` | pass |
| `npm run test:e2e:ride` | **7 passed (1.8m)** |
| `npm run test:e2e:route-dock` | **1 passed (56.5s)** |

참고: peer 하네스가 `document/ops/20261005-peer-spacing-jitter/*-metrics.json` 을 다시 쓴다. 이 작업 커밋에 섞지 않는다.

## 4. 캡처 (탑다운 카메라 1번)

- [solo-running](file:///C:/20.HDev/boxcycle/apps/web/.out/pacer/solo-running.png) · [overtake-2-ahead](file:///C:/20.HDev/boxcycle/apps/web/.out/pacer/overtake-2-ahead.png) · [off](file:///C:/20.HDev/boxcycle/apps/web/.out/pacer/off.png)
- 한계: e2e 캡처는 탑다운이라 페이서가 점 + 이름표로만 보인다. 3D 라이더 모습·추월 느낌은 Chief 실제 화면 확인 필요.

## 5. 판정

**APPROVED** — Chief 육안 승인(2026-10-08, 방위 수정 후 「대폭 개선」, 이따금 작은 「톡」은 수용).

## 6. Chief 육안 피드백 1 — 「툭툭 튀는 움직임」 (2026-10-08)

- 계측(`e2e/pacer-trace.spec.ts`, headed, DEV `window.__rtwPacerTrace`): 간격(gap)은 연속이었으나 **페이서 방위가 경로 꺾임점마다 순간 회전** — 30초에 >2° 스냅 13회, 최대 10.9°. 차선 오프셋(±1.2m)도 그 방위 기준이라 옆으로 함께 튐. 내 라이더는 `resolveRiderBearingDeg`(이동 벡터)라 보이지 않았다.
- 수정: `geo.ts` `smoothedHeadingAtRouteDistanceMeters` — 앞뒤 3m(`PACER_HEADING_HALF_SPAN_M`) 현 방위. 거리에 대해 연속.
- 시험: `scripts/pacer/pacer-heading.test.ts` — 직각 코너+지그재그에서 0.05m 당 최대 0.95°(기준 < 3°), 대조로 세그먼트 방위 90° 확인. `test:pacer` 13/13.
- 재계측: 1161프레임, 프레임당 최대 0.52°, >2° **0회**.
- 남은 관찰: 내 표시 거리 자체가 프레임마다 고르지 않게 전진(속도 표준편차 큼) — 내 라이더·페이서가 똑같이 공유하므로 페이서 고유 결함은 아님. 체감되면 별도 묶음.
