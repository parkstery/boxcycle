# 개발 부산물 재고 조사

| 항목 | 내용 |
|---|---|
| 문서 유형 | 조사 결과 (삭제·이동 없음) |
| 작성 | 2026-10-17 · Supervisor (Claude) |
| 기준 | main2 `07a70ed` |
| 다음 | Chief 가 분류·삭제 후보를 확인 → 관리 규칙(등록부·게이트) 문서 |

## 요약

| 종류 | 수량 | 문제 |
|---|---:|---|
| 디버그 모듈 `apps/web/src/lib/debug/` | 25개 | 8개는 운영 번들 포함, 17개는 DEV 전용. 어느 것이 아직 쓰이는지 기록 없음 |
| 주소 스위치 `?키=` | 17개 | 운영에서 켜지는 측정용 9개. 1개(`weather`)는 호출처 없는 죽은 코드 |
| 스크립트 `apps/web/scripts/` | 추적 282개 | 시험 122개는 전부 `test:quick` 포함(정상). 도구 142개 중 **39개는 어떤 명령·코드도 부르지 않음** |
| 결과물 `.out` | 14곳 120 MB | gitignore 라 저장소에는 없지만 디스크에 누적. 2곳은 10개 파일이 실수로 추적됨 |
| 작업 묶음 `document/ops/` | 48개 | 10-16 세션 묶음 8개가 ops 목록(README)에 미등록 |

## 1. 디버그 모듈 (25)

**A. 운영에서 주소 스위치로 켜는 것 — 상시 진단 도구 후보**

| 모듈 | 켜는 법 | 도입 | 비고 |
|---|---|---|---|
| perfLab | `?perflab=1` | 10-16 | 패널·결과 복사. 아래 3개를 묶어 씀 |
| frameBreakdownProbe | (perflab) | 10-16 | 788줄, 가장 큼 |
| riderJitterProbe | (perflab) | 10-16 | 떨림 줄 |
| riderRenderCostProbe | (perflab), DEV `window.__rtwRiderCost` | ≤09-25, 10-16 갱신 | |
| rideCameraLab | `?camlab=1` | 10-02 | 카메라 조절판. "DEV 게이트 금지(배포본에서 Chief 확인)" 주석 |
| visibilityReadMeters | 상시(계측) | 10-03 | src 13곳에서 참조 — 사실상 제품 계측 |
| trafficPublishMeters / touchActivityMeters / readSubscriptionMeters | 상시(계측) | ≤10-01 | 트래픽 계측 시험(`meters` 묶음)이 사용 |

운영 번들(`index-*.js` 단일 3.7 MB)에 perflab·camlab·lightlab 패널 코드가 **지연 로드 없이 항상 포함**된다. 일반 사용자에게 보이지는 않지만 내려받기는 한다.

**B. DEV 빌드에서만 동작 — 과거 조사용**

| 모듈 | 도입(마지막 수정) | 당시 작업 | 판단 |
|---|---|---|---|
| tickTestSwitches (+ `TickTestOffBadge`) | ≤09-25 | U-7 주행 중 톡 소거 | 떨림은 10-16 해결 → **제거 후보** |
| mapTickProbe | ≤09-25 | 같은 조사 | **제거 후보** |
| mapDebugPhase | ≤09-25 (10-07) | 지도 단계 표시 | src 8곳 참조 — 확인 필요 |
| peerIngestDiag / peerSmoothnessProbe | 10-05 / 09-28 | 동행 진동(261005 해결) | 하네스 사용 여부 확인 후 제거 후보 |
| hudCompanionDiag + installHudCompanionDebug | ≤09-25 | HUD 동행 | 확인 필요 |
| installLiveRideExistsDebug / installMotionExistsDebug | ≤09-26 | Firestore 존재 확인 | 제거 후보 |
| installReadSubscriptionDebug / installTouchActivityDebug / installTrafficPublishDebug | ≤10-03 | 트래픽 개선(CLOSED) | 계측 시험과 연결 확인 |
| trafficPairedCapture | 10-01 | 트래픽 비교 캡처 | src 참조 0, 스크립트 1곳만 |
| localFirstGeoProbe | ≤09-25 | Local First Ride | 제거 후보 |
| documentVisibilityOverride | 10-03 | 가시성 시험 | 시험 2곳 사용 — 유지 |
| distanceAutoRouteClickDebugMarker | ≤09-25 | 자동 경로 | 제거 후보 |

("≤09-25" 는 09-25 구조 정비 때 파일이 옮겨져 그 이전 이력이 끊긴 것.)

## 2. 주소 스위치 (17)

| 스위치 | 운영 | 용도 | 판단 |
|---|---|---|---|
| `perflab` `mapcut` `labelmode` `labeldist` `labels` `maxdpr` `skin` | 켜짐 | 10-16 성능 측정·비교 | 상시 도구로 등록, 또는 일부 정리(`labeldist`·`both/near/major` 모드는 실험용) |
| `camlab` `lightlab` | 켜짐 | 카메라·조명 조절판 | 아직 쓰는지 Chief 확인 |
| `rideCam` `ridePitch` | 켜짐 | 카메라 거리·각도 덮어쓰기 | 확인 필요 |
| `riderModel` `sway` `tickTest` `peerSyncLogMs` | DEV 전용 | 비교 캡처·로그 | `tickTest` 는 제거 후보 |
| `subscription` `trail…` | 제품 기능 | 결제 복귀·공유 링크 | 대상 아님 |
| `weather` | — | `parseWeatherOverride` 정의만 있고 **호출처 0** | 죽은 코드 |

## 3. 스크립트 — 아무도 부르지 않는 도구 39개

package.json·다른 스크립트·소스·훅·명령 어디에서도 부르지 않는 파일. 문서에만 이름이 남은 것과 문서에도 없는 것을 나눴다.

| 묶음 | 파일 | 날짜 | 문서 언급 | 판단 |
|---|---:|---|---|---|
| `rider-cycle-fit/` 폴더 전체 | 35 (도구 12 미호출) | 08-01 ~ 09-28 | 옛 계획·보고 | 구 라이더 파이프라인, rider14 로 대체 → **폴더 보관/삭제 후보** (452 KB) |
| `rider-preview/` 폴더 전체 | 11 | ≤09-25 | 없음 | **삭제 후보** (120 KB) |
| `peer-sync/s3*·s41*-summarize.mjs` | 8 | 09-27 | 일부 jsonl 로그뿐 | 일회성 요약 → **삭제 후보** |
| `rider-preserve/` audit·probe·scan·derive·stage-app-candidate | 7 | 09-21 | 260922 보고 | s5 시절 일회성 조사 → **삭제 후보** |
| `rider-preserve/` 10-16~17 (rider-perf-bench.run, stage-rider14-lod2, capture-gpu-skin-compare, verify-visual-kit-on-glb) | 4 | 10-05~10-17 | 해당 묶음 | LOD2·스킨 재생성에 다시 쓸 수 있음 → 유지 + 등록 |
| `map/` headless 3개(map-cut-lab, ride-label-mode, ride-label-names) | 3 | 10-16 | 묶음·보고 | `ride-label-names` 는 새 지도 스타일 확인용 유지, 나머지 2개 삭제 후보 |
| UI 캡처 픽스처(distance-auto-route 2, ride-calories 1, next-ride 1) | 4 | 08-31 ~ 10-08 | 일부 | 삭제 후보 |
| `ride-continue/phase-c-three-loop.mjs` | 1 | 09-02 | 없음 | 삭제 후보 |
| 루트 `scripts/move-lib-files.mjs`, `repair-lib-imports.mjs` | 2 | 10-06 | Phase5 보고 | 구조 정비 일회성 도구 → 삭제 후보 |

추적되지 않는 측정 스크립트도 있다: `apps/web/scripts/rider-preserve/.out/mapcut/run-mapcut.mjs`(실GPU 측정, 10-16~17 계속 사용). `.out` 에 있어 **저장소에 없고 지워지면 잃는다** → 정식 위치로 옮겨 등록할 대상.

## 4. 결과물 `.out` (120 MB, 디스크)

| 위치 | 크기 |
|---|---:|
| `apps/web/scripts/rider-preserve/.out` | 64 MB |
| `apps/web/.out` | 28 MB |
| `document/ops/20261006-calories-resume/.out` | 16 MB |
| `document/ops/20261005-ride-map-controls/.out` | 6 MB (그중 8개 파일 git 추적) |
| 그 외 10곳 | 6 MB (`20261006-saved-route-readability/.out` 2개 파일 git 추적) |

보존 기한 규칙이 없다. 보고서에 숫자로 옮긴 뒤에는 대부분 다시 보지 않는다.

## 5. 작업 묶음 (48)

- 종료 묶음 8개(09-22 ~ 10-06)는 `archive/README` 에 제자리 보관으로 기록 — 정상.
- **10-16 세션 8개 묶음(frame-breakdown, map-cut, mobile-pixel-ratio, ride-tick-diet, rider-curve-sway, rider-gpu-skinning, rider-jitter, rider-perf)이 ops 목록에 미등록**. 보고서에서 링크는 되지만 진행/종료 상태가 어디에도 없다 — Supervisor 누락.

## 6. 기타

- `blender/` 27개 추적 파일, `tmp/stash-backup-20261015`(4.9 MB, 비추적).
- 에뮬레이터 로그(`*-debug.log`) 3개 — 비추적, 무해.

## 처리 제안 (Chief 결정 필요)

1. **바로 지워도 되는 것** — 위 "삭제 후보" (스크립트 약 30개, DEV 모듈 6–8개, `weather` 죽은 코드, 추적된 `.out` 10개 파일). 지우기 전 각 파일이 시험·하네스에서 안 쓰이는지 다시 확인하고, `test:quick`·빌드로 검증.
2. **상시 도구로 등록할 것** — perflab 묶음, mapcut, 글자 모드 스위치, maxdpr, skin, `run-mapcut.mjs`(정식 위치로), LOD2·스킨 재생성 스크립트.
3. **Chief 확인이 필요한 것** — `camlab`·`lightlab`·`rideCam`·`ridePitch` 를 아직 쓰는지, 측정 패널 코드를 운영 번들에서 지연 로드로 뺄지.
4. **규칙** — 이 결과를 바탕으로 등록부 + 푸시 게이트(미등록 디버그 파일·스위치 차단, 만료 경고) + 묶음 종료 시 정리 의무를 문서로 정한다.
